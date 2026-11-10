import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  Gift,
  Printer,
  RefreshCw,
} from 'lucide-react';
import { useCommerce } from '../CommerceContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { GarmentImage } from '../../components/GarmentImage';
import { commerceApi } from '../../services/commerceApi';
import type { PersistedOrder } from '../../types/commerce';
import { formatEgp, maskPhoneNumber } from '../../utils/commerceHelpers';

export function ReceiptPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const [searchParams] = useSearchParams();
  const { language, t } = useLanguage();
  const { recentConfirmedOrders, recordConfirmedOrder } = useCommerce();
  const navigate = useNavigate();

  const [order, setOrder] = useState<PersistedOrder | null>(() => {
    if (orderNumber && recentConfirmedOrders[orderNumber]) {
      return recentConfirmedOrders[orderNumber];
    }
    return null;
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [verifiedStripe, setVerifiedStripe] = useState(false);

  const sessionId = searchParams.get('session_id');

  const orderRef = useRef(order);
  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  const recentConfirmedOrdersRef = useRef(recentConfirmedOrders);
  useEffect(() => {
    recentConfirmedOrdersRef.current = recentConfirmedOrders;
  }, [recentConfirmedOrders]);

  // Load or verify order
  useEffect(() => {
    const targetOrderNumber = orderNumber;
    if (!targetOrderNumber) return;

    let active = true;

    async function loadAndVerify(resolvedNum: string) {
      setLoading(true);
      setError(null);

      try {
        let currentOrder = orderRef.current ?? recentConfirmedOrdersRef.current[resolvedNum];

        // If returned from Stripe with session_id, verify payment with server
        if (sessionId && !verifiedStripe) {
          try {
            const verification = await commerceApi.verifyStripeSession(sessionId);
            if (verification.paymentStatus === 'paid') {
              if (currentOrder) {
                currentOrder = {
                  ...currentOrder,
                  paymentStatus: 'paid',
                  orderStatus: 'confirmed',
                  transactionReference: verification.transactionReference,
                  pointsEarned: Math.floor(currentOrder.finalTotalEgp / 10),
                };
                recordConfirmedOrder(currentOrder);
              }
              setVerifiedStripe(true);

              // Notify authoritative backend to confirm Stripe payment and update order
              try {
                const confirmedRemote = await commerceApi.confirmOrderStripeSession(
                  resolvedNum,
                  sessionId
                );
                if (confirmedRemote && active) {
                  currentOrder = {
                    ...confirmedRemote,
                    receiptAccessToken:
                      confirmedRemote.receiptAccessToken ||
                      currentOrder?.receiptAccessToken ||
                      null,
                  };
                  setOrder(currentOrder);
                  recordConfirmedOrder(currentOrder);
                }
              } catch (confirmErr) {
                console.error('[receipt] Backend Stripe payment confirmation error:', confirmErr);
              }
            }
          } catch (err) {
            console.error('[receipt] Stripe session verification error:', err);
          }
        }

        // Attempt fetching authoritative order from backend using receipt token if available
        try {
          const receiptToken = currentOrder?.receiptAccessToken ?? null;
          const remoteOrder = await commerceApi.getOrder(resolvedNum, receiptToken);
          if (active) {
            const mergedOrder: PersistedOrder = {
              ...remoteOrder,
              receiptAccessToken:
                remoteOrder.receiptAccessToken || receiptToken,
            };
            setOrder(mergedOrder);
            recordConfirmedOrder(mergedOrder);
            return;
          }
        } catch {
          // If remote fetch fails (e.g. 404 on external ASP.NET server), keep local confirmed record
          if (currentOrder && active) {
            setOrder(currentOrder);
            return;
          }
        }

        if (currentOrder && active) {
          setOrder(currentOrder);
        } else if (active) {
          setError(
            language === 'ar'
              ? 'لم يتم العثور على تفاصيل الطلب على الخادم.'
              : 'Could not find details for this order.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadAndVerify(targetOrderNumber);

    return () => {
      active = false;
    };
  }, [orderNumber, sessionId, verifiedStripe, recordConfirmedOrder, language]);

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
    try {
      const updated = await commerceApi.getOrder(orderNumber);
      setOrder(updated);
      recordConfirmedOrder(updated);
    } catch {
      // Keep existing
    } finally {
      setLoading(false);
    }
  };

  if (!order && loading) {
    return (
      <div className="receipt-loading card">
        <RefreshCw size={28} className="spin" color="var(--blue-600)" />
        <p>{language === 'ar' ? 'جاري استرجاع تفاصيل الإيصال...' : 'Retrieving official receipt details...'}</p>
      </div>
    );
  }

  if (!order && error) {
    return (
      <div className="receipt-empty card">
        <AlertCircle size={36} color="var(--red-600)" />
        <h2>{language === 'ar' ? 'تعذر العثور على الإيصال' : 'Receipt Not Found'}</h2>
        <p>{error}</p>
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
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => void handleRefreshStatus()}
            disabled={loading}
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
            ) : isCod ? (
              <div className="receipt-badge cod">
                <Clock size={16} />
                <span>{language === 'ar' ? 'في انتظار التحصيل عند الاستلام' : 'Collection on Delivery Pending'}</span>
              </div>
            ) : (
              <div className="receipt-badge pending">
                <Clock size={16} />
                <span>{language === 'ar' ? 'في انتظار الدفع' : 'Payment Pending'}</span>
              </div>
            )}
          </div>
        </header>

        {/* Order Meta Bar */}
        <div className="receipt-meta-grid">
          <div className="receipt-meta-cell">
            <span className="meta-label">{language === 'ar' ? 'رقم الطلب:' : 'Order Number:'}</span>
            <div className="meta-value-copy">
              <strong><bdi>{order.orderNumber}</bdi></strong>
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
            <span className="meta-label">{language === 'ar' ? 'تاريخ ووقت الطلب:' : 'Date & Time:'}</span>
            <strong className="meta-value">
              {new Date(order.createdAt).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </strong>
          </div>

          <div className="receipt-meta-cell">
            <span className="meta-label">{language === 'ar' ? 'اسم العميل:' : 'Customer Name:'}</span>
            <strong className="meta-value">{order.customerName}</strong>
          </div>

          <div className="receipt-meta-cell">
            <span className="meta-label">{language === 'ar' ? 'الهاتف المحمول:' : 'Mobile Phone:'}</span>
            <strong className="meta-value" dir="ltr">
              {maskPhoneNumber(order.customerPhoneMasked)}
            </strong>
          </div>

          <div className="receipt-meta-cell">
            <span className="meta-label">{language === 'ar' ? 'طريقة الدفع:' : 'Payment Method:'}</span>
            <strong className="meta-value">
              {order.paymentMethod === 'cod'
                ? 'Cash on Delivery (الدفع عند الاستلام)'
                : 'Stripe Hosted Card Checkout (بطاقة بنكية)'}
            </strong>
          </div>

          {order.transactionReference && (
            <div className="receipt-meta-cell">
              <span className="meta-label">{language === 'ar' ? 'المرجع البنكي / المعاملة:' : 'Transaction Reference:'}</span>
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
                        <div className="receipt-item-name"><bdi>{item.productName}</bdi></div>
                        {item.categoryName && (
                          <div className="receipt-item-sub">{item.categoryName}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{item.colorName || '—'}</td>
                  <td>
                    <span className="receipt-size-pill"><bdi>{item.size || (language === 'ar' ? 'مقاس موحد' : 'One Size')}</bdi></span>
                  </td>
                  <td className="num"><bdi dir="ltr">{item.quantity}</bdi></td>
                  <td className="num"><bdi dir="ltr">{formatEgp(item.unitPriceEgp, language)}</bdi></td>
                  <td className="num bold"><bdi dir="ltr">{formatEgp(item.lineTotalEgp, language)}</bdi></td>
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
              <span>{language === 'ar' ? 'المبلغ النهائي المستحق:' : 'Total Payable Amount:'}</span>
              <span className="final-amount">{formatEgp(order.finalTotalEgp, language)}</span>
            </div>
          </div>
        </div>

        {/* Loyalty Rewards Summary */}
        <div className="receipt-rewards-card">
          <div className="rewards-icon-wrap" aria-hidden="true">
            <Gift size={20} />
          </div>
          <div className="rewards-content">
            <div className="rewards-title">
              {language === 'ar' ? 'مكافآت برنامج نقاط الولاء' : 'Loyalty Program Summary'}
            </div>
            <p className="rewards-desc">
              {isPaid
                ? language === 'ar'
                  ? `تمت إضافة +${order.pointsEarned} نقطة ولاء لرصيدك بنجاح لهذه العملية.`
                  : `You earned +${order.pointsEarned} loyalty points from this confirmed transaction.`
                : language === 'ar'
                  ? `ستتم إضافة +${order.pointsEarned} نقطة لرصيدك تلقائياً عند تأكيد تسليم وتحصيل الطلب.`
                  : `+${order.pointsEarned} loyalty points will be awarded automatically once payment is collected.`}
            </p>
            {typeof order.updatedLoyaltyBalance === 'number' && (
              <div className="rewards-balance-pill">
                {language === 'ar' ? 'رصيد النقاط الحالي:' : 'Current Points Balance:'}{' '}
                <strong>{order.updatedLoyaltyBalance} {language === 'ar' ? 'نقطة' : 'points'}</strong>
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
