import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Gift,
  Loader2,
  Printer,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useCommerce } from '../CommerceContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { GarmentImage } from '../../components/GarmentImage';
import { commerceApi } from '../../services/commerceApi';
import { ApiError } from '../../services/fashionApi';
import { getOrCreateOrderIdempotencyKey } from '../../utils/orderIdempotencyKeys';
import type { PersistedOrder } from '../../types/commerce';
import {
  formatEgp,
  maskPhoneNumber,
} from '../../utils/commerceHelpers';

interface StripeVerificationEntry {
  key: string;
  promise: Promise<PersistedOrder>;
}

// Sends verify-payment at most once per (order, session) while the page is open. Re-runs of the
// load effect and StrictMode's double-invocation reuse the in-flight promise. A failed request is
// dropped from the cache, so a later attempt sends a new one.
function requestStripeVerification(
  cacheRef: { current: StripeVerificationEntry | null },
  orderNumber: string,
  sessionId: string
): Promise<PersistedOrder> {
  const key = `${orderNumber}::${sessionId}`;
  const cached = cacheRef.current;
  if (cached && cached.key === key) {
    return cached.promise;
  }
  const promise = commerceApi.confirmOrderStripeSession(orderNumber, sessionId);
  const entry: StripeVerificationEntry = { key, promise };
  cacheRef.current = entry;
  void promise.catch(() => {
    if (cacheRef.current === entry) {
      cacheRef.current = null;
    }
  });
  return promise;
}

// Rate-limit (429) and outage (503) copy for the receipt paths. Returns null for other errors,
// so callers keep their existing messages.
function transientReceiptErrorMessage(err: unknown, language: string): string | null {
  if (!(err instanceof ApiError)) return null;
  const isAr = language === 'ar';
  if (err.status === 429) {
    const waitSec = err.retryAfterSeconds ?? 30;
    return isAr
      ? `تم تجاوز عدد الطلبات المسموح به. يرجى الانتظار ${waitSec} ثانية ثم إعادة المحاولة.`
      : `Too many requests. Please wait ${waitSec} seconds before trying again.`;
  }
  if (err.status === 503) {
    const waitSec = err.retryAfterSeconds;
    if (isAr) {
      return waitSec
        ? `خدمة الإيصالات غير متاحة مؤقتاً. يرجى المحاولة بعد ${waitSec} ثانية.`
        : 'خدمة الإيصالات غير متاحة مؤقتاً. يرجى المحاولة مرة أخرى بعد قليل.';
    }
    return waitSec
      ? `The receipt service is temporarily unavailable. Please try again in ${waitSec} seconds.`
      : 'The receipt service is temporarily unavailable. Please try again shortly.';
  }
  return null;
}

// Seconds before a retry is allowed. 429 uses Retry-After (default 30). 503 uses Retry-After when present.
function transientRetrySeconds(err: unknown): number {
  if (!(err instanceof ApiError)) return 0;
  if (err.status === 429) return err.retryAfterSeconds ?? 30;
  if (err.status === 503) return err.retryAfterSeconds ?? 0;
  return 0;
}

