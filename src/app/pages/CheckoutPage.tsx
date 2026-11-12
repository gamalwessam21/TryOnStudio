import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Check,
  Clock,
  CreditCard,
  ExternalLink,
  Gift,
  KeyRound,
  Loader2,
  Lock,
  Minus,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Truck,
  Zap,
} from 'lucide-react';
import { useCommerce } from '../CommerceContext';
import { useStudio } from '../StudioContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { GarmentImage } from '../../components/GarmentImage';
import { commerceApi } from '../../services/commerceApi';
import { ApiError } from '../../services/fashionApi';
import type {
  CartItem,
  CreateOrderPayload,
  PaymentMethodType,
  PersistedOrder,
} from '../../types/commerce';
import {
  buildCartLineKey,
  evaluatePointsRedemption,
  formatDualPrice,
  formatEgp,
  generateIdempotencyKey,
  validateCustomerInfo,
} from '../../utils/commerceHelpers';

export function CheckoutPage() {
  const { language, isRtl, t } = useLanguage();
  const {
    cartItems,
    cartTotalQuantity,
    updateCartItemQuantity,
    updateCartItemSize,
    updateCartItemVariant,
    removeCartItem,
    clearCart,
    checkoutMode,
    cartCheckoutReady,
    startCartCheckout,
    clearCheckoutDraft,
    checkoutDraft,
    updateCheckoutQuantity,
    updateCheckoutSize,
    updateCheckoutVariant,
    usdToEgpRate,
    stripeConfigured,
    stripeMode,
    loyaltyRules,
    loyaltyBackendAvailable,
    loyaltyAccount,
    loyaltyVerificationToken,
    loyaltyError,
    loyaltyRetryAfterSeconds,
    requestCustomerVerification,
    confirmCustomerVerification,
    refreshLoyaltyAccount,
    handleLoyaltyUnauthorized,
    recordConfirmedOrder,
    saveReceiptToken,
  } = useCommerce();

  const { itemDetailsCache, ensureItemDetails } = useStudio();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Form states
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('cod');
  const [pointsInput, setPointsInput] = useState<number>(0);
  const [formErrors, setFormErrors] = useState<{ fullName?: string; phone?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [cartNotice, setCartNotice] = useState<string | null>(null);

  // If POST /api/orders succeeds for a Stripe order, but Stripe Checkout session creation fails,
  // we hold the persisted order here so the customer can retry Stripe payment for the SAME order
  // or open the digital receipt without creating a duplicate order.
  const [pendingStripeOrder, setPendingStripeOrder] = useState<PersistedOrder | null>(null);
  const [retryingStripe, setRetryingStripe] = useState(false);

  // Loyalty verification inline state
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpExpiresIn, setOtpExpiresIn] = useState<number>(0);
  const [otpRetryAfter, setOtpRetryAfter] = useState<number>(0);

  // Determine effective checkout mode & active lines (never fallback to Studio selection when cart is empty)
  const isBuyNowMode = checkoutMode === 'buy_now' && Boolean(checkoutDraft);

  const buyNowLine: CartItem | null = useMemo(() => {
    if (!checkoutDraft) return null;
    return {
      ...checkoutDraft,
      lineKey: buildCartLineKey(
        checkoutDraft.fashionItemId,
        checkoutDraft.variantId,
        checkoutDraft.size
      ),
    };
  }, [checkoutDraft]);

  const activeLines: CartItem[] = useMemo(() => {
    if (isBuyNowMode) {
      return buyNowLine ? [buyNowLine] : [];
    }
    if (cartCheckoutReady) {
      return cartItems;
    }
    return [];
  }, [isBuyNowMode, buyNowLine, cartCheckoutReady, cartItems]);

  // Validate active checkout items against live catalog details
  useEffect(() => {
    activeLines.forEach((line) => {
      if (!itemDetailsCache[line.fashionItemId]) {
        void ensureItemDetails(line.fashionItemId);
      }
    });
  }, [activeLines, itemDetailsCache, ensureItemDetails]);

  // Countdown timers for OTP validity and rate-limit retry
  useEffect(() => {
    if (otpExpiresIn <= 0 && otpRetryAfter <= 0) return;
    const timer = window.setInterval(() => {
      setOtpExpiresIn((prev) => (prev > 0 ? prev - 1 : 0));
      setOtpRetryAfter((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [otpExpiresIn, otpRetryAfter]);

  // If redirected with cancel status from Stripe
  useEffect(() => {
    if (searchParams.get('stripe') === 'cancelled' || searchParams.get('payment') === 'cancelled') {
      setSubmissionError(
        language === 'ar'
          ? 'تم إلغاء عملية الدفع عبر Stripe. يمكنك المحاولة مرة أخرى أو اختيار الدفع عند الاستلام.'
          : 'Stripe Checkout was cancelled. You may retry or choose Cash on Delivery.'
      );
    }
  }, [searchParams, language]);

  // Derived price figures using authoritative catalog price when loaded
  const subtotalEgp = useMemo(() => {
    return activeLines.reduce((sum, line) => {
      const liveDetails = itemDetailsCache[line.fashionItemId];
      const unitUsd =
        liveDetails && typeof liveDetails.price === 'number' && liveDetails.price >= 0
          ? liveDetails.price
          : line.unitPriceUsd;
      const unitEgp = Math.round(unitUsd * usdToEgpRate);
      return sum + unitEgp * line.quantity;
    }, 0);
  }, [activeLines, itemDetailsCache, usdToEgpRate]);

  const totalUnitsCount = useMemo(
    () => activeLines.reduce((sum, line) => sum + line.quantity, 0),
    [activeLines]
  );

  // Points redemption calculation
  const redemptionPreview = evaluatePointsRedemption({
    requestedPoints: pointsInput,
    availablePoints: loyaltyAccount?.currentBalance ?? 0,
    subtotalEgp,
    rules: loyaltyRules,
    lang: language,
  });

  const appliedDiscountEgp = redemptionPreview.valid ? redemptionPreview.discountEgp : 0;
  const finalTotalEgp = Math.max(0, subtotalEgp - appliedDiscountEgp);

  // Potential points that will be earned on this purchase
  const potentialPointsEarned =
    Math.floor(finalTotalEgp / loyaltyRules.earnUnitAmountEgp) * loyaltyRules.pointsEarnedPerUnit;

  // Regenerate idempotencyKey (UUID) whenever order payload inputs change
  const payloadFingerprint = useMemo(() => {
    return JSON.stringify({
      mode: isBuyNowMode ? 'buy_now' : 'cart',
      items: activeLines.map((l) => ({
        fashionItemId: l.fashionItemId,
        variantId: l.variantId,
        size: l.size,
        quantity: l.quantity,
      })),
      fullName: fullName.trim(),
      phone: phone.trim(),
      paymentMethod,
      pointsToRedeem: appliedDiscountEgp > 0 ? redemptionPreview.pointsToRedeem : 0,
    });
  }, [
    isBuyNowMode,
    activeLines,
    fullName,
    phone,
    paymentMethod,
    appliedDiscountEgp,
    redemptionPreview.pointsToRedeem,
  ]);

  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => generateIdempotencyKey());
  const prevFingerprintRef = useRef(payloadFingerprint);

  useEffect(() => {
    if (prevFingerprintRef.current !== payloadFingerprint) {
      prevFingerprintRef.current = payloadFingerprint;
      setIdempotencyKey(generateIdempotencyKey());
    }
  }, [payloadFingerprint]);

  const hasMissingSize = useMemo(() => {
    return activeLines.some((line) => {
      const liveSizes = itemDetailsCache[line.fashionItemId]?.availableSizes ?? line.availableSizes;
      return liveSizes.length > 0 && !line.size;
    });
  }, [activeLines, itemDetailsCache]);

  const handleSendVerificationCode = async () => {
    const errors = validateCustomerInfo(fullName || 'Guest Customer', phone, language);
    if (errors.phone) {
      setFormErrors((prev) => ({ ...prev, phone: errors.phone }));
      return;
    }
    setOtpLoading(true);
    setOtpError(null);
    const res = await requestCustomerVerification(phone);
    setOtpLoading(false);
    if (res.challengeSent) {
      setOtpSent(true);
      setOtpExpiresIn(res.expiresInSeconds && res.expiresInSeconds > 0 ? res.expiresInSeconds : 300);
    } else {
      if (res.retryAfterSeconds && res.retryAfterSeconds > 0) {
        setOtpRetryAfter(res.retryAfterSeconds);
      }
      setOtpError(
        res.message ||
          (language === 'ar'
            ? 'تعذر إرسال رمز التحقق. يرجى التأكد من رقم الهاتف أو المتابعة بدون خصم النقاط.'
            : 'Could not send verification challenge. Please check phone number or continue without points.')
      );
    }
  };

  const handleConfirmVerificationCode = async () => {
    if (!otpCode.trim()) return;
    setOtpLoading(true);
    setOtpError(null);
    const verified = await confirmCustomerVerification(phone, otpCode.trim());
    setOtpLoading(false);
    if (!verified) {
      if (loyaltyRetryAfterSeconds && loyaltyRetryAfterSeconds > 0) {
        setOtpRetryAfter(loyaltyRetryAfterSeconds);
      }
      setOtpError(
        loyaltyError ||
          (language === 'ar' ? 'رمز التحقق غير صحيح.' : 'Invalid verification code.')
      );
    } else {
      setOtpSent(false);
      setOtpCode('');
      setOtpExpiresIn(0);
    }
  };

  const handleRetryStripeSession = async (orderToPay: PersistedOrder) => {
    setRetryingStripe(true);
    setSubmissionError(null);
    try {
      if (orderToPay.checkoutUrl) {
        window.location.href = orderToPay.checkoutUrl;
        return;
      }
      const stripeSession = await commerceApi.createStripeCheckoutSession({
        orderNumber: orderToPay.orderNumber,
        receiptAccessToken: orderToPay.receiptAccessToken ?? null,
        idempotencyKey: generateIdempotencyKey(),
      });
      if (stripeSession.checkoutUrl) {
        window.location.href = stripeSession.checkoutUrl;
        return;
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : language === 'ar'
            ? 'تعذر بدء جلسة الدفع عبر Stripe. يرجى المحاولة مرة أخرى.'
            : 'Could not start Stripe Checkout session. Please try again.';
      setSubmissionError(msg);
    } finally {
      setRetryingStripe(false);
    }
  };

  const handlePlaceOrder = async (e: FormEvent) => {
    e.preventDefault();
    setSubmissionError(null);
    setCartNotice(null);

    if (activeLines.length === 0) {
      setSubmissionError(
        language === 'ar'
          ? 'يرجى اختيار منتج واحد على الأقل للشراء.'
          : 'Please select at least one clothing item to purchase.'
      );
      return;
    }

    if (activeLines.length > 20) {
      setSubmissionError(
        language === 'ar'
          ? 'الحد الأقصى للطلب الواحد هو 20 منتجاً مختلفاً.'
          : 'Maximum of 20 distinct line items allowed per order.'
      );
      return;
    }

    if (hasMissingSize) {
      setSubmissionError(
        language === 'ar'
          ? 'يرجى اختيار المقاس المطلوب لجميع القطع قبل المتابعة.'
          : 'Please select a size for all garments that require a size before proceeding.'
      );
      return;
    }

    const invalidQty = activeLines.some((line) => line.quantity < 1 || line.quantity > 20);
    if (invalidQty) {
      setSubmissionError(
        language === 'ar'
          ? 'يجب أن تكون الكمية لكل قطعة بين 1 و 20.'
          : 'Quantity for each item must be between 1 and 20.'
      );
      return;
    }

    const errors = validateCustomerInfo(fullName, phone, language);
    setFormErrors(errors);
    if (errors.fullName || errors.phone) {
      return;
    }

    if (paymentMethod === 'stripe' && finalTotalEgp <= 0) {
      setSubmissionError(
        language === 'ar'
          ? 'لا يمكن الدفع بالبطاقة عندما يكون الإجمالي النهائي 0 ج.م. يرجى اختيار الدفع عند الاستلام أو تقليل النقاط المستبدلة.'
          : 'Stripe Checkout cannot be used when the payable total is 0 EGP. Please choose Cash on Delivery or reduce redeemed points.'
      );
      return;
    }

    setSubmitting(true);

    const payload: CreateOrderPayload = {
      items: activeLines.map((line) => ({
        fashionItemId: line.fashionItemId,
        variantId: line.variantId,
        size: line.size,
        quantity: line.quantity,
      })),
      customer: {
        fullName: fullName.trim(),
        phone: phone.trim(),
      },
      paymentMethod,
      pointsToRedeem: appliedDiscountEgp > 0 ? redemptionPreview.pointsToRedeem : 0,
      loyaltyVerificationToken: appliedDiscountEgp > 0 ? loyaltyVerificationToken : null,
    };

    try {
      const order = await commerceApi.createOrder(payload, idempotencyKey);

      // Step 2: Immediately persist receiptAccessToken and confirmed order BEFORE redirecting or making another request
      if (order.receiptAccessToken) {
        saveReceiptToken(order.orderNumber, order.receiptAccessToken);
      }
      recordConfirmedOrder(order);

      // Clear persisted cart ONLY if this checkout was placed in 'cart' mode (never clear tys.cart for isolated 'buy_now')
      if (!isBuyNowMode) {
        clearCart();
      }

      // Step 3 & 4: Handle Stripe Hosted Checkout redirect
      if (paymentMethod === 'stripe') {
        if (order.checkoutUrl) {
          window.location.href = order.checkoutUrl;
          return;
        }

        try {
          const stripeSession = await commerceApi.createStripeCheckoutSession({
            orderNumber: order.orderNumber,
            receiptAccessToken: order.receiptAccessToken ?? null,
            idempotencyKey,
          });

          if (stripeSession.checkoutUrl) {
            window.location.href = stripeSession.checkoutUrl;
            return;
          }
        } catch (stripeErr: unknown) {
          console.error('[checkout] Stripe session creation failed after order creation:', stripeErr);
          setPendingStripeOrder(order);
          const msg =
            stripeErr instanceof Error
              ? stripeErr.message
              : language === 'ar'
                ? 'تم إنشاء الطلب بنجاح، ولكن تعذر فتح صفحة الدفع عبر Stripe. يمكنك إعادة محاولة الدفع لنفس الطلب أدناه.'
                : 'Your order was created, but we could not open Stripe Checkout. You can safely retry payment for this order below.';
          setSubmissionError(msg);
          return;
        }
      }

      // COD or completed order redirect to Digital Receipt
      navigate(`/orders/${encodeURIComponent(order.orderNumber)}`);
    } catch (err: unknown) {
      console.error('[checkout] Order submission error:', err);

      if (err instanceof ApiError) {
        if (err.status === 401) {
          handleLoyaltyUnauthorized();
          setPointsInput(0);
          setSubmissionError(
            language === 'ar'
              ? 'انتهت صلاحية رمز التحقق من نقاط الولاء (30 دقيقة). يرجى إعادة التحقق من رقم هاتفك أو إتمام الطلب بدون استبدال النقاط.'
              : 'Your loyalty verification token expired (30-minute limit). Please re-verify your phone number or submit without redeeming points.'
          );
          return;
        }

        if (err.status === 409 && err.code === 'balance_changed') {
          void refreshLoyaltyAccount();
          setPointsInput(0);
          setSubmissionError(
            language === 'ar'
              ? 'تغير رصيد نقاط الولاء الخاص بك. تم تحديث الرصيد، يرجى مراجعة الخصم والمحاولة مرة أخرى.'
              : 'Your loyalty points balance has changed. We refreshed your balance—please review your points selection and try again.'
          );
          return;
        }

        if (err.status === 409 && err.code === 'idempotency_key_reused') {
          setIdempotencyKey(generateIdempotencyKey());
          setSubmissionError(
            language === 'ar'
              ? 'تم تحديث مفتاح الأمان للطلب بعد تغيير البيانات. يرجى الضغط على إتمام الطلب مرة أخرى.'
              : 'Order security key was refreshed for your updated details. Please click Place Order again.'
          );
          return;
        }

        if (err.status === 400 && err.code === 'zero_payable_total') {
          setSubmissionError(
            language === 'ar'
              ? 'لا يمكن استخدام الدفع بالبطاقة عندما يكون المبلغ المستحق 0 ج.م. يرجى اختيار الدفع عند الاستلام أو تقليل النقاط المستبدلة.'
              : 'Card payment is not available when the payable total is 0 EGP. Please select Cash on Delivery or reduce redeemed points.'
          );
          return;
        }

        if (err.status === 429) {
          const waitSec = err.retryAfterSeconds ?? 30;
          setSubmissionError(
            language === 'ar'
              ? `تم تجاوز الحد المسموح به للطلبات. يرجى الانتظار ${waitSec} ثانية قبل المحاولة مرة أخرى.`
              : `Too many requests. Please wait ${waitSec} seconds before trying again.`
          );
          return;
        }
      }

      const msg = err instanceof Error ? err.message : String(err);
      setSubmissionError(
        msg || (language === 'ar' ? 'تعذر إتمام الطلب.' : 'Could not complete order.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  // If an order was already created on the backend and is awaiting Stripe session retry
  if (pendingStripeOrder) {
    return (
      <div className="checkout-page">
        <div className="card" style={{ maxWidth: 640, margin: '32px auto', padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <AlertCircle size={28} color="var(--purple-600)" />
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                {language === 'ar'
                  ? 'تم حفظ طلبك — في انتظار إتمام الدفع عبر Stripe'
                  : 'Order Saved — Awaiting Stripe Payment'}
              </h1>
              <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {language === 'ar' ? 'رقم الطلب:' : 'Order Number:'}{' '}
                <strong>
                  <bdi>{pendingStripeOrder.orderNumber}</bdi>
                </strong>{' '}
                •{' '}
                <bdi dir="ltr">{formatEgp(pendingStripeOrder.finalTotalEgp, language)}</bdi>
              </p>
            </div>
          </div>

          {submissionError && (
            <div className="banner banner-error" role="alert" style={{ marginBottom: 16 }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{submissionError}</span>
            </div>
          )}

          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
            {language === 'ar'
              ? 'تم تسجيل طلبك وحفظ رمز الوصول للإيصال بنجاح. يمكنك إعادة محاولة فتح بوابة الدفع عبر Stripe لنفس الطلب دون إنشاء طلب مكرر، أو عرض الإيصال الرقمي لمتابعة حالة الطلب.'
              : 'Your order and receipt access token have been safely recorded. You can retry launching Stripe Checkout for this exact order without creating a duplicate order, or view your order receipt.'}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <button
              type="button"
              className="btn btn-purple"
              disabled={retryingStripe}
              onClick={() => void handleRetryStripeSession(pendingStripeOrder)}
            >
              {retryingStripe ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              <span>
                {language === 'ar'
                  ? 'إعادة محاولة الدفع عبر Stripe'
                  : 'Retry Stripe Payment'}
              </span>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                navigate(`/orders/${encodeURIComponent(pendingStripeOrder.orderNumber)}`)
              }
            >
              <ExternalLink size={16} />
              <span>
                {language === 'ar' ? 'عرض إيصال الطلب' : 'View Order Receipt'}
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activeLines.length === 0) {
    return (
      <div className="checkout-empty-state card">
        <AlertCircle size={40} color="var(--blue-600)" />
        <h2>
          {language === 'ar'
            ? 'لا توجد منتجات محددة للشراء'
            : 'No garments selected for purchase'}
        </h2>
        <p>
          {language === 'ar'
            ? 'تصفح الكتالوج لإضافة قطع إلى سلة التسوق أو استخدام الشراء السريع.'
            : 'Browse our catalog to add garments to your cart or use Buy Now.'}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/browse')}
          >
            <span>{t('navBrowse')}</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/cart')}
          >
            <ShoppingBag size={16} />
            <span>{t('navCart')}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <div className="checkout-header-block">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <h1 className="checkout-main-title">{t('checkoutTitle')}</h1>
            <p className="checkout-main-subtitle">{t('checkoutSubtitle')}</p>
          </div>

          {/* Checkout Mode Indicator & Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              className="badge"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 999,
                fontSize: '0.8rem',
                fontWeight: 600,
                background: isBuyNowMode ? 'var(--purple-50, #f5f3ff)' : 'var(--blue-50, #eff6ff)',
                color: isBuyNowMode ? 'var(--purple-700, #6d28d9)' : 'var(--blue-700, #1d4ed8)',
                border: '1px solid currentColor',
              }}
            >
              {isBuyNowMode ? <Zap size={14} /> : <ShoppingBag size={14} />}
              <span>
                {isBuyNowMode
                  ? language === 'ar'
                    ? 'وضع الشراء السريع (معزول عن السلة)'
                    : 'Express Buy Now Mode (Isolated from Cart)'
                  : language === 'ar'
                    ? `إتمام شراء السلة (${activeLines.length} منتجات)`
                    : `Cart Checkout (${activeLines.length} ${activeLines.length === 1 ? 'item' : 'items'})`}
              </span>
            </span>

            {isBuyNowMode && cartTotalQuantity > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => startCartCheckout()}
              >
                <ShoppingBag size={14} />
                <span>
                  {language === 'ar'
                    ? `التبديل إلى سلة التسوق (${cartTotalQuantity})`
                    : `Switch to Saved Cart (${cartTotalQuantity})`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {submissionError && (
        <div className="banner banner-error" role="alert">
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{submissionError}</span>
        </div>
      )}

      {cartNotice && (
        <div className="banner banner-info" role="status" style={{ marginBottom: 16 }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{cartNotice}</span>
        </div>
      )}

      <form className="checkout-grid" onSubmit={(e) => void handlePlaceOrder(e)}>
        {/* Left Column: Line Items + Customer Info + Payment + Loyalty */}
        <div className="checkout-form-col">
          {/* Step 1: Selected Items Summary & Inline Size/Variant/Quantity Pickers */}
          <section className="card checkout-card" aria-label="Selected Items">
            <div
              className="checkout-card-header"
              style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="checkout-step-badge">1</span>
                <h2>
                  {isBuyNowMode
                    ? language === 'ar'
                      ? 'القطعة المحددة للشراء السريع'
                      : 'Selected Item (Buy Now)'
                    : language === 'ar'
                      ? `منتجات الطلب (${activeLines.length})`
                      : `Order Items (${activeLines.length})`}
                </h2>
              </div>

              {!isBuyNowMode && (
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => navigate('/cart')}
                >
                  <ShoppingBag size={14} />
                  <span>{language === 'ar' ? 'تعديل في السلة' : 'Edit in Cart'}</span>
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {activeLines.map((line) => {
                const liveDetails = itemDetailsCache[line.fashionItemId];
                const availableVariants = liveDetails?.variants ?? [];
                const availableSizes =
                  liveDetails?.availableSizes && liveDetails.availableSizes.length > 0
                    ? liveDetails.availableSizes
                    : line.availableSizes;
                const unitUsd =
                  liveDetails && typeof liveDetails.price === 'number'
                    ? liveDetails.price
                    : line.unitPriceUsd;
                const lineUnitEgp = Math.round(unitUsd * usdToEgpRate);

                return (
                  <div
                    key={line.lineKey}
                    className="checkout-item-preview"
                    style={{
                      paddingBottom: activeLines.length > 1 ? 16 : 0,
                      borderBottom:
                        activeLines.length > 1 ? '1px solid var(--border-subtle, #e2e8f0)' : 'none',
                    }}
                  >
                    <div className="checkout-item-thumb">
                      <GarmentImage
                        src={line.imageUrl}
                        alt={line.name}
                        categoryName={line.categoryName}
                        colorHex={line.colorHex ?? undefined}
                        aspectRatio="4/5"
                      />
                    </div>

                    <div className="checkout-item-details">
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 8,
                        }}
                      >
                        <div>
                          <div className="checkout-item-cat">{line.categoryName}</div>
                          <h3 className="checkout-item-name">
                            <bdi>{line.name}</bdi>
                          </h3>
                        </div>

                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => {
                            removeCartItem(line.lineKey);
                            if (isBuyNowMode) {
                              clearCheckoutDraft();
                            }
                          }}
                          aria-label={
                            language === 'ar'
                              ? `حذف ${line.name}`
                              : `Remove ${line.name}`
                          }
                          style={{ color: 'var(--red-600)' }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      {line.colorName && (
                        <div className="checkout-item-color">
                          <span
                            className="swatch-dot"
                            style={{ backgroundColor: line.colorHex || '#94a3b8' }}
                            aria-hidden="true"
                          />
                          <span>{line.colorName}</span>
                        </div>
                      )}

                      {/* Color Variant Selector if multiple variants exist */}
                      {availableVariants.length > 1 && (
                        <div style={{ marginTop: 8 }}>
                          <label className="checkout-field-label" style={{ fontSize: '0.78rem' }}>
                            {language === 'ar' ? 'اللون:' : 'Color:'}
                          </label>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                            {availableVariants.map((v) => {
                              const isCurrentVariant = line.variantId === v.id;
                              return (
                                <button
                                  key={v.id}
                                  type="button"
                                  className={`size-chip ${isCurrentVariant ? 'active' : ''}`}
                                  onClick={() => {
                                    if (isBuyNowMode) {
                                      updateCheckoutVariant(v);
                                    } else {
                                      const res = updateCartItemVariant(line.lineKey, v);
                                      if (!res.ok && res.message) setCartNotice(res.message);
                                      else if (res.merged) setCartNotice(res.message ?? null);
                                    }
                                  }}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                                >
                                  <span
                                    className="swatch-dot"
                                    style={{
                                      width: 10,
                                      height: 10,
                                      borderRadius: '50%',
                                      backgroundColor: v.colorHex || '#94a3b8',
                                    }}
                                  />
                                  <span>{v.colorName}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="checkout-item-price-row">
                        <span className="checkout-item-price-egp">
                          <bdi dir="ltr">{formatEgp(lineUnitEgp, language)}</bdi>
                        </span>
                        <span className="checkout-item-price-usd">
                          <bdi dir="ltr">(${unitUsd.toFixed(2)} USD)</bdi>
                        </span>
                      </div>

                      {/* Size Selection (Enforced if item offers sizes) */}
                      {availableSizes.length > 0 && (
                        <div className="checkout-size-selector-block">
                          <label className="checkout-field-label">
                            {language === 'ar' ? 'المقاس المطلوب *' : 'Selected Size *'}
                          </label>
                          <div className="sizes-pill-row">
                            {availableSizes.map((sz) => {
                              const isChosen = line.size === sz;
                              return (
                                <button
                                  key={sz}
                                  type="button"
                                  className={`size-chip ${isChosen ? 'active' : ''}`}
                                  onClick={() => {
                                    if (isBuyNowMode) {
                                      updateCheckoutSize(sz);
                                    } else {
                                      const res = updateCartItemSize(line.lineKey, sz);
                                      if (!res.ok && res.message) setCartNotice(res.message);
                                      else if (res.merged) setCartNotice(res.message ?? null);
                                    }
                                  }}
                                  aria-pressed={isChosen}
                                >
                                  <bdi>{sz}</bdi>
                                </button>
                              );
                            })}
                          </div>
                          {!line.size && (
                            <p className="checkout-size-warning">{t('selectSizeFirst')}</p>
                          )}
                        </div>
                      )}

                      {/* Quantity Controls */}
                      <div className="checkout-qty-row">
                        <label className="checkout-field-label">
                          {language === 'ar' ? 'الكمية:' : 'Quantity:'}
                        </label>
                        <div className="checkout-qty-controls">
                          <button
                            type="button"
                            className="qty-btn"
                            disabled={line.quantity <= 1}
                            onClick={() => {
                              if (isBuyNowMode) {
                                updateCheckoutQuantity(line.quantity - 1);
                              } else {
                                const res = updateCartItemQuantity(
                                  line.lineKey,
                                  line.quantity - 1
                                );
                                if (!res.ok && res.message) setCartNotice(res.message);
                              }
                            }}
                            aria-label="Decrease quantity"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="qty-value">{line.quantity}</span>
                          <button
                            type="button"
                            className="qty-btn"
                            disabled={line.quantity >= 20}
                            onClick={() => {
                              if (isBuyNowMode) {
                                updateCheckoutQuantity(line.quantity + 1);
                              } else {
                                const res = updateCartItemQuantity(
                                  line.lineKey,
                                  line.quantity + 1
                                );
                                if (!res.ok && res.message) setCartNotice(res.message);
                              }
                            }}
                            aria-label="Increase quantity"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Step 2: Customer Information Form */}
          <section className="card checkout-card" aria-label="Customer Information">
            <div className="checkout-card-header">
              <span className="checkout-step-badge">2</span>
              <h2>{t('customerInfoTitle')}</h2>
            </div>

            <div className="checkout-fields-stack">
              <div className="checkout-field-wrap">
                <label className="checkout-field-label" htmlFor="checkout-full-name">
                  {t('fullNameLabel')} <span className="req">*</span>
                </label>
                <input
                  id="checkout-full-name"
                  type="text"
                  className={`checkout-input ${formErrors.fullName ? 'has-error' : ''}`}
                  placeholder={t('fullNamePlaceholder')}
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (formErrors.fullName)
                      setFormErrors((prev) => ({ ...prev, fullName: undefined }));
                  }}
                  autoComplete="name"
                  required
                />
                {formErrors.fullName && (
                  <p className="checkout-field-error" role="alert">
                    {formErrors.fullName}
                  </p>
                )}
              </div>

              <div className="checkout-field-wrap">
                <label className="checkout-field-label" htmlFor="checkout-phone">
                  {t('phoneLabel')} <span className="req">*</span>
                </label>
                <input
                  id="checkout-phone"
                  type="tel"
                  className={`checkout-input ${formErrors.phone ? 'has-error' : ''}`}
                  placeholder={t('phonePlaceholder')}
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (formErrors.phone) setFormErrors((prev) => ({ ...prev, phone: undefined }));
                  }}
                  autoComplete="tel"
                  dir="ltr"
                  required
                />
                {formErrors.phone && (
                  <p className="checkout-field-error" role="alert">
                    {formErrors.phone}
                  </p>
                )}
                <span className="checkout-field-hint">
                  {language === 'ar'
                    ? 'يُستخدم رقم الهاتف لتأكيد الشحن وربط نقاط الولاء الخاصة بك.'
                    : 'Used for delivery coordination and identifying your loyalty account.'}
                </span>
              </div>
            </div>
          </section>

          {/* Step 3: Payment Method Selection */}
          <section className="card checkout-card" aria-label="Payment Method">
            <div className="checkout-card-header">
              <span className="checkout-step-badge">3</span>
              <h2>{t('paymentMethodTitle')}</h2>
            </div>

            <div className="checkout-payment-options">
              {/* Cash on Delivery */}
              <label
                className={`checkout-payment-option ${paymentMethod === 'cod' ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="cod"
                  checked={paymentMethod === 'cod'}
                  onChange={() => setPaymentMethod('cod')}
                />
                <div className="payment-option-icon">
                  <Truck size={22} color="var(--blue-600)" />
                </div>
                <div className="payment-option-content">
                  <div className="payment-option-title">{t('codTitle')}</div>
                  <div className="payment-option-desc">{t('codDesc')}</div>
                  <span className="payment-status-tag cod">
                    {language === 'ar' ? 'متاح بدون رسوم إضافية' : 'Zero Extra Surcharge'}
                  </span>
                </div>
              </label>

              {/* Stripe Hosted Checkout */}
              <label
                className={`checkout-payment-option ${paymentMethod === 'stripe' ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="stripe"
                  checked={paymentMethod === 'stripe'}
                  onChange={() => setPaymentMethod('stripe')}
                />
                <div className="payment-option-icon">
                  <CreditCard size={22} color="var(--purple-600)" />
                </div>
                <div className="payment-option-content">
                  <div className="payment-option-title">{t('stripeTitle')}</div>
                  <div className="payment-option-desc">{t('stripeDesc')}</div>
                  <span className="payment-status-tag stripe">
                    {stripeConfigured
                      ? stripeMode === 'sandbox'
                        ? 'Stripe Sandbox Active'
                        : 'Stripe Live'
                      : 'Sandbox Mode Active'}
                  </span>
                </div>
              </label>
            </div>
          </section>

          {/* Step 4: Loyalty Points Redemption ("Use My Points") */}
          <section className="card checkout-card loyalty-section" aria-label="Use My Loyalty Points">
            <div className="checkout-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Gift size={20} color="var(--purple-600)" />
                <h2>{t('usePointsTitle')}</h2>
              </div>
              <span className="loyalty-rate-pill">
                {loyaltyRules.redemptionBlockPoints} pts = {loyaltyRules.redemptionBlockValueEgp} EGP
              </span>
            </div>

            {/* Check if user is verified */}
            {!loyaltyVerificationToken ? (
              <div className="loyalty-unverified-box">
                <p>
                  {language === 'ar'
                    ? 'لحماية رصيد النقاط، يلزم التحقق من ملكية رقم الهاتف قبل استبدال أي نقاط متراكمة.'
                    : 'To protect your points balance, phone verification is required before redeeming existing points.'}
                </p>

                {!otpSent ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-purple"
                    onClick={() => void handleSendVerificationCode()}
                    disabled={otpLoading || otpRetryAfter > 0 || !phone.trim()}
                  >
                    {otpLoading ? (
                      <Loader2 size={14} className="spin" />
                    ) : (
                      <KeyRound size={14} />
                    )}
                    <span>
                      {otpRetryAfter > 0
                        ? language === 'ar'
                          ? `يرجى الانتظار (${otpRetryAfter}ث)`
                          : `Wait (${otpRetryAfter}s)`
                        : language === 'ar'
                          ? 'إرسال رمز التحقق لرقمي'
                          : 'Verify My Phone for Points'}
                    </span>
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="loyalty-otp-input-row">
                      <input
                        type="text"
                        className="checkout-input otp"
                        placeholder="Enter 6-digit code (e.g. 123456)"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        maxLength={8}
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => void handleConfirmVerificationCode()}
                        disabled={otpLoading || otpRetryAfter > 0 || !otpCode.trim()}
                      >
                        {otpLoading ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                        <span>{language === 'ar' ? 'تأكيد' : 'Confirm'}</span>
                      </button>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {otpExpiresIn > 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={12} />
                          {language === 'ar'
                            ? `ينتهي الرمز خلال ${otpExpiresIn} ثانية`
                            : `Code expires in ${otpExpiresIn}s`}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--red-600)' }}>
                          {language === 'ar'
                            ? 'انتهت صلاحية الرمز. اطلب رمزاً جديداً.'
                            : 'Code expired. Request a new code.'}
                        </span>
                      )}

                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        disabled={otpLoading || otpRetryAfter > 0}
                        onClick={() => void handleSendVerificationCode()}
                      >
                        <span>
                          {language === 'ar' ? 'إرسال رمز جديد' : 'Request New Code'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {otpError && <p className="checkout-field-error">{otpError}</p>}
                {loyaltyBackendAvailable === false && (
                  <p className="checkout-backend-note">
                    {language === 'ar'
                      ? 'ملاحظة: نقاط نهاية الولاء غير مفعلة على خادم الكتالوج حالياً، ويمكنك إتمام الطلب كضيف.'
                      : 'Note: Loyalty backend endpoints are pending server deployment; guest checkout is active.'}
                  </p>
                )}
              </div>
            ) : (
              <div className="loyalty-verified-box">
                <div className="loyalty-balance-strip">
                  <ShieldCheck size={18} color="var(--green-600)" />
                  <span>
                    {language === 'ar' ? 'الرصيد المتاح:' : 'Available Balance:'}{' '}
                    <strong>
                      {loyaltyAccount?.currentBalance ?? 0}{' '}
                      {language === 'ar' ? 'نقطة' : 'points'}
                    </strong>
                  </span>
                </div>

                <div className="loyalty-redeem-controls">
                  <label className="checkout-field-label" htmlFor="redeem-points-select">
                    {language === 'ar' ? 'النقاط المراد استبدالها:' : 'Points to redeem:'}
                  </label>
                  <select
                    id="redeem-points-select"
                    className="checkout-input"
                    value={pointsInput}
                    onChange={(e) => setPointsInput(Number(e.target.value))}
                  >
                    <option value={0}>
                      {language === 'ar' ? '0 نقاط (بدون خصم)' : '0 points (No discount)'}
                    </option>
                    {Array.from({
                      length: Math.floor(
                        (redemptionPreview.maxRedeemablePoints || 0) /
                          loyaltyRules.redemptionBlockPoints
                      ),
                    }).map((_, i) => {
                      const pts = (i + 1) * loyaltyRules.redemptionBlockPoints;
                      const disc =
                        (pts / loyaltyRules.redemptionBlockPoints) *
                        loyaltyRules.redemptionBlockValueEgp;
                      return (
                        <option key={pts} value={pts}>
                          {pts} {language === 'ar' ? 'نقطة' : 'pts'} = -{formatEgp(disc, language)}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {appliedDiscountEgp > 0 && (
                  <div className="loyalty-discount-applied-msg">
                    <Check size={16} color="var(--green-600)" />
                    <span>
                      {language === 'ar'
                        ? `تم تطبيق خصم بقيمة ${formatEgp(appliedDiscountEgp, language)} على الطلب.`
                        : `Applied ${formatEgp(appliedDiscountEgp, language)} discount to your total.`}
                    </span>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Order Summary & Place Order Action */}
        <aside className="checkout-summary-col">
          <div className="card checkout-summary-card">
            <h2 className="summary-title">{t('orderSummaryTitle')}</h2>

            <div className="summary-lines-stack">
              {activeLines.map((line) => {
                const liveDetails = itemDetailsCache[line.fashionItemId];
                const unitUsd =
                  liveDetails && typeof liveDetails.price === 'number'
                    ? liveDetails.price
                    : line.unitPriceUsd;
                const lineTotal = Math.round(unitUsd * usdToEgpRate) * line.quantity;
                return (
                  <div key={line.lineKey} className="summary-line">
                    <span>
                      <bdi>{line.name}</bdi>{' '}
                      {line.size ? `(${line.size})` : ''} × <bdi>{line.quantity}</bdi>
                    </span>
                    <span>
                      <bdi dir="ltr">{formatEgp(lineTotal, language)}</bdi>
                    </span>
                  </div>
                );
              })}

              <div className="summary-line" style={{ fontSize: '0.85rem', opacity: 0.85 }}>
                <span>
                  {language === 'ar'
                    ? `إجمالي القطع (${totalUnitsCount})`
                    : `Total Units (${totalUnitsCount})`}
                </span>
                <span>
                  <bdi dir="ltr">{formatEgp(subtotalEgp, language)}</bdi>
                </span>
              </div>

              {appliedDiscountEgp > 0 && (
                <div className="summary-line discount">
                  <span>
                    {language === 'ar' ? 'خصم نقاط الولاء' : 'Loyalty Points Discount'}
                  </span>
                  <span>
                    -<bdi dir="ltr">{formatEgp(appliedDiscountEgp, language)}</bdi>
                  </span>
                </div>
              )}

              <div className="summary-line">
                <span>{language === 'ar' ? 'الشحن' : 'Delivery Shipping'}</span>
                <span className="shipping-free">{language === 'ar' ? 'مجاني' : 'Free'}</span>
              </div>

              <div className="summary-line-total">
                <div>
                  <div className="summary-total-label">
                    {language === 'ar' ? 'الإجمالي النهائي' : 'Final Total'}
                  </div>
                  <div className="summary-total-sub">
                    <bdi dir="ltr">
                      {formatDualPrice(
                        finalTotalEgp / (usdToEgpRate || 50),
                        usdToEgpRate,
                        language
                      )}
                    </bdi>
                  </div>
                </div>
                <div className="summary-total-amount">
                  <bdi dir="ltr">{formatEgp(finalTotalEgp, language)}</bdi>
                </div>
              </div>
            </div>

            {/* Potential Points Banner with accurate COD vs Stripe timing */}
            <div className="summary-points-earn-banner">
              <Gift size={16} aria-hidden="true" />
              <span>
                {paymentMethod === 'cod'
                  ? language === 'ar'
                    ? `ستحصل على +${potentialPointsEarned} نقطة ولاء فور تأكيد طلب الدفع عند الاستلام.`
                    : `You will earn +${potentialPointsEarned} loyalty points immediately when this COD order is placed.`
                  : language === 'ar'
                    ? `ستحصل على +${potentialPointsEarned} نقطة ولاء فور التحقق من الدفع الإلكتروني عبر Stripe.`
                    : `You will earn +${potentialPointsEarned} loyalty points once Stripe card payment is verified.`}
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className={`btn ${paymentMethod === 'stripe' ? 'btn-purple' : 'btn-navy'} btn-block checkout-submit-btn`}
              disabled={submitting || hasMissingSize}
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="spin" aria-hidden="true" />
                  <span>{t('submittingOrder')}</span>
                </>
              ) : (
                <>
                  <Lock size={16} aria-hidden="true" />
                  <span>
                    {paymentMethod === 'stripe' ? t('placeOrderStripe') : t('placeOrderCod')}
                  </span>
                  {isRtl ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
                </>
              )}
            </button>

            <div className="checkout-trust-badges">
              <span>🔒 {language === 'ar' ? 'تشفير 256-bit آمن' : '256-bit Secure'}</span>
              <span>•</span>
              <span>{language === 'ar' ? 'أسعار معتمدة من الخادم' : 'Server-Verified Pricing'}</span>
              <span>•</span>
              <span>{language === 'ar' ? 'إيصال رسمي' : 'Official Receipt'}</span>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}
