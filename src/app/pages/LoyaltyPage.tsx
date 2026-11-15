import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Clock,
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
import '../../styles/loyalty.css';

const OTP_LENGTH = 6;

function formatCountdown(totalSec: number): string {
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * One real <input> (so autofill, paste and screen readers just work)
 * with six display cells drawn on top of it.
 */
interface OtpBoxesProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
}

function OtpBoxes({ value, onChange, label, disabled }: OtpBoxesProps) {
  const [focused, setFocused] = useState(false);
  const activeIndex = Math.min(value.length, OTP_LENGTH - 1);

  return (
    <div
      className={`ly-otp ${focused ? 'is-focused' : ''} ${disabled ? 'is-disabled' : ''}`}
    >
      <input
        className="ly-otp-input"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={OTP_LENGTH}
        value={value}
        onChange={(e) =>
          onChange(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))
        }
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        aria-label={label}
        autoFocus
      />
      {Array.from({ length: OTP_LENGTH }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`ly-otp-cell ${i === activeIndex ? 'is-active' : ''}`}
        >
          {value[i] ?? ''}
        </span>
      ))}
    </div>
  );
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
  const tr = (en: string, ar: string) => (language === 'ar' ? ar : en);

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
      setCodeInput('');
      setChallengeMessage(res.message || null);
      if (typeof res.expiresInSeconds === 'number' && res.expiresInSeconds > 0) {
        setOtpRemainingSec(res.expiresInSeconds);
      }
    }
  };

  const handleConfirmCode = async () => {
    if (codeInput.length !== OTP_LENGTH) return;
    const ok = await confirmCustomerVerification(phoneInput.trim(), codeInput);
    if (ok) {
      setCodeSent(false);
      setCodeInput('');
      setOtpRemainingSec(null);
    }
  };

  const rules = loyaltyRules;
  const isVerified = Boolean(loyaltyVerificationToken && loyaltyAccount);
  const otpExpired = otpRemainingSec === 0;
  const maxPercent = Math.round((rules.maxRedemptionRatio ?? 1) * 100);

  // Display-only progress toward the next redemption block.
  // The balance itself always comes from the backend.
  const balance = loyaltyAccount?.currentBalance ?? 0;
  const block = rules.redemptionBlockPoints;
  const remainder = block > 0 ? balance % block : 0;
  const pointsToNext = block > 0 ? block - remainder : 0;
  const progressPct = block > 0 ? (remainder / block) * 100 : 0;
  const pointsToFirst = Math.max(rules.minRedemptionPoints - balance, 0);

  const txLabel = (type: string) =>
    type === 'earn'
      ? t('earnedPointsBadge')
      : type === 'redeem'
      ? t('redeemedPointsBadge')
      : type === 'reversal'
      ? tr('Reversed', 'مسترجعة')
      : t('adjustedPointsBadge');

  const faqs = [
    {
      q: tr(
        'When are earned points added to my balance?',
        'متى تُضاف النقاط المكتسبة إلى رصيدي؟'
      ),
      a: tr(
        'For Cash on Delivery (COD) orders, points are awarded immediately upon order creation. For Stripe card orders, points are awarded once payment verification succeeds.',
        'في طلبات الدفع عند الاستلام (COD) تُضاف النقاط فوراً بمجرد إنشاء الطلب، وفي طلبات الدفع بالبطاقة عبر Stripe تُضاف النقاط فور التحقق من إتمام الدفع بنجاح.'
      ),
    },
    {
      q: tr(
        'Can I use points with any payment method?',
        'هل يمكنني استبدال النقاط مع أي وسيلة دفع؟'
      ),
      a: tr(
        'Yes! Points discounts can be applied at checkout for both Cash on Delivery and Stripe Hosted card payment.',
        'نعم! يمكنك تطبيق خصم النقاط على مشترياتك سواء اخترت الدفع عند الاستلام (COD) أو الدفع الإلكتروني عبر Stripe.'
      ),
    },
    {
      q: tr(
        'What happens to redeemed points if an order is cancelled?',
        'ماذا يحدث للنقاط المستبدلة إذا تم إلغاء الطلب؟'
      ),
      a: tr(
        'Any points redeemed on an order that is subsequently cancelled are returned to your account balance.',
        'وفقاً لسياسة النظام، يتم استرداد أي نقاط تم استبدالها تلقائياً إلى رصيدك إذا أُلغي الطلب قبل الشحن.'
      ),
    },
  ];

  return (
    <div className="ly">
      <div className="ly-hero">
        {/* ---- Title ---- */}
        <header className="ly-intro">
          <h1 className="ly-title">{t('loyaltyTitle')}</h1>
          <p className="ly-lead">{t('loyaltySubtitle')}</p>
        </header>

        {/* ---- Rewards card: verify, or show balance ---- */}
        <section className="ly-card" aria-labelledby="ly-card-title">
          {!isVerified && !codeSent && (
            <>
              <div className="ly-card-top">
                <span className="ly-brand">
                  <Sparkles size={16} aria-hidden="true" />
                  {tr('TryOnStudio rewards', 'مكافآت TryOnStudio')}
                </span>
                <Lock size={18} aria-hidden="true" />
              </div>
              <h2 id="ly-card-title" className="ly-card-title">
                {tr('Check your points', 'تحقق من نقاطك')}
              </h2>
              <p className="ly-card-desc">
                {tr(
                  'Enter your mobile number to get a verification code. Your balance and history open once the code is confirmed.',
                  'أدخل رقم هاتفك المحمول للحصول على رمز التحقق. يظهر رصيدك وسجلك بعد تأكيد الرمز.'
                )}
              </p>

              <form
                className="ly-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleRequestCode();
                }}
                noValidate
              >
                <div>
                  <label className="ly-label" htmlFor="ly-phone">
                    {tr('Mobile number', 'رقم الموبايل')}
                  </label>
                  <input
                    id="ly-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    className={`ly-input ${phoneError ? 'has-error' : ''}`}
                    placeholder="01012345678"
                    value={phoneInput}
                    onChange={(e) => {
                      setPhoneInput(e.target.value);
                      if (phoneError) setPhoneError(null);
                    }}
                    dir="ltr"
                    disabled={loyaltyLoading}
                    aria-invalid={phoneError ? true : undefined}
                    aria-describedby={phoneError ? 'ly-phone-error' : undefined}
                  />
                  {phoneError && (
                    <p id="ly-phone-error" className="ly-field-error" role="alert">
                      {phoneError}
                    </p>
                  )}
                </div>

                {loyaltyError && (
                  <p className="ly-error" role="alert">
                    <AlertCircle size={16} aria-hidden="true" />
                    <span>{loyaltyError}</span>
                  </p>
                )}

                <button
                  type="submit"
                  className="ly-btn ly-btn--light ly-btn--block"
                  disabled={loyaltyLoading || !phoneInput.trim()}
                >
                  {loyaltyLoading ? (
                    <Loader2 size={16} className="spin" aria-hidden="true" />
                  ) : (
                    <KeyRound size={16} aria-hidden="true" />
                  )}
                  <span>{tr('Send code', 'إرسال الرمز')}</span>
                </button>
              </form>
            </>
          )}

          {!isVerified && codeSent && (
            <>
              <div className="ly-card-top">
                <span className="ly-brand">
                  <Sparkles size={16} aria-hidden="true" />
                  {tr('TryOnStudio rewards', 'مكافآت TryOnStudio')}
                </span>
                <Lock size={18} aria-hidden="true" />
              </div>
              <h2 id="ly-card-title" className="ly-card-title">
                {tr('Enter your code', 'أدخل رمز التحقق')}
              </h2>
              <p className="ly-card-desc">
                {tr('Verification code for ', 'رمز التحقق للرقم ')}
                <bdi className="ly-phone">{phoneInput.trim()}</bdi>
              </p>

              <form
                className="ly-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleConfirmCode();
                }}
              >
                <OtpBoxes
                  value={codeInput}
                  onChange={setCodeInput}
                  label={tr('6-digit verification code', 'رمز التحقق المكوّن من 6 أرقام')}
                  disabled={loyaltyLoading || otpExpired}
                />

                {otpRemainingSec !== null && (
                  <span
                    className={`ly-timer ${otpExpired ? 'is-expired' : ''}`}
                    role="status"
                  >
                    <Clock size={14} aria-hidden="true" />
                    {otpExpired
                      ? tr(
                          'Code expired. Request a new one.',
                          'انتهت صلاحية الرمز. اطلب رمزاً جديداً.'
                        )
                      : tr(
                          `Code expires in ${formatCountdown(otpRemainingSec)}`,
                          `صلاحية الرمز: ${formatCountdown(otpRemainingSec)}`
                        )}
                  </span>
                )}

                {challengeMessage && <p className="ly-hint">{challengeMessage}</p>}

                {loyaltyError && (
                  <p className="ly-error" role="alert">
                    <AlertCircle size={16} aria-hidden="true" />
                    <span>{loyaltyError}</span>
                  </p>
                )}

                <button
                  type="submit"
                  className="ly-btn ly-btn--light ly-btn--block"
                  disabled={
                    loyaltyLoading || codeInput.length !== OTP_LENGTH || otpExpired
                  }
                >
                  {loyaltyLoading ? (
                    <Loader2 size={16} className="spin" aria-hidden="true" />
                  ) : (
                    <Check size={16} aria-hidden="true" />
                  )}
                  <span>{tr('Verify and open', 'تأكيد وفتح الحساب')}</span>
                </button>

                <div className="ly-link-row">
                  <button
                    type="button"
                    className="ly-link"
                    onClick={() => void handleRequestCode()}
                    disabled={
                      loyaltyLoading || (retryWaitSec !== null && retryWaitSec > 0)
                    }
                  >
                    <RefreshCw size={14} aria-hidden="true" />
                    {retryWaitSec && retryWaitSec > 0
                      ? tr(`Wait ${retryWaitSec}s`, `انتظر ${retryWaitSec} ث`)
                      : tr('Send a new code', 'إرسال رمز جديد')}
                  </button>
                  <button
                    type="button"
                    className="ly-link"
                    onClick={() => {
                      setCodeSent(false);
                      setCodeInput('');
                      setOtpRemainingSec(null);
                    }}
                    disabled={loyaltyLoading}
                  >
                    {tr('Use a different number', 'تغيير الرقم')}
                  </button>
                </div>
              </form>
            </>
          )}

          {isVerified && loyaltyAccount && (
            <>
              <div className="ly-card-top">
                <span className="ly-member">
                  <ShieldCheck size={14} aria-hidden="true" />
                  {tr('Verified member', 'عضو موثّق')}
                </span>
                <bdi className="ly-brand ly-phone">
                  {maskPhoneNumber(loyaltyAccount.customerPhoneMasked)}
                </bdi>
              </div>

              <h2 id="ly-card-title" className="ly-balance-label">
                {tr('Available balance', 'الرصيد المتاح')}
              </h2>
              <div className="ly-balance">
                <span className="ly-balance-num">{loyaltyAccount.currentBalance}</span>
                <span className="ly-balance-unit">{tr('points', 'نقطة')}</span>
              </div>
              <p className="ly-balance-value">
                {tr(
                  `Worth ${formatEgp(loyaltyAccount.availableDiscountEgp, language)} off at checkout`,
                  `تساوي خصم ${formatEgp(loyaltyAccount.availableDiscountEgp, language)} عند الدفع`
                )}
              </p>

              {block > 0 && (
                <>
                  <div
                    className="ly-progress"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={block}
                    aria-valuenow={remainder}
                    aria-label={tr('Progress to next discount', 'التقدم نحو الخصم التالي')}
                  >
                    <div className="ly-progress-fill" style={{ width: `${progressPct}%` }} />
                  </div>
                  <p className="ly-progress-note">
                    {pointsToFirst > 0
                      ? tr(
                          `Earn ${pointsToFirst} more points to unlock your first discount.`,
                          `اكسب ${pointsToFirst} نقطة إضافية لفتح أول خصم لك.`
                        )
                      : tr(
                          `${pointsToNext} more points for the next EGP ${rules.redemptionBlockValueEgp} off.`,
                          `باقي ${pointsToNext} نقطة للخصم التالي بقيمة ${rules.redemptionBlockValueEgp} جنيه.`
                        )}
                  </p>
                </>
              )}

              <dl className="ly-stats">
                <div className="ly-stat">
                  <dt>{tr('Earned so far', 'إجمالي المكتسب')}</dt>
                  <dd>{loyaltyAccount.lifetimeEarned}</dd>
                </div>
                <div className="ly-stat">
                  <dt>{tr('Redeemed so far', 'إجمالي المستبدل')}</dt>
                  <dd>{loyaltyAccount.lifetimeRedeemed}</dd>
                </div>
              </dl>

              {loyaltyError && (
                <p className="ly-error" role="alert" style={{ marginBlockStart: 16 }}>
                  <AlertCircle size={16} aria-hidden="true" />
                  <span>{loyaltyError}</span>
                </p>
              )}

              <div className="ly-card-actions">
                <button
                  type="button"
                  className="ly-btn ly-btn--light"
                  onClick={() => navigate('/browse')}
                >
                  <ShoppingBag size={16} aria-hidden="true" />
                  <span>{tr('Shop and use my points', 'تسوق واستخدم نقاطك')}</span>
                  {isRtl ? (
                    <ArrowLeft size={16} aria-hidden="true" />
                  ) : (
                    <ArrowRight size={16} aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  className="ly-btn ly-btn--ghost ly-btn--sm"
                  onClick={() => void refreshLoyaltyAccount()}
                  disabled={loyaltyLoading}
                >
                  <RefreshCw
                    size={14}
                    className={loyaltyLoading ? 'spin' : ''}
                    aria-hidden="true"
                  />
                  <span>{tr('Refresh', 'تحديث الرصيد')}</span>
                </button>
                <button
                  type="button"
                  className="ly-btn ly-btn--ghost ly-btn--sm"
                  onClick={clearLoyaltySession}
                >
                  <LogOut size={14} aria-hidden="true" />
                  <span>{tr('Sign out', 'تسجيل الخروج')}</span>
                </button>
              </div>
            </>
          )}
        </section>

        {/* ---- How it works + rules ---- */}
        <div className="ly-info">
          <h2 className="ly-h2">{tr('How it works', 'طريقة العمل')}</h2>
          <ol className="ly-steps">
            <li>
              <div>
                <strong>{tr('Shop and earn', 'تسوّق واكسب')}</strong>
                <span>
                  {tr(
                    `Every EGP ${rules.earnUnitAmountEgp} you spend earns ${rules.pointsEarnedPerUnit} point, counted on your final order total.`,
                    `كل ${rules.earnUnitAmountEgp} جنيه تنفقها تمنحك ${rules.pointsEarnedPerUnit} نقطة، محسوبة على إجمالي طلبك النهائي.`
                  )}
                </span>
              </div>
            </li>
            <li>
              <div>
                <strong>{tr('Verify your phone', 'أكّد رقم هاتفك')}</strong>
                <span>
                  {tr(
                    'Confirm your number with a one-time code. Verification lasts 30 minutes.',
                    'أكّد رقمك برمز لمرة واحدة. تستمر صلاحية التحقق 30 دقيقة.'
                  )}
                </span>
              </div>
            </li>
            <li>
              <div>
                <strong>{tr('Redeem at checkout', 'استبدل عند الدفع')}</strong>
                <span>
                  {tr(
                    `${rules.redemptionBlockPoints} points take EGP ${rules.redemptionBlockValueEgp} off your order.`,
                    `كل ${rules.redemptionBlockPoints} نقطة تخصم ${rules.redemptionBlockValueEgp} جنيه من طلبك.`
                  )}
                </span>
              </div>
            </li>
          </ol>

          <h2 className="ly-h2">{tr('Redemption rules', 'قواعد الاستبدال')}</h2>
          <dl className="ly-rules">
            <div>
              <dt>{tr('Minimum', 'الحد الأدنى')}</dt>
              <dd>
                <bdi>{rules.minRedemptionPoints}</bdi> {tr('points', 'نقطة')}
              </dd>
            </div>
            <div>
              <dt>{tr('Redeem in multiples of', 'الاستبدال بمضاعفات')}</dt>
              <dd>
                <bdi>{rules.redemptionBlockPoints}</bdi> {tr('points', 'نقطة')}
              </dd>
            </div>
            <div>
              <dt>{tr('Maximum discount', 'أقصى خصم')}</dt>
              <dd>
                <bdi>{maxPercent}%</bdi> {tr('of the order total', 'من إجمالي الطلب')}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* ---- Ledger ---- */}
      {isVerified && loyaltyAccount && (
        <section className="ly-panel" aria-labelledby="ly-ledger-title">
          <div className="ly-panel-head">
            <h2 id="ly-ledger-title">{tr('Points activity', 'سجل النقاط')}</h2>
            <span className="ly-count">
              <History size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} />{' '}
              {tr(
                `${loyaltyAccount.transactions.length} transactions`,
                `${loyaltyAccount.transactions.length} معاملة`
              )}
            </span>
          </div>

          {loyaltyAccount.transactions.length === 0 ? (
            <p className="ly-empty">
              {tr(
                'No points activity yet. Points from your completed orders will show up here.',
                'لا توجد معاملات نقاط بعد. ستظهر هنا النقاط المكتسبة من طلباتك المكتملة.'
              )}
            </p>
          ) : (
            <ul className="ly-ledger">
              {loyaltyAccount.transactions.map((tx) => {
                const isPositive = tx.pointsDelta > 0;
                const tone =
                  tx.type === 'earn'
                    ? 'is-earn'
                    : tx.type === 'redeem'
                    ? 'is-redeem'
                    : 'is-adjust';
                return (
                  <li key={tx.id} className={`ly-tx ${tone}`}>
                    <span className="ly-tx-icon" aria-hidden="true">
                      {isPositive ? <TrendingUp size={17} /> : <TrendingDown size={17} />}
                    </span>
                    <div className="ly-tx-main">
                      <p className="ly-tx-desc">{tx.description}</p>
                      <div className="ly-tx-meta">
                        <span>{txLabel(tx.type)}</span>
                        <span>
                          {new Date(tx.createdAt).toLocaleDateString(
                            language === 'ar' ? 'ar-EG' : 'en-US',
                            { dateStyle: 'medium' }
                          )}
                        </span>
                        {tx.orderNumber && (
                          <button
                            type="button"
                            className="ly-order-link"
                            onClick={() =>
                              navigate(`/orders/${encodeURIComponent(tx.orderNumber!)}`)
                            }
                          >
                            <bdi>{tx.orderNumber}</bdi>
                          </button>
                        )}
                      </div>
                    </div>
                    <span className="ly-tx-points">
                      <bdi dir="ltr">{isPositive ? `+${tx.pointsDelta}` : tx.pointsDelta}</bdi>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {loyaltyBackendAvailable === false && (
        <div className="ly-notice" role="note">
          <ShieldAlert size={18} aria-hidden="true" />
          <div>
            <strong>{tr('Backend contract notice:', 'ملاحظة للمطورين:')}</strong>{' '}
            {tr(
              'The /api/loyalty/* endpoints are not yet mounted on clothesai3d.runasp.net (returns 404). The frontend is fully integrated and ready to bind directly once LoyaltyController is deployed.',
              'نقاط النهاية /api/loyalty/* غير متوفرة بعد على سيرفر clothesai3d.runasp.net (ترجع 404). البرنامج مصمم بالكامل وجاهز للربط الفوري بمجرد رفع متحكم LoyaltyController على الباك إند.'
            )}
          </div>
        </div>
      )}

      {/* ---- FAQ ---- */}
      <section className="ly-panel" aria-labelledby="ly-faq-title">
        <div className="ly-panel-head">
          <h2 id="ly-faq-title">{tr('Frequently asked questions', 'الأسئلة الشائعة')}</h2>
        </div>
        {faqs.map((item) => (
          <details key={item.q} className="ly-faq-item">
            <summary>
              <span>{item.q}</span>
              <ChevronDown size={18} aria-hidden="true" />
            </summary>
            <p>{item.a}</p>
          </details>
        ))}
      </section>
    </div>
  );
}