export function ReceiptPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const [searchParams] = useSearchParams();
  const { language, t } = useLanguage();
  const {
    recentConfirmedOrders,
    recordConfirmedOrder,
    getReceiptToken,
    saveReceiptToken,
    loyaltyRules,
  } = useCommerce();
  const navigate = useNavigate();

  const [order, setOrder] = useState<PersistedOrder | null>(() => {
    if (orderNumber && recentConfirmedOrders[orderNumber]) {
      return recentConfirmedOrders[orderNumber];
    }
    return null;
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Mounted flag and in-flight Stripe verification live in refs, so they survive effect re-runs
  // and React StrictMode's double-invocation (see requestStripeVerification below).
  const isMountedRef = useRef(false);
  const stripeVerificationRef = useRef<StripeVerificationEntry | null>(null);
  const [startingStripe, setStartingStripe] = useState(false);
  // Retry state for rate-limit (429) and outage (503) responses on the receipt paths.
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [errorRetryable, setErrorRetryable] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  const sessionId = searchParams.get('session_id');
  const paymentCancelled =
    searchParams.get('payment') === 'cancelled' || searchParams.get('stripe') === 'cancelled';

  const orderRef = useRef(order);
  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  const recentConfirmedOrdersRef = useRef(recentConfirmedOrders);
  useEffect(() => {
    recentConfirmedOrdersRef.current = recentConfirmedOrders;
  }, [recentConfirmedOrders]);

  // Show notice if redirected back with ?payment=cancelled
  useEffect(() => {
    if (paymentCancelled) {
      setVerificationNotice(
        language === 'ar'
          ? 'تم إلغاء عملية الدفع عبر Stripe قبل اكتمالها. طلبك محفوظ ويمكنك إتمام الدفع الإلكتروني في أي وقت باستخدام الزر أدناه.'
          : 'Stripe Checkout was cancelled before completion. Your order is saved and you can complete payment anytime using the button below.'
      );
    }
  }, [paymentCancelled, language]);

  // Counts down a retry wait so the retry and refresh controls re-enable at the right time.
  useEffect(() => {
    if (retryCountdown <= 0) return;
    const timer = window.setInterval(() => {
      setRetryCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryCountdown]);

  // Tracks whether the page is mounted. Unlike the per-run active flag, this is not reset when the
  // load effect re-runs, so a verification result is still applied after a re-run.
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load or verify order from authoritative ASP.NET backend
  useEffect(() => {
    const targetOrderNumber = orderNumber;
    if (!targetOrderNumber) return;

    let active = true;
    setOrder((previous) =>
      previous?.orderNumber === targetOrderNumber ? previous : null
    );
    setError(null);

    async function loadAndVerify(resolvedNum: string) {
      setLoading(true);
      setError(null);
      setErrorRetryable(false);

      try {
        let currentOrder =
          (orderRef.current?.orderNumber === resolvedNum ? orderRef.current : null) ??
          recentConfirmedOrdersRef.current[resolvedNum] ??
          null;
        const storedToken =
          getReceiptToken(resolvedNum) || currentOrder?.receiptAccessToken || null;

        if (storedToken) {
          saveReceiptToken(resolvedNum, storedToken);
        }

        // 1. If returned from Stripe with ?session_id=..., verify payment via POST /api/orders/{orderNumber}/verify-payment.
        // The request is shared through stripeVerificationRef, so an effect re-run does not send it again.
        if (sessionId) {
          try {
            const confirmedRemote = await requestStripeVerification(
              stripeVerificationRef,
              resolvedNum,
              sessionId
            );
            if (confirmedRemote && isMountedRef.current) {
              const preservedToken =
                confirmedRemote.receiptAccessToken || storedToken || null;
              currentOrder = {
                ...confirmedRemote,
                receiptAccessToken: preservedToken,
              };
              if (preservedToken) {
                saveReceiptToken(resolvedNum, preservedToken);
              }
              setOrder(currentOrder);
              recordConfirmedOrder(currentOrder);
              setVerificationNotice(null);
            }
          } catch (confirmErr: unknown) {
            console.error('[receipt] Backend Stripe payment verification error:', confirmErr);
            if (isMountedRef.current) {
              const transientVerifyMessage = transientReceiptErrorMessage(confirmErr, language);
              if (transientVerifyMessage) {
                setVerificationNotice(transientVerifyMessage);
                setRetryCountdown(transientRetrySeconds(confirmErr));
              } else if (confirmErr instanceof ApiError) {
                if (confirmErr.status === 404 && confirmErr.code === 'session_not_found') {
                  setVerificationNotice(
                    language === 'ar'
                      ? 'تعذر التحقق من جلسة الدفع على الخادم (قد يكون مفتاح Stripe على الخادم مختلفاً عن بوابة الدفع). يرجى تحديث حالة الطلب أو المحاولة لاحقاً.'
                      : 'The backend could not locate this Stripe session (session_not_found). Please refresh the order status or contact support if payment was completed.'
                  );
                } else {
                  setVerificationNotice(confirmErr.message);
                }
              } else {
                setVerificationNotice(
                  language === 'ar'
                    ? 'تعذر التحقق من حالة الدفع عبر الخادم حالياً.'
                    : 'Could not verify payment status with the server at this moment.'
                );
              }
            }
          }
        }

        // 2. Fetch authoritative order from backend using X-Receipt-Token
        const effectiveToken =
          currentOrder?.receiptAccessToken || getReceiptToken(resolvedNum) || storedToken;

        try {
          const remoteOrder = await commerceApi.getOrder(resolvedNum, effectiveToken);
          if (active) {
            const preservedToken =
              remoteOrder.receiptAccessToken || effectiveToken || null;
            const mergedOrder: PersistedOrder = {
              ...remoteOrder,
              receiptAccessToken: preservedToken,
            };
            if (preservedToken) {
              saveReceiptToken(resolvedNum, preservedToken);
            }
            setOrder(mergedOrder);
            recordConfirmedOrder(mergedOrder);
            return;
          }
        } catch (fetchErr: unknown) {
          const transientMessage = transientReceiptErrorMessage(fetchErr, language);
          if (currentOrder && active) {
            setOrder(currentOrder);
            if (transientMessage) {
              setVerificationNotice(transientMessage);
              setRetryCountdown(transientRetrySeconds(fetchErr));
            }
            return;
          }

          if (active) {
            if (transientMessage) {
              setError(transientMessage);
              setErrorRetryable(true);
              setRetryCountdown(transientRetrySeconds(fetchErr));
            } else if (fetchErr instanceof ApiError && (fetchErr.status === 401 || fetchErr.status === 403)) {
              setError(
                language === 'ar'
                  ? 'يتطلب عرض هذا الإيصال رمز الوصول الآمن (X-Receipt-Token) المحفوظ في المتصفح الذي تم إنشاء الطلب منه.'
                  : 'Viewing this receipt requires the security access token (X-Receipt-Token) stored in the browser where the order was placed.'
              );
            } else if (fetchErr instanceof ApiError && fetchErr.status === 404) {
              setError(
                language === 'ar'
                  ? 'لم يتم العثور على هذا الطلب على الخادم.'
                  : 'Order was not found on the server.'
              );
            } else {
              setError(
                fetchErr instanceof Error
                  ? fetchErr.message
                  : language === 'ar'
                    ? 'لم يتم العثور على تفاصيل الطلب على الخادم.'
                    : 'Could not find details for this order.'
              );
            }
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadAndVerify(targetOrderNumber);

    return () => {
      active = false;
    };
  }, [
    orderNumber,
    sessionId,
    recordConfirmedOrder,
    getReceiptToken,
    saveReceiptToken,
    language,
    reloadNonce,
  ]);

  const handleCopyOrderNumber = async () => {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(order.orderNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // Fallback
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleRefreshStatus = async () => {
    if (!orderNumber) return;
    setLoading(true);
    setVerificationNotice(null);
    try {
      const effectiveToken =
        getReceiptToken(orderNumber) ||
        (order?.orderNumber === orderNumber ? order.receiptAccessToken : null) ||
        null;

      if (
        sessionId &&
        order?.orderNumber === orderNumber &&
        order.paymentMethod === 'stripe' &&
        order.paymentStatus !== 'paid'
      ) {
        try {
          const verifiedOrder = await commerceApi.confirmOrderStripeSession(
            orderNumber,
            sessionId
          );
          const preservedToken =
            verifiedOrder.receiptAccessToken || effectiveToken || null;
          const mergedVerified: PersistedOrder = {
            ...verifiedOrder,
            receiptAccessToken: preservedToken,
          };
          if (preservedToken) {
            saveReceiptToken(orderNumber, preservedToken);
          }
          setOrder(mergedVerified);
          recordConfirmedOrder(mergedVerified);
          return;
        } catch {
          // Fall through to GET /api/orders/{orderNumber}
        }
      }

      const updated = await commerceApi.getOrder(orderNumber, effectiveToken);
      const preservedToken = updated.receiptAccessToken || effectiveToken || null;
      const merged: PersistedOrder = {
        ...updated,
        receiptAccessToken: preservedToken,
      };
      if (preservedToken) {
        saveReceiptToken(orderNumber, preservedToken);
      }
      setOrder(merged);
      recordConfirmedOrder(merged);
    } catch (err: unknown) {
      const transientMessage = transientReceiptErrorMessage(err, language);
      if (transientMessage) {
        setVerificationNotice(transientMessage);
        setRetryCountdown(transientRetrySeconds(err));
      } else if (err instanceof Error) {
        setVerificationNotice(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePayStripeNow = async () => {
    if (!order || !orderNumber || order.orderNumber !== orderNumber) return;
    setStartingStripe(true);
    setVerificationNotice(null);
    try {
      if (order.checkoutUrl) {
        window.location.href = order.checkoutUrl;
        return;
      }
      const effectiveToken =
        getReceiptToken(order.orderNumber) || order.receiptAccessToken || null;
      const stripeSession = await commerceApi.createStripeCheckoutSession({
        orderNumber: order.orderNumber,
        receiptAccessToken: effectiveToken,
        idempotencyKey: getOrCreateOrderIdempotencyKey(order.orderNumber),
        verifiedDiscountEgp: order.discountEgp,
      });
      if (stripeSession.checkoutUrl) {
        window.location.href = stripeSession.checkoutUrl;
        return;
      }
      setVerificationNotice(
        language === 'ar'
          ? 'لم يرجع الخادم رابطاً صالحاً للدفع عبر Stripe. يرجى المحاولة مرة أخرى.'
          : 'The server did not return a valid Stripe Checkout URL. Please try again.'
      );
    } catch (err: unknown) {
      const transientMessage = transientReceiptErrorMessage(err, language);
      if (transientMessage) {
        setVerificationNotice(transientMessage);
        setRetryCountdown(transientRetrySeconds(err));
        return;
      }
      setVerificationNotice(
        err instanceof Error
          ? err.message
          : language === 'ar'
            ? 'تعذر بدء جلسة الدفع عبر Stripe. يرجى المحاولة مرة أخرى.'
            : 'Could not start Stripe Checkout session. Please try again.'
      );
    } finally {
      setStartingStripe(false);
    }
  };

  if (!order && loading) {
    return (
      <div className="receipt-loading card">
        <RefreshCw size={28} className="spin" color="var(--blue-600)" />
        <p>
          {language === 'ar'
            ? 'جاري استرجاع تفاصيل الإيصال...'
            : 'Retrieving official receipt details...'}
        </p>
      </div>
    );
  }

  if (!order && error) {
    return (
      <div className="receipt-empty card">
        <AlertCircle size={36} color="var(--red-600)" />
        <h2>{language === 'ar' ? 'تعذر العثور على الإيصال' : 'Receipt Not Found'}</h2>
        <p>{error}</p>
        {errorRetryable && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setReloadNonce((n) => n + 1)}
            disabled={retryCountdown > 0}
          >
            <RefreshCw size={16} />
            <span>
              {retryCountdown > 0
                ? language === 'ar'
                  ? `إعادة المحاولة بعد ${retryCountdown} ث`
                  : `Try again in ${retryCountdown}s`
                : language === 'ar'
                  ? 'إعادة المحاولة'
                  : 'Try again'}
            </span>
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/browse')}>
          <ArrowLeft size={16} />
          <span>{t('returnShopping')}</span>
        </button>
      </div>
    );
  }

  if (!order) return null;

  const isPaid = order.paymentStatus === 'paid';
  const isCod = order.paymentMethod === 'cod';
  const isCancelledOrRefunded =
    order.orderStatus === 'cancelled' ||
    order.paymentStatus === 'cancelled' ||
    order.paymentStatus === 'refunded';
  const isStripePending =
    order.paymentMethod === 'stripe' &&
    order.paymentStatus === 'pending_payment' &&
    !isCancelledOrRefunded;

  const isFailed = order.paymentStatus === 'failed';

  const expectedPointsOnVerify =
    Math.floor(order.finalTotalEgp / loyaltyRules.earnUnitAmountEgp) *
    loyaltyRules.pointsEarnedPerUnit;

  return (
    <div className="receipt-page">
      {/* Action Header (Hidden in Print) */}
      <div className="receipt-actions-bar print-hide">
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() => navigate('/browse')}
        >
          <ArrowLeft size={15} />
          <span>{t('returnShopping')}</span>
        </button>

        <div className="receipt-action-buttons">
          {isStripePending && (
            <button
              type="button"
              className="btn btn-sm btn-purple"
              onClick={() => void handlePayStripeNow()}
              disabled={startingStripe}
            >
              {startingStripe ? (
                <Loader2 size={14} className="spin" />
              ) : (
                <CreditCard size={14} />
              )}
              <span>
                {language === 'ar' ? 'إتمام الدفع عبر Stripe' : 'Complete Stripe Payment'}
              </span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => void handleRefreshStatus()}
            disabled={loading || retryCountdown > 0}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>{t('viewOrderDetails')}</span>
          </button>

          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={handlePrint}
          >
            <Printer size={15} />
            <span>{t('printReceipt')}</span>
          </button>
        </div>
      </div>

      {verificationNotice && (
        <div
          className="banner banner-info print-hide"
          role="status"
          style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{verificationNotice}</span>
        </div>
      )}

      {/* Main Official Receipt Document */}
      <article className="receipt-paper card" aria-label="Purchase Receipt">
        {/* Receipt Header */}
        <header className="receipt-header">
          <div className="receipt-brand-row">
            <div className="receipt-brand-logo">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 4a2.5 2.5 0 0 0-2.5 2.5c0 1.08.69 2 1.65 2.35L12 9.2V11L4.2 15.8A2.2 2.2 0 0 0 3 17.75C3 19 4.02 20 5.28 20h13.44C19.98 20 21 19 21 17.75c0-.8-.44-1.54-1.2-1.95L12 11"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <h1 className="receipt-store-title">TryOnStudio</h1>
              <div className="receipt-store-tag">AI Virtual Try-On &amp; Clothing Platform</div>
            </div>
          </div>

          <div className="receipt-status-banner">
            {isPaid ? (
              <div className="receipt-badge paid">
                <CheckCircle2 size={16} />
                <span>{language === 'ar' ? 'تم الدفع بنجاح' : 'Payment Completed'}</span>
              </div>
            ) : isCancelledOrRefunded ? (
              <div className="receipt-badge pending" style={{ color: 'var(--red-600)' }}>
                <XCircle size={16} />
                <span>
                  {language === 'ar' ? 'الطلب ملغى / مسترد' : 'Order Cancelled / Refunded'}
                </span>
              </div>
            ) : isFailed ? (
              <div className="receipt-badge" style={{ color: 'var(--red-600)' }}>
                <XCircle size={16} />
                <span>{language === 'ar' ? 'فشل الدفع' : 'Payment Failed'}</span>
              </div>
            ) : isCod ? (
              <div className="receipt-badge cod">
                <Clock size={16} />
                <span>
                  {language === 'ar'
                    ? 'في انتظار التحصيل عند الاستلام'
                    : 'Collection on Delivery Pending'}
                </span>
              </div>
            ) : (
              <div className="receipt-badge pending">
                <Clock size={16} />
                <span>{language === 'ar' ? 'في انتظار الدفع' : 'Payment Pending'}</span>
              </div>
            )}
          </div>
        </header>

        {isFailed && (
          <div
            className="card print-hide"
            role="alert"
            style={{ border: '1px solid var(--red-600)', padding: 16, marginBottom: 16 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--red-600)', fontWeight: 600 }}>
              <AlertCircle size={18} />
              <span>{language === 'ar' ? 'تعذرت معالجة الدفع لهذا الطلب.' : 'We could not process the payment for this order.'}</span>
            </div>
            <p style={{ margin: '8px 0 12px' }}>
              {language === 'ar'
                ? 'يمكنك إعادة محاولة الدفع لهذا الطلب، أو إنشاء طلب جديد واختيار طريقة دفع أخرى.'
                : 'You can retry the payment for this order, or place a new order and choose another payment method.'}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {order.paymentMethod === 'stripe' && (
                <button
                  type="button"
                  className="btn btn-sm btn-purple"
                  onClick={() => void handlePayStripeNow()}
                  disabled={startingStripe}
                >
                  <CreditCard size={14} />
                  <span>{language === 'ar' ? 'إعادة محاولة الدفع' : 'Retry payment'}</span>
                </button>
              )}
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => navigate('/cart')}
              >
                <ArrowLeft size={14} />
                <span>{language === 'ar' ? 'طلب جديد' : 'Place a new order'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Order Meta Bar */}
        <div className="receipt-meta-grid">
          <div className="receipt-meta-cell">
            <span className="meta-label">
              {language === 'ar' ? 'رقم الطلب:' : 'Order Number:'}
            </span>
            <div className="meta-value-copy">
              <strong>
                <bdi>{order.orderNumber}</bdi>
              </strong>
              <button
                type="button"
                className="receipt-copy-btn print-hide"
                onClick={() => void handleCopyOrderNumber()}
                title={t('copyOrderNumber')}
                aria-label={t('copyOrderNumber')}
              >
                <Copy size={13} />
                <span>{copied ? t('copied') : ''}</span>
              </button>
            </div>
          </div>

          <div className="receipt-meta-cell">
            <span className="meta-label">
              {language === 'ar' ? 'تاريخ ووقت الطلب:' : 'Date & Time:'}
            </span>
            <strong className="meta-value">
              {new Date(order.createdAt).toLocaleString(
                language === 'ar' ? 'ar-EG' : 'en-US',
                {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }
              )}
            </strong>
          </div>

          <div className="receipt-meta-cell">
            <span className="meta-label">
              {language === 'ar' ? 'اسم العميل:' : 'Customer Name:'}
            </span>
            <strong className="meta-value">{order.customerName}</strong>
          </div>

          <div className="receipt-meta-cell">
            <span className="meta-label">
              {language === 'ar' ? 'الهاتف المحمول:' : 'Mobile Phone:'}
            </span>
            <strong className="meta-value" dir="ltr">
              {maskPhoneNumber(order.customerPhoneMasked)}
            </strong>
          </div>

          <div className="receipt-meta-cell">
            <span className="meta-label">
              {language === 'ar' ? 'طريقة الدفع:' : 'Payment Method:'}
            </span>
            <strong className="meta-value">
              {order.paymentMethod === 'cod'
                ? language === 'ar'
                  ? 'الدفع عند الاستلام (Cash on Delivery)'
                  : 'Cash on Delivery'
                : language === 'ar'
                  ? 'بطاقة بنكية عبر Stripe (Stripe Hosted Checkout)'
                  : 'Stripe Hosted Card Checkout'}
            </strong>
          </div>

          {order.transactionReference && (
            <div className="receipt-meta-cell">
              <span className="meta-label">
                {language === 'ar' ? 'المرجع البنكي / المعاملة:' : 'Transaction Reference:'}
              </span>
              <strong className="meta-value mono">{order.transactionReference}</strong>
            </div>
          )}
        </div>

        {/* Itemized Table */}
        <div className="receipt-table-wrapper">
          <table className="receipt-table">
            <thead>
              <tr>
                <th>{language === 'ar' ? 'القطعة والبيانات' : 'Item Description'}</th>
                <th>{language === 'ar' ? 'اللون' : 'Color'}</th>
                <th>{language === 'ar' ? 'المقاس' : 'Size'}</th>
                <th className="num">{language === 'ar' ? 'الكمية' : 'Qty'}</th>
                <th className="num">{language === 'ar' ? 'سعر الوحدة' : 'Unit Price'}</th>
                <th className="num">{language === 'ar' ? 'الإجمالي' : 'Total'}</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, idx) => (
                <tr key={idx}>
                  <td>
                    <div className="receipt-item-flex">
                      {item.imageUrl && (
                        <div className="receipt-item-thumb">
                          <GarmentImage
                            src={item.imageUrl}
                            alt={item.productName}
                            categoryName={item.categoryName ?? undefined}
                            aspectRatio="4/5"
                          />
                        </div>
                      )}
                      <div>
                        <div className="receipt-item-name">
                          <bdi>{item.productName}</bdi>
                        </div>
                        {item.categoryName && (
                          <div className="receipt-item-sub">{item.categoryName}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{item.colorName || '—'}</td>
                  <td>
                    <span className="receipt-size-pill">
                      <bdi>{item.size || (language === 'ar' ? 'مقاس موحد' : 'One Size')}</bdi>
                    </span>
                  </td>
                  <td className="num">
                    <bdi dir="ltr">{item.quantity}</bdi>
                  </td>
                  <td className="num">
                    <bdi dir="ltr">{formatEgp(item.unitPriceEgp, language)}</bdi>
                  </td>
                  <td className="num bold">
                    <bdi dir="ltr">{formatEgp(item.lineTotalEgp, language)}</bdi>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Financial Breakdown */}
        <div className="receipt-totals-section">
          <div className="receipt-totals-box">
            <div className="totals-row">
              <span>{language === 'ar' ? 'المجموع الفرعي:' : 'Subtotal:'}</span>
              <span>{formatEgp(order.subtotalEgp, language)}</span>
            </div>

            {order.discountEgp > 0 && (
              <div className="totals-row discount">
                <span>
                  {language === 'ar'
                    ? `خصم نقاط الولاء (${order.pointsRedeemed} نقطة):`
                    : `Loyalty Points Discount (${order.pointsRedeemed} pts):`}
                </span>
                <span>-{formatEgp(order.discountEgp, language)}</span>
              </div>
            )}

            <div className="totals-row">
              <span>{language === 'ar' ? 'الشحن والتوصيل:' : 'Delivery Shipping:'}</span>
              <span className="free">{language === 'ar' ? 'مجاني' : 'Free'}</span>
            </div>

            <div className="totals-row final-total">
              <span>
                {language === 'ar' ? 'المبلغ النهائي المستحق:' : 'Total Payable Amount:'}
              </span>
              <span className="final-amount">{formatEgp(order.finalTotalEgp, language)}</span>
            </div>
          </div>
        </div>

        {/* Loyalty Rewards Summary — Strictly reflects backend OrderDto & payment timing rules */}
        <div className="receipt-rewards-card">
          <div className="rewards-icon-wrap" aria-hidden="true">
            <Gift size={20} />
          </div>
          <div className="rewards-content">
            <div className="rewards-title">
              {language === 'ar' ? 'مكافآت برنامج نقاط الولاء' : 'Loyalty Program Summary'}
            </div>
            <p className="rewards-desc">
              {isCancelledOrRefunded
                ? language === 'ar'
                  ? `لم يتم منح نقاط ولاء لهذا الطلب الملغى.${
                      order.pointsRedeemed > 0
                        ? ` تمت إعادة النقاط المحتجزة (${order.pointsRedeemed} نقطة) إلى رصيدك.`
                        : ''
                    }`
                  : `No loyalty points were awarded for this cancelled order.${
                      order.pointsRedeemed > 0
                        ? ` Your ${order.pointsRedeemed} held redeemed points have been returned to your balance.`
                        : ''
                    }`
                : isPaid
                  ? language === 'ar'
                    ? `تمت إضافة +${order.pointsEarned} نقطة ولاء لرصيدك بنجاح بعد التحقق من الدفع الإلكتروني.`
                    : `You earned +${order.pointsEarned} loyalty points following verified payment confirmation.`
                  : isCod
                    ? language === 'ar'
                      ? `تمت إضافة +${order.pointsEarned} نقطة ولاء فوراً لرصيدك عند تأكيد طلب الدفع عند الاستلام.`
                      : `You earned +${order.pointsEarned} loyalty points immediately upon placing this Cash on Delivery order.`
                    : language === 'ar'
                      ? `النقاط المكتسبة حالياً: 0 نقطة. ستتم إضافة +${expectedPointsOnVerify} نقطة ولاء لرصيدك فور إتمام والتحقق من الدفع الإلكتروني عبر Stripe.`
                      : `Points earned so far: 0 pts. You will earn +${expectedPointsOnVerify} loyalty points once Stripe card payment is completed and verified.`}
            </p>
            {typeof order.updatedLoyaltyBalance === 'number' && (
              <div className="rewards-balance-pill">
                {language === 'ar' ? 'رصيد النقاط المحدث:' : 'Updated Points Balance:'}{' '}
                <strong>
                  {order.updatedLoyaltyBalance} {language === 'ar' ? 'نقطة' : 'points'}
                </strong>
              </div>
            )}
          </div>
        </div>

        {/* Footer Note */}
        <footer className="receipt-footer">
          <p>
            {language === 'ar'
              ? 'شكراً لتسوقك من TryOnStudio. هذا إيصال إلكتروني صادر عن النظام لحفظ حق العميل.'
              : 'Thank you for shopping at TryOnStudio. This is an official digital receipt generated from persisted order records.'}
          </p>
          <div className="receipt-watermark">
            TRYONSTUDIO · VERIFIED ORDER ID · {order.orderNumber}
          </div>
        </footer>
      </article>
    </div>
  );
}
