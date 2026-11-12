import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Check,
  Clock,
  Coins,
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
import {
  formatEgp,
  maskPhoneNumber,
  validatePhoneNumber,
} from '../../utils/commerceHelpers';

function formatCountdown(totalSec: number): string {
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function LoyaltyPage() {
  const { language, isRtl, t } = useLanguage();
  const {
    loyaltyRules,
    loyaltyBackendAvailable,
    loyaltyAccount,
    loyaltyVerificationToken,
    loyaltyLoading,
    loyaltyError,
    loyaltyOtpExpiresInSeconds,
    loyaltyRetryAfterSeconds,
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
  const [otpRemainingSec, setOtpRemainingSec] = useState<number | null>(null);
  const [retryWaitSec, setRetryWaitSec] = useState<number | null>(null);

  useEffect(() => {
    if (
      typeof loyaltyOtpExpiresInSeconds === 'number' &&
      loyaltyOtpExpiresInSeconds > 0
    ) {
      setOtpRemainingSec(loyaltyOtpExpiresInSeconds);
    } else if (loyaltyOtpExpiresInSeconds === 0) {
      setOtpRemainingSec(0);
    } else {
      setOtpRemainingSec(null);
    }
  }, [loyaltyOtpExpiresInSeconds]);

  useEffect(() => {
    if (
      typeof loyaltyRetryAfterSeconds === 'number' &&
      loyaltyRetryAfterSeconds > 0
    ) {
      setRetryWaitSec(loyaltyRetryAfterSeconds);
    } else {
      setRetryWaitSec(null);
    }
  }, [loyaltyRetryAfterSeconds]);

  useEffect(() => {
    if (otpRemainingSec === null || otpRemainingSec <= 0) return;
    const timer = window.setInterval(() => {
      setOtpRemainingSec((prev) => (prev && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [otpRemainingSec]);

  useEffect(() => {
    if (retryWaitSec === null || retryWaitSec <= 0) return;
    const timer = window.setInterval(() => {
      setRetryWaitSec((prev) => (prev && prev > 1 ? prev - 1 : null));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryWaitSec]);

  const handleRequestCode = async () => {
    const phoneErr = validatePhoneNumber(phoneInput, language);
    if (phoneErr) {
      setPhoneError(phoneErr);
      return;
    }
    setPhoneError(null);
    const res = await requestCustomerVerification(phoneInput.trim());
    if (res.challengeSent) {
      setCodeSent(true);
      setChallengeMessage(res.message || null);
      if (typeof res.expiresInSeconds === 'number' && res.expiresInSeconds > 0) {
        setOtpRemainingSec(res.expiresInSeconds);
      }
    }
  };

  const handleConfirmCode = async () => {
    if (!codeInput.trim()) return;
    const ok = await confirmCustomerVerification(phoneInput.trim(), codeInput.trim());
    if (ok) {
      setCodeSent(false);
      setCodeInput('');
      setOtpRemainingSec(null);
    }
  };

  return (
    <div className="loyalty-page">
      {/* Page Header with 3D Gift Emblem */}
      <div className="loyalty-header-block">
        <div className="loyalty-header-icon-3d" aria-hidden="true">
          <svg width="44" height="44" viewBox="0 0 64 64" fill="none">
            <defs>
              <linearGradient id="giftBoxTop" x1="8" y1="18" x2="56" y2="34" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#a78bfa" />
                <stop offset="50%" stopColor="#7c3aed" />
                <stop offset="100%" stopColor="#4c1d95" />
              </linearGradient>
              <linearGradient id="giftBoxBody" x1="12" y1="30" x2="52" y2="58" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#3b0764" />
              </linearGradient>
              <linearGradient id="giftRibbonGold" x1="20" y1="8" x2="44" y2="58" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#fde68a" />
                <stop offset="45%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#b45309" />
              </linearGradient>
            </defs>
            <ellipse cx="32" cy="58" rx="20" ry="4" fill="rgba(76, 29, 149, 0.22)" />
            <rect x="12" y="30" width="40" height="25" rx="6" fill="url(#giftBoxBody)" />
            <rect x="9" y="21" width="46" height="11" rx="4" fill="url(#giftBoxTop)" />
            <rect x="28" y="21" width="8" height="34" fill="url(#giftRibbonGold)" />
            <rect x="12" y="38" width="40" height="6" fill="url(#giftRibbonGold)" opacity="0.9" />
            <path
              d="M32 21C25 21 19 16.5 21 11.5C23 7 30 11 32 21Z"
              fill="url(#giftRibbonGold)"
            />
            <path
              d="M32 21C39 21 45 16.5 43 11.5C41 7 34 11 32 21Z"
              fill="url(#giftRibbonGold)"
            />
            <circle cx="48" cy="14" r="2.5" fill="#fde047" />
            <circle cx="16" cy="16" r="1.8" fill="#c4b5fd" />
          </svg>
        </div>
        <div className="loyalty-header-text">
          <div className="loyalty-header-eyebrow">
            <Sparkles size={13} />
            <span>{language === 'ar' ? 'مكافآت حصرية للعملاء' : 'TRYONSTUDIO REWARDS CLUB'}</span>
          </div>
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

      {/* Program Explainer Cards (3 Core Pillars with 3D Isometric Icons & Layered Cards) */}
      <section className="loyalty-rules-grid" aria-label="Program Rules">
        {/* Card 1: Earn on Purchases */}
        <article className="card loyalty-rule-card earn-theme">
          <div className="rule-card-glow" aria-hidden="true" />
          <div className="rule-card-top">
            <div className="rule-card-icon-3d earn" aria-hidden="true">
              <svg width="46" height="46" viewBox="0 0 64 64" fill="none">
                <defs>
                  <linearGradient id="coinRim" x1="10" y1="10" x2="54" y2="54" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#fef08a" />
                    <stop offset="45%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#b45309" />
                  </linearGradient>
                  <linearGradient id="coinFace" x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#fde047" />
                    <stop offset="100%" stopColor="#d97706" />
                  </linearGradient>
                  <linearGradient id="coinBack" x1="24" y1="8" x2="58" y2="42" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#60a5fa" />
                    <stop offset="100%" stopColor="#1d4ed8" />
                  </linearGradient>
                </defs>
                <ellipse cx="32" cy="57" rx="18" ry="3.5" fill="rgba(217, 119, 6, 0.25)" />
                {/* Secondary 3D Blue Token behind */}
                <circle cx="40" cy="24" r="14" fill="url(#coinBack)" />
                <circle cx="40" cy="24" r="10.5" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
                {/* Foreground 3D Gold Medallion */}
                <ellipse cx="27" cy="37" rx="18" ry="18" fill="#92400e" />
                <circle cx="27" cy="34" r="18" fill="url(#coinRim)" />
                <circle cx="27" cy="34" r="13.5" fill="url(#coinFace)" />
                <path
                  d="M27 25L29.4 30.2L35 30.9L30.8 34.7L31.9 40.3L27 37.5L22.1 40.3L23.2 34.7L19 30.9L24.6 30.2L27 25Z"
                  fill="#fef9c3"
                />
              </svg>
            </div>
            <span className="rule-step-pill earn">01</span>
          </div>

          <h3 className="rule-card-title">
            {language === 'ar' ? '1. اكسب مع كل طلب' : '1. Earn on Purchases'}
          </h3>
          <p className="rule-card-desc">
            {language === 'ar'
              ? `اكسب ${loyaltyRules.pointsEarnedPerUnit} نقطة مقابل كل ${loyaltyRules.earnUnitAmountEgp} جنيه مصري يتم إنفاقها على المشتريات المؤكدة بعد الخصومات.`
              : `Earn ${loyaltyRules.pointsEarnedPerUnit} point for every ${loyaltyRules.earnUnitAmountEgp} EGP spent on confirmed, completed merchandise after discounts.`}
          </p>
          <div className="rule-card-footer">
            <span className="rule-rate-tag earn">
              <Coins size={14} aria-hidden="true" />
              <bdi dir="ltr">
                {loyaltyRules.pointsEarnedPerUnit} pt / {loyaltyRules.earnUnitAmountEgp} EGP
              </bdi>
            </span>
          </div>
        </article>

        {/* Card 2: Redeem for Discounts */}
        <article className="card loyalty-rule-card redeem-theme">
          <div className="rule-card-glow" aria-hidden="true" />
          <div className="rule-card-top">
            <div className="rule-card-icon-3d redeem" aria-hidden="true">
              <svg width="46" height="46" viewBox="0 0 64 64" fill="none">
                <defs>
                  <linearGradient id="gemFacetMain" x1="12" y1="12" x2="52" y2="54" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#c4b5fd" />
                    <stop offset="45%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#4c1d95" />
                  </linearGradient>
                  <linearGradient id="gemFacetTop" x1="16" y1="12" x2="48" y2="28" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#f5f3ff" />
                    <stop offset="100%" stopColor="#a78bfa" />
                  </linearGradient>
                  <linearGradient id="sparkleGold" x1="40" y1="8" x2="56" y2="24" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#fef08a" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                </defs>
                <ellipse cx="32" cy="57" rx="18" ry="3.5" fill="rgba(124, 58, 237, 0.24)" />
                {/* 3D Diamond / Discount Gem */}
                <polygon points="20,16 44,16 54,28 32,52 10,28" fill="url(#gemFacetMain)" />
                <polygon points="20,16 44,16 48,28 16,28" fill="url(#gemFacetTop)" />
                <polygon points="16,28 48,28 32,52" fill="rgba(255,255,255,0.18)" />
                <polyline
                  points="10,28 54,28"
                  stroke="rgba(255,255,255,0.55)"
                  strokeWidth="1.5"
                />
                {/* 3D Floating Star Sparkle */}
                <path
                  d="M49 8L51.2 13.8L57 16L51.2 18.2L49 24L46.8 18.2L41 16L46.8 13.8L49 8Z"
                  fill="url(#sparkleGold)"
                />
              </svg>
            </div>
            <span className="rule-step-pill redeem">02</span>
          </div>

          <h3 className="rule-card-title">
            {language === 'ar' ? '2. استبدل بخصومات فورية' : '2. Redeem for Discounts'}
          </h3>
          <p className="rule-card-desc">
            {language === 'ar'
              ? `استبدل نقاطك بسهولة في صفحة الدفع: كل ${loyaltyRules.redemptionBlockPoints} نقطة تمنحك خصماً فورياً بقيمة ${loyaltyRules.redemptionBlockValueEgp} جنيه.`
              : `Redeem your points seamlessly at checkout: every ${loyaltyRules.redemptionBlockPoints} points provides ${loyaltyRules.redemptionBlockValueEgp} EGP instant discount.`}
          </p>
          <div className="rule-card-footer">
            <span className="rule-rate-tag redeem">
              <Sparkles size={14} aria-hidden="true" />
              <bdi dir="ltr">
                {loyaltyRules.redemptionBlockPoints} pts = {loyaltyRules.redemptionBlockValueEgp} EGP
              </bdi>
            </span>
          </div>
        </article>

        {/* Card 3: Verified & Authoritative */}
        <article className="card loyalty-rule-card secure-theme">
          <div className="rule-card-glow" aria-hidden="true" />
          <div className="rule-card-top">
            <div className="rule-card-icon-3d secure" aria-hidden="true">
              <svg width="46" height="46" viewBox="0 0 64 64" fill="none">
                <defs>
                  <linearGradient id="shieldOuter" x1="12" y1="8" x2="52" y2="56" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#6ee7b7" />
                    <stop offset="50%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#065f46" />
                  </linearGradient>
                  <linearGradient id="shieldInner" x1="18" y1="14" x2="46" y2="48" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#047857" />
                  </linearGradient>
                </defs>
                <ellipse cx="32" cy="57" rx="17" ry="3.5" fill="rgba(16, 185, 129, 0.24)" />
                <path
                  d="M32 8L52 15.5V30.5C52 43.2 43.4 51.8 32 55C20.6 51.8 12 43.2 12 30.5V15.5L32 8Z"
                  fill="url(#shieldOuter)"
                />
                <path
                  d="M32 13L47 18.6V30.2C47 40.1 40.4 47.1 32 49.8C23.6 47.1 17 40.1 17 30.2V18.6L32 13Z"
                  fill="url(#shieldInner)"
                  stroke="rgba(255,255,255,0.4)"
                  strokeWidth="1.2"
                />
                <path
                  d="M24.5 31.5L29.5 36.5L40 26"
                  stroke="#ecfdf5"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="rule-step-pill secure">03</span>
          </div>

          <h3 className="rule-card-title">
            {language === 'ar' ? '3. حماية وأمان كامل' : '3. Verified & Authoritative'}
          </h3>
          <p className="rule-card-desc">
            {language === 'ar'
              ? 'الرصيد محمي بالتحقق؛ لا يمكن لأي شخص استبدال نقاطك بدون رمز تأكيد، وتتم مراجعة العمليات عبر سجل المعاملات.'
              : 'Points balances are authoritatively verified. A phone number alone cannot spend points without proof of ownership.'}
          </p>
          <div className="rule-card-footer">
            <span className="rule-rate-tag secure">
              <ShieldCheck size={14} aria-hidden="true" />
              <span>{language === 'ar' ? 'سجل معاملات موثق' : 'Ledger Protected'}</span>
            </span>
          </div>
        </article>
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
              <div
                className="banner banner-info"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                <span>
                  {challengeMessage ||
                    (language === 'ar'
                      ? `تم إرسال رمز التحقق إلى الرقم ${phoneInput}. أدخل الرمز للمتابعة.`
                      : `Verification code sent to ${phoneInput}. Enter the code below to proceed.`)}
                </span>
                {otpRemainingSec !== null && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color:
                        otpRemainingSec > 0
                          ? 'var(--blue-700, #1d4ed8)'
                          : 'var(--red-600, #dc2626)',
                    }}
                  >
                    <Clock size={13} />
                    <span>
                      {otpRemainingSec > 0
                        ? language === 'ar'
                          ? `صلاحية الرمز: ${formatCountdown(otpRemainingSec)}`
                          : `Code expires in ${formatCountdown(otpRemainingSec)}`
                        : language === 'ar'
                        ? 'انتهت صلاحية الرمز — اطلب رمزاً جديداً'
                        : 'Code expired — request a new code'}
                    </span>
                  </span>
                )}
              </div>

              <div className="loyalty-auth-form-row" style={{ marginTop: 12 }}>
                <input
                  type="text"
                  className="checkout-input otp"
                  placeholder={language === 'ar' ? 'رمز التأكيد' : '6-digit code'}
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  maxLength={12}
                  disabled={loyaltyLoading || otpRemainingSec === 0}
                  autoFocus
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void handleConfirmCode()}
                  disabled={
                    loyaltyLoading ||
                    !codeInput.trim() ||
                    otpRemainingSec === 0
                  }
                >
                  {loyaltyLoading ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
                  <span>{language === 'ar' ? 'تأكيد الرمز' : 'Verify & Open'}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => void handleRequestCode()}
                  disabled={loyaltyLoading || (retryWaitSec !== null && retryWaitSec > 0)}
                >
                  <RefreshCw size={13} />
                  <span>
                    {retryWaitSec && retryWaitSec > 0
                      ? language === 'ar'
                        ? `انتظر (${retryWaitSec} ث)`
                        : `Wait (${retryWaitSec}s)`
                      : language === 'ar'
                      ? 'طلب رمز جديد'
                      : 'Request New Code'}
                  </span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setCodeSent(false);
                    setOtpRemainingSec(null);
                  }}
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
                ? 'في طلبات الدفع عند الاستلام (COD) تُضاف النقاط فوراً بمجرد إنشاء الطلب، وفي طلبات الدفع بالبطاقة عبر Stripe تُضاف النقاط فور التحقق من إتمام الدفع بنجاح.'
                : 'For Cash on Delivery (COD) orders, points are awarded immediately upon order creation. For Stripe card orders, points are awarded once payment verification succeeds.'}
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

