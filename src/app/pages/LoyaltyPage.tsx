import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Check,
  Coins,
  Gift,
  HelpCircle,
  History,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useCommerce } from '../CommerceContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatEgp, maskPhoneNumber, validateCustomerInfo } from '../../utils/commerceHelpers';

export function LoyaltyPage() {
  const { language, isRtl, t } = useLanguage();
  const {
    loyaltyRules,
    loyaltyBackendAvailable,
    loyaltyAccount,
    loyaltyVerificationToken,
    loyaltyLoading,
    loyaltyError,
    requestCustomerVerification,
    confirmCustomerVerification,
    refreshLoyaltyAccount,
    clearLoyaltySession,
  } = useCommerce();

  const navigate = useNavigate();

  const [phoneInput, setPhoneInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [challengeMessage, setChallengeMessage] = useState<string | null>(null);

  const handleRequestCode = async () => {
    const errs = validateCustomerInfo('User Test', phoneInput, language);
    if (errs.phone) {
      setPhoneError(errs.phone);
      return;
    }
    setPhoneError(null);
    const res = await requestCustomerVerification(phoneInput.trim());
    if (res.challengeSent) {
      setCodeSent(true);
      setChallengeMessage(res.message || null);
    }
  };

  const handleConfirmCode = async () => {
    if (!codeInput.trim()) return;
    const ok = await confirmCustomerVerification(phoneInput.trim(), codeInput.trim());
    if (ok) {
      setCodeSent(false);
      setCodeInput('');
    }
  };

  return (
    <div className="loyalty-page">
      {/* Page Header */}
      <div className="loyalty-header-block">
        <div className="loyalty-header-icon" aria-hidden="true">
          <Gift size={28} />
        </div>
        <div>
          <h1 className="loyalty-main-title">{t('loyaltyTitle')}</h1>
          <p className="loyalty-main-subtitle">{t('loyaltySubtitle')}</p>
        </div>
      </div>

      {loyaltyError && (
        <div className="banner banner-error" role="alert">
          <AlertCircle size={17} style={{ flexShrink: 0 }} />
          <span>{loyaltyError}</span>
        </div>
      )}

      {/* Program Explainer Cards (3 Core Pillars) */}
      <section className="loyalty-rules-grid" aria-label="Program Rules">
        <div className="card loyalty-rule-card">
          <div className="rule-card-icon earn">
            <Coins size={22} />
          </div>
          <h3>{language === 'ar' ? '1. اكسب مع كل طلب' : '1. Earn on Purchases'}</h3>
          <p>
            {language === 'ar'
              ? `اكسب ${loyaltyRules.pointsEarnedPerUnit} نقطة مقابل كل ${loyaltyRules.earnUnitAmountEgp} جنيه مصري يتم إنفاقها على المشتريات المؤكدة بعد الخصومات.`
              : `Earn ${loyaltyRules.pointsEarnedPerUnit} point for every ${loyaltyRules.earnUnitAmountEgp} EGP spent on confirmed, completed merchandise after discounts.`}
          </p>
          <div className="rule-rate-tag">
            {loyaltyRules.pointsEarnedPerUnit} pt / {loyaltyRules.earnUnitAmountEgp} EGP
          </div>
        </div>

        <div className="card loyalty-rule-card">
          <div className="rule-card-icon redeem">
            <Sparkles size={22} />
          </div>
          <h3>{language === 'ar' ? '2. استبدل بخصومات فورية' : '2. Redeem for Discounts'}</h3>
          <p>
            {language === 'ar'
              ? `استبدل نقاطك بسهولة في صفحة الدفع: كل ${loyaltyRules.redemptionBlockPoints} نقطة تمنحك خصماً فورياً بقيمة ${loyaltyRules.redemptionBlockValueEgp} جنيه.`
              : `Redeem your points seamlessly at checkout: every ${loyaltyRules.redemptionBlockPoints} points provides ${loyaltyRules.redemptionBlockValueEgp} EGP instant discount.`}
          </p>
          <div className="rule-rate-tag">
            {loyaltyRules.redemptionBlockPoints} pts = {loyaltyRules.redemptionBlockValueEgp} EGP
          </div>
        </div>

        <div className="card loyalty-rule-card">
          <div className="rule-card-icon secure">
            <ShieldCheck size={22} />
          </div>
          <h3>{language === 'ar' ? '3. حماية وأمان كامل' : '3. Verified & Authoritative'}</h3>
          <p>
            {language === 'ar'
              ? 'الرصيد محمي بالتحقق؛ لا يمكن لأي شخص استبدال نقاطك بدون رمز تأكيد، وتتم مراجعة العمليات عبر سجل المعاملات.'
              : 'Points balances are authoritatively verified. A phone number alone cannot spend points without proof of ownership.'}
          </p>
          <div className="rule-rate-tag">
            {language === 'ar' ? 'سجل معاملات موثق' : 'Ledger Protected'}
          </div>
        </div>
      </section>

      {/* Main Account Status or Verification Login */}
      {!loyaltyVerificationToken || !loyaltyAccount ? (
        <section className="card loyalty-auth-card" aria-label="Verify Phone Number">
          <div className="loyalty-auth-header">
            <Lock size={22} color="var(--purple-600)" />
            <h2>
              {language === 'ar'
                ? 'الوصول إلى رصيد وسجل نقاطك'
                : 'Access Your Points Balance & History'}
            </h2>
          </div>

          <p className="loyalty-auth-desc">
            {language === 'ar'
              ? 'أدخل رقم هاتفك المحمول لعرض رصيدك المتاح، إجمالي الخصم المستحق، وسجل المعاملات السابقة.'
              : 'Enter your mobile phone number to view your verified points balance, available discount value, and full transaction history.'}
          </p>

          {!codeSent ? (
            <div className="loyalty-auth-form-row">
              <div style={{ flex: 1 }}>
                <input
                  type="tel"
                  className={`checkout-input ${phoneError ? 'has-error' : ''}`}
                  placeholder={language === 'ar' ? 'رقم الموبايل (مثال: 01012345678)' : 'Mobile Phone (e.g. 01012345678)'}
                  value={phoneInput}
                  onChange={(e) => {
                    setPhoneInput(e.target.value);
                    if (phoneError) setPhoneError(null);
                  }}
                  dir="ltr"
                  disabled={loyaltyLoading}
                />
                {phoneError && <p className="checkout-field-error">{phoneError}</p>}
              </div>

              <button
                type="button"
                className="btn btn-purple"
                onClick={() => void handleRequestCode()}
                disabled={loyaltyLoading || !phoneInput.trim()}
              >
                {loyaltyLoading ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <KeyRound size={16} />
                )}
                <span>
                  {language === 'ar' ? 'إرسال رمز التحقق' : 'Send Verification Code'}
                </span>
              </button>
            </div>
          ) : (
            <div className="loyalty-auth-code-box">
              <div className="banner banner-info">
                <span>
                  {challengeMessage ||
                    (language === 'ar'
                      ? `تم إرسال رمز التحقق إلى الرقم ${phoneInput}. أدخل الرمز للمتابعة.`
                      : `Verification code sent to ${phoneInput}. Enter the code below to proceed.`)}
                </span>
              </div>

              <div className="loyalty-auth-form-row" style={{ marginTop: 12 }}>
                <input
                  type="text"
                  className="checkout-input otp"
                  placeholder={language === 'ar' ? 'رمز التأكيد' : '6-digit code'}
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  maxLength={8}
                  disabled={loyaltyLoading}
                  autoFocus
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void handleConfirmCode()}
                  disabled={loyaltyLoading || !codeInput.trim()}
                >
                  {loyaltyLoading ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
                  <span>{language === 'ar' ? 'تأكيد الرمز' : 'Verify & Open'}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCodeSent(false)}
                  disabled={loyaltyLoading}
                >
                  <span>{language === 'ar' ? 'تغيير الرقم' : 'Change Phone'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Transparent Backend Contract Notice */}
          {loyaltyBackendAvailable === false && (
            <div className="loyalty-dev-notice">
              <ShieldAlert size={16} color="var(--amber-700)" />
              <div>
                <strong>{language === 'ar' ? 'ملاحظة للمطورين:' : 'Backend Contract Notice:'}</strong>{' '}
                {language === 'ar'
                  ? 'نقاط النهاية /api/loyalty/* غير متوفرة بعد على سيرفر clothesai3d.runasp.net (ترجع 404). البرنامج مصمم بالكامل وجاهز للربط الفوري بمجرد رفع متحكم LoyaltyController على الباك إند.'
                  : 'The /api/loyalty/* endpoints are not yet mounted on clothesai3d.runasp.net (returns 404). The frontend is fully integrated and ready to bind directly once LoyaltyController is deployed.'}
              </div>
            </div>
          )}
        </section>
      ) : (
        /* Verified Account Dashboard */
        <section className="loyalty-dashboard-stack" aria-label="Loyalty Dashboard">
          <div className="card loyalty-dashboard-card">
            <div className="dashboard-top-row">
              <div>
                <span className="dashboard-account-tag">
                  {language === 'ar' ? 'حساب ولاء موثّق' : 'Verified Loyalty Member'}
                </span>
                <div className="dashboard-phone" dir="ltr">
                  {maskPhoneNumber(loyaltyAccount.customerPhoneMasked)}
                </div>
              </div>

              <div className="dashboard-actions-group">
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => void refreshLoyaltyAccount()}
                  disabled={loyaltyLoading}
                >
                  <RefreshCw size={14} className={loyaltyLoading ? 'spin' : ''} />
                  <span>{language === 'ar' ? 'تحديث الرصيد' : 'Refresh'}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={clearLoyaltySession}
                >
                  <LogOut size={14} />
                  <span>{language === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}</span>
                </button>
              </div>
            </div>

            {/* Metric Tiles */}
            <div className="dashboard-metrics-grid">
              <div className="dashboard-metric-tile primary">
                <div className="metric-label">{language === 'ar' ? 'الرصيد المتاح' : 'Available Balance'}</div>
                <div className="metric-val">{loyaltyAccount.currentBalance}</div>
                <div className="metric-sub">
                  = {formatEgp(loyaltyAccount.availableDiscountEgp, language)}{' '}
                  {language === 'ar' ? 'خصم فوري' : 'instant discount'}
                </div>
              </div>

              <div className="dashboard-metric-tile">
                <div className="metric-label">{language === 'ar' ? 'إجمالي النقاط المكتسبة' : 'Lifetime Earned'}</div>
                <div className="metric-val text-green">{loyaltyAccount.lifetimeEarned}</div>
                <div className="metric-sub">{language === 'ar' ? 'من مشترياتك السابقة' : 'From completed orders'}</div>
              </div>

              <div className="dashboard-metric-tile">
                <div className="metric-label">{language === 'ar' ? 'النقاط المستبدلة' : 'Points Redeemed'}</div>
                <div className="metric-val text-muted">{loyaltyAccount.lifetimeRedeemed}</div>
                <div className="metric-sub">{language === 'ar' ? 'تم استخدامها كخصومات' : 'Used towards discounts'}</div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="dashboard-shop-action">
              <button
                type="button"
                className="btn btn-navy"
                onClick={() => navigate('/browse')}
              >
                <ShoppingBag size={16} />
                <span>{language === 'ar' ? 'تسوق واستخدم نقاطك' : 'Shop & Use My Points'}</span>
                {isRtl ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
              </button>
            </div>
          </div>

          {/* Transaction Ledger Table */}
          <div className="card loyalty-ledger-card">
            <div className="ledger-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <History size={18} color="var(--blue-600)" />
                <h2>{language === 'ar' ? 'سجل المعاملات والنشاط' : 'Points Ledger & Activity'}</h2>
              </div>
              <span className="ledger-count">
                {loyaltyAccount.transactions.length}{' '}
                {language === 'ar' ? 'معاملة' : 'transactions'}
              </span>
            </div>

            {loyaltyAccount.transactions.length === 0 ? (
              <div className="ledger-empty">
                <Coins size={32} color="#94a3b8" />
                <p>
                  {language === 'ar'
                    ? 'لا توجد معاملات نقاط سابقة بعد. ستظهر نقاطك المكتسبة هنا بمجرد اكتمال طلباتك.'
                    : 'No points activity recorded yet. Points earned on completed purchases will appear here.'}
                </p>
              </div>
            ) : (
              <div className="receipt-table-wrapper">
                <table className="receipt-table">
                  <thead>
                    <tr>
                      <th>{language === 'ar' ? 'نوع العملية' : 'Type'}</th>
                      <th>{language === 'ar' ? 'الوصف' : 'Description'}</th>
                      <th>{language === 'ar' ? 'رقم الطلب' : 'Order #'}</th>
                      <th>{language === 'ar' ? 'التاريخ' : 'Date'}</th>
                      <th className="num">{language === 'ar' ? 'النقاط' : 'Points'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loyaltyAccount.transactions.map((tx) => {
                      const isPositive = tx.pointsDelta > 0;
                      return (
                        <tr key={tx.id}>
                          <td>
                            <span className={`ledger-type-badge ${tx.type}`}>
                              {isPositive ? (
                                <TrendingUp size={13} />
                              ) : (
                                <TrendingDown size={13} />
                              )}
                              <span>
                                {tx.type === 'earn'
                                  ? t('earnedPointsBadge')
                                  : tx.type === 'redeem'
                                  ? t('redeemedPointsBadge')
                                  : t('adjustedPointsBadge')}
                              </span>
                            </span>
                          </td>
                          <td>{tx.description}</td>
                          <td>
                            {tx.orderNumber ? (
                              <button
                                type="button"
                                className="ledger-order-link"
                                onClick={() => navigate(`/orders/${encodeURIComponent(tx.orderNumber!)}`)}
                              >
                                <bdi>{tx.orderNumber}</bdi>
                              </button>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>
                            {new Date(tx.createdAt).toLocaleDateString(
                              language === 'ar' ? 'ar-EG' : 'en-US',
                              { dateStyle: 'medium' }
                            )}
                          </td>
                          <td className={`num bold ${isPositive ? 'text-green' : 'text-red'}`}>
                            {isPositive ? `+${tx.pointsDelta}` : tx.pointsDelta}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Program FAQ Accordion / Summary */}
      <section className="card loyalty-faq-card" aria-label="Frequently Asked Questions">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <HelpCircle size={18} color="var(--purple-600)" />
          <h2>{language === 'ar' ? 'الأسئلة الشائعة حول برنامج الولاء' : 'Frequently Asked Questions'}</h2>
        </div>

        <div className="faq-items-list">
          <div className="faq-item">
            <h4>{language === 'ar' ? 'متى تُضاف النقاط المكتسبة إلى رصيدي؟' : 'When are earned points added to my balance?'}</h4>
            <p>
              {language === 'ar'
                ? 'تُضاف النقاط تلقائياً بعد تأكيد استلام الطلب والدفع بنجاح. الطلبات المعلقة أو الملغاة أو المرتجعة لا تكتسب نقاطاً.'
                : 'Points are added automatically once the order is delivered and payment is confirmed. Pending, failed, or cancelled purchases do not earn points.'}
            </p>
          </div>

          <div className="faq-item">
            <h4>{language === 'ar' ? 'هل يمكنني استبدال النقاط مع أي وسيلة دفع؟' : 'Can I use points with any payment method?'}</h4>
            <p>
              {language === 'ar'
                ? 'نعم! يمكنك تطبيق خصم النقاط على مشترياتك سواء اخترت الدفع عند الاستلام (COD) أو الدفع الإلكتروني عبر Stripe.'
                : 'Yes! Points discounts can be applied at checkout for both Cash on Delivery and Stripe Hosted card payment.'}
            </p>
          </div>

          <div className="faq-item">
            <h4>{language === 'ar' ? 'ماذا يحدث للنقاط المستبدلة إذا تم إلغاء الطلب؟' : 'What happens to redeemed points if an order is cancelled?'}</h4>
            <p>
              {language === 'ar'
                ? 'وفقاً لسياسة النظام، يتم استرداد أي نقاط تم استبدالها تلقائياً إلى رصيدك إذا أُلغي الطلب قبل الشحن.'
                : 'Any points redeemed on an order that is subsequently cancelled are returned to your account balance.'}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

