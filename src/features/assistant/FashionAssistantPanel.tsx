import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  MessageSquarePlus,
  RefreshCw,
  Send,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react';
import { useCommerce } from '../../app/CommerceContext';
import { useStudio } from '../../app/StudioContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { GarmentImage } from '../../components/GarmentImage';
import { formatEgp } from '../../utils/commerceHelpers';
import { fashionApi } from '../../services/fashionApi';

interface FashionAssistantPanelProps {
  compact?: boolean;
  onNavigateAway?: () => void;
}

const STARTERS_EN = [
  {
    topic: 'Outfit Coordination',
    prompt: 'How can I coordinate a balanced smart-casual outfit using items from the catalog?',
  },
  {
    topic: 'Colors & Undertones',
    prompt: 'Explain warm, cool, and neutral skin undertones and which clothing colors pair nicely with each.',
  },
  {
    topic: 'Fit & Proportions',
    prompt: 'What is the difference between slim, regular, relaxed, and oversized fits, and how do they change an outfit silhouette?',
  },
  {
    topic: 'University & Work',
    prompt: 'Recommend versatile tops or jackets from our catalog for university days and casual office wear.',
  },
  {
    topic: 'Capsule Style',
    prompt: 'Help me build a minimalist capsule wardrobe starting with versatile pieces in TryOnStudio.',
  },
  {
    topic: 'Try-On & Loyalty',
    prompt: 'How do Virtual Try-On, Camera Size Scan, and Loyalty Points discounts work?',
  },
];

const STARTERS_AR = [
  {
    topic: 'تنسيق الإطلالات',
    prompt: 'كيف أنسق إطلالة أنيقة كاجوال متوازنة باستخدام القطع المتوفرة في الكتالوج؟',
  },
  {
    topic: 'الألوان ودرجات البشرة',
    prompt: 'اشرح لي الفرق بين الأندرتون الدافئ والبارد والمحايد وأفضل ألوان الملابس المناسبة لكل منها.',
  },
  {
    topic: 'القَصّات وتناسق المقاس',
    prompt: 'ما الفرق بين قَصّات Slim وRegular وRelaxed وOversized وكيف تؤثر على مظهر الإطلالة؟',
  },
  {
    topic: 'إطلالة الجامعة والعمل',
    prompt: 'رشح لي قطعاً عملية من الكتالوج تناسب الجامعة أو مقابلة عمل غير رسمية.',
  },
  {
    topic: 'خزانة ملابس مصغرة',
    prompt: 'ساعدني في بناء خزانة ملابس أساسية (Capsule Wardrobe) بأسلوب بسيط وعصري من المتجر.',
  },
  {
    topic: 'القياس ونقاط الولاء',
    prompt: 'كيف أستخدم القياس الافتراضي ومسح المقاس بالكاميرا ونظام خصم نقاط الولاء؟',
  },
];

const AESTHETIC_OPTIONS = [
  { value: 'Minimalist', ar: 'بسيط Minimalist' },
  { value: 'Streetwear', ar: 'ستريت وير' },
  { value: 'Smart Casual', ar: 'سمارت كاجوال' },
  { value: 'Classic', ar: 'كلاسيكي' },
];

const FIT_OPTIONS = [
  { value: 'Slim', ar: 'سليم Slim' },
  { value: 'Regular', ar: 'عادي Regular' },
  { value: 'Relaxed', ar: 'مريح Relaxed' },
  { value: 'Oversized', ar: 'واسع Oversized' },
];

const UNDERTONE_OPTIONS = [
  { value: 'Warm', ar: 'دافئ Warm' },
  { value: 'Cool', ar: 'بارد Cool' },
  { value: 'Neutral', ar: 'محايد Neutral' },
];

function renderFormattedText(text: string) {
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return <div key={lineIdx} style={{ height: 6 }} />;
    }

    const isBullet = /^[-*•]\s+/.test(trimmed);
    const cleanLine = isBullet ? trimmed.replace(/^[-*•]\s+/, '') : line;

    // Parse **bold** segments safely without dangerouslySetInnerHTML
    const parts = cleanLine.split(/(\*\*[^*]+\*\*)/g);
    const renderedInline = parts.map((segment, segIdx) => {
      if (segment.startsWith('**') && segment.endsWith('**') && segment.length > 4) {
        return <strong key={segIdx}>{segment.slice(2, -2)}</strong>;
      }
      return <span key={segIdx}>{segment}</span>;
    });

    if (isBullet) {
      return (
        <div key={lineIdx} className="assistant-msg-bullet">
          <span className="assistant-bullet-dot" aria-hidden="true">
            •
          </span>
          <span>{renderedInline}</span>
        </div>
      );
    }

    return (
      <p key={lineIdx} className="assistant-msg-paragraph">
        {renderedInline}
      </p>
    );
  });
}

export function FashionAssistantPanel({
  compact = false,
  onNavigateAway,
}: FashionAssistantPanelProps) {
  const { language, t } = useLanguage();
  const {
    selectedItemDetails,
    selectedVariant,
    selectItem,
  } = useStudio();
  const {
    assistantMessages,
    assistantSending,
    assistantError,
    assistantConfigured,
    assistantModel,
    latestScannedSize,
    stylePreferences,
    setStylePreferences,
    sendAssistantPrompt,
    retryLastAssistantPrompt,
    clearAssistantChat,
    prepareCheckoutFromItem,
    addToCart,
    setCartDrawerOpen,
  } = useCommerce();

  const [inputValue, setInputValue] = useState('');
  const [showPrefs, setShowPrefs] = useState(false);
  const [openingBuyId, setOpeningBuyId] = useState<number | null>(null);
  const [addingCartId, setAddingCartId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [assistantMessages.length, assistantSending, assistantError]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed || assistantSending) return;
    setInputValue('');
    await sendAssistantPrompt(trimmed);
  };

  const handleStarterClick = async (prompt: string) => {
    if (assistantSending) return;
    await sendAssistantPrompt(prompt);
  };

  const handleOpenInStudio = (itemId: number) => {
    selectItem(itemId);
    onNavigateAway?.();
    navigate(`/?item=${itemId}`);
  };

  const handleBuyRecommended = async (itemId: number) => {
    setOpeningBuyId(itemId);
    try {
      const details =
        selectedItemDetails?.id === itemId
          ? selectedItemDetails
          : await fashionApi.getFashionItemDetails(itemId);
      selectItem(itemId);
      const defaultSize =
        details.availableSizes && details.availableSizes.length === 1
          ? details.availableSizes[0]
          : null;
      prepareCheckoutFromItem({
        item: details,
        variant: details.variants?.[0] ?? null,
        size: defaultSize,
        quantity: 1,
      });
      onNavigateAway?.();
      navigate('/checkout');
    } catch {
      selectItem(itemId);
      onNavigateAway?.();
      navigate(`/?item=${itemId}`);
    } finally {
      setOpeningBuyId(null);
    }
  };

  const handleAddToCartRecommended = async (itemId: number) => {
    setAddingCartId(itemId);
    try {
      const details =
        selectedItemDetails?.id === itemId
          ? selectedItemDetails
          : await fashionApi.getFashionItemDetails(itemId);
      const defaultSize =
        details.availableSizes && details.availableSizes.length > 0
          ? details.availableSizes[0]
          : null;
      const res = addToCart({
        item: details,
        variant: details.variants?.[0] ?? null,
        size: defaultSize,
        quantity: 1,
      });
      if (res.ok) {
        onNavigateAway?.();
        setCartDrawerOpen(true);
      }
    } catch {
      selectItem(itemId);
      onNavigateAway?.();
      navigate(`/?item=${itemId}`);
    } finally {
      setAddingCartId(null);
    }
  };

  const starters = language === 'ar' ? STARTERS_AR : STARTERS_EN;
  const contextualStarter = selectedItemDetails
    ? language === 'ar'
      ? `ما القطع والألوان التي يمكنني تنسيقها مع "${selectedItemDetails.name}"${
          selectedVariant?.colorName ? ` باللون ${selectedVariant.colorName}` : ''
        }؟`
      : `What can I wear with "${selectedItemDetails.name}"${
          selectedVariant?.colorName ? ` in ${selectedVariant.colorName}` : ''
        }?`
    : null;

  return (
    <div className={`assistant-panel ${compact ? 'compact' : 'full'}`}>
      {/* Top Bar */}
      <div className="assistant-header">
        <div className="assistant-header-info">
          <div className="assistant-avatar-badge" aria-hidden="true">
            <Sparkles size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 className="assistant-title">{t('stylistTitle')}</h2>
              {assistantModel && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '999px',
                    background: 'var(--bg-surface-subtle)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <bdi dir="ltr">{assistantModel}</bdi>
                </span>
              )}
            </div>
            {!compact && (
              <p className="assistant-subtitle">{t('stylistSubtitle')}</p>
            )}
          </div>
        </div>

        <div className="assistant-header-actions">
          <button
            type="button"
            className={`btn btn-sm ${showPrefs ? 'btn-purple' : 'btn-secondary'}`}
            onClick={() => setShowPrefs((prev) => !prev)}
            aria-expanded={showPrefs}
          >
            <SlidersHorizontal size={14} aria-hidden="true" />
            <span>{language === 'ar' ? 'تفضيلاتي' : 'Style Profile'}</span>
          </button>

          {assistantMessages.length > 0 && (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={clearAssistantChat}
              disabled={assistantSending}
            >
              <MessageSquarePlus size={14} aria-hidden="true" />
              <span>{t('stylistClear')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Optional Style Preferences Bar */}
      {showPrefs && (
        <div
          className="assistant-prefs-bar"
          role="region"
          aria-label={language === 'ar' ? 'تفضيلات الأناقة' : 'Style preferences'}
        >
          <div className="assistant-pref-group">
            <span className="assistant-pref-label">
              {language === 'ar' ? 'الأسلوب:' : 'Style:'}
            </span>
            <div className="assistant-pref-chips">
              {AESTHETIC_OPTIONS.map((opt) => {
                const active = stylePreferences.aesthetic === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`pref-chip ${active ? 'active' : ''}`}
                    onClick={() =>
                      setStylePreferences({
                        ...stylePreferences,
                        aesthetic: active ? undefined : opt.value,
                      })
                    }
                  >
                    {language === 'ar' ? opt.ar : opt.value}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="assistant-pref-group">
            <span className="assistant-pref-label">
              {language === 'ar' ? 'القَصّة:' : 'Fit:'}
            </span>
            <div className="assistant-pref-chips">
              {FIT_OPTIONS.map((opt) => {
                const active = stylePreferences.fit === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`pref-chip ${active ? 'active' : ''}`}
                    onClick={() =>
                      setStylePreferences({
                        ...stylePreferences,
                        fit: active ? undefined : opt.value,
                      })
                    }
                  >
                    {language === 'ar' ? opt.ar : opt.value}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="assistant-pref-group">
            <span className="assistant-pref-label">
              {language === 'ar' ? 'درجة الألوان:' : 'Undertone:'}
            </span>
            <div className="assistant-pref-chips">
              {UNDERTONE_OPTIONS.map((opt) => {
                const active = stylePreferences.undertone === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`pref-chip ${active ? 'active' : ''}`}
                    onClick={() =>
                      setStylePreferences({
                        ...stylePreferences,
                        undertone: active ? undefined : opt.value,
                      })
                    }
                  >
                    {language === 'ar' ? opt.ar : opt.value}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Active Studio Context Strip */}
      {(selectedItemDetails || latestScannedSize) && (
        <div className="assistant-context-strip">
          <span className="assistant-context-dot" aria-hidden="true" />
          <span>
            {selectedItemDetails && (
              <>
                {language === 'ar' ? 'القطعة المحددة حالياً:' : 'Active item context:'}{' '}
                <strong>{selectedItemDetails.name}</strong>
                {selectedVariant?.colorName ? ` (${selectedVariant.colorName})` : ''}
              </>
            )}
            {latestScannedSize && (
              <span style={{ marginInlineStart: selectedItemDetails ? 8 : 0 }}>
                {language === 'ar' ? '• المقاس الممسوح:' : '• Scanned Size:'}{' '}
                <strong>{latestScannedSize}</strong>
              </span>
            )}
          </span>
          {contextualStarter && assistantMessages.length === 0 && (
            <button
              type="button"
              className="assistant-context-quick-btn"
              onClick={() => void handleStarterClick(contextualStarter)}
              disabled={assistantSending}
            >
              {language === 'ar' ? 'نسّق هذه القطعة ←' : 'Style this item →'}
            </button>
          )}
        </div>
      )}

      {assistantConfigured === false && (
        <div className="banner banner-warning" style={{ margin: '10px 16px 0' }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>
            {language === 'ar'
              ? 'مفتاح GEMINI_API_KEY غير مضبوط على الخادم حالياً.'
              : 'Server GEMINI_API_KEY is not configured yet.'}
          </span>
        </div>
      )}

      {/* Messages Feed / Welcome Empty State */}
      <div className="assistant-messages-area" role="log" aria-live="polite">
        {assistantMessages.length === 0 ? (
          <div className="assistant-welcome">
            <div className="assistant-welcome-icon" aria-hidden="true">
              <Sparkles size={26} />
            </div>
            <h3>{t('stylistEmptyTitle')}</h3>
            <p>{t('stylistEmptyDesc')}</p>

            <div className="assistant-starters-grid">
              {starters.map((starter) => (
                <button
                  key={starter.topic}
                  type="button"
                  className="assistant-starter-card"
                  onClick={() => void handleStarterClick(starter.prompt)}
                  disabled={assistantSending}
                >
                  <span className="assistant-starter-topic">{starter.topic}</span>
                  <span className="assistant-starter-prompt">{starter.prompt}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="assistant-message-list">
            {assistantMessages.map((msg) => {
              const isArabicMsg = /[\u0600-\u06FF]/.test(msg.content);
              return (
                <div
                  key={msg.id}
                  className={`assistant-bubble-row ${
                    msg.role === 'user' ? 'user' : 'assistant'
                  }`}
                >
                  <div
                    className={`assistant-bubble ${msg.role}`}
                    dir={isArabicMsg ? 'rtl' : 'ltr'}
                  >
                    <div className="assistant-bubble-text">
                      {renderFormattedText(msg.content)}
                    </div>

                    {/* Grounded Catalog Product Cards */}
                    {msg.recommendedItems && msg.recommendedItems.length > 0 && (
                      <div className="assistant-recs-grid">
                        {msg.recommendedItems.map((rec) => (
                          <div key={rec.id} className="assistant-rec-card">
                            <div className="assistant-rec-thumb">
                              <GarmentImage
                                src={rec.thumbnailUrl}
                                alt={rec.name}
                                categoryName={rec.categoryName}
                                aspectRatio="4/5"
                              />
                            </div>
                            <div className="assistant-rec-body">
                              <div className="assistant-rec-cat">
                                {rec.categoryName}
                              </div>
                              <div className="assistant-rec-name"><bdi>{rec.name}</bdi></div>
                              <div className="assistant-rec-price">
                                <bdi dir="ltr">{formatEgp(rec.priceEgp, language)}</bdi>{' '}
                                <span className="assistant-rec-usd">
                                  <bdi dir="ltr">(${rec.priceUsd.toFixed(2)})</bdi>
                                </span>
                              </div>
                              <div className="assistant-rec-actions" style={{ flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary"
                                  onClick={() => handleOpenInStudio(rec.id)}
                                >
                                  <Sparkles size={12} aria-hidden="true" />
                                  <span>{t('stylistTryOnItem')}</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-secondary"
                                  disabled={addingCartId === rec.id}
                                  onClick={() => void handleAddToCartRecommended(rec.id)}
                                >
                                  <ShoppingCart size={12} aria-hidden="true" />
                                  <span>{t('addToCart')}</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-accent"
                                  disabled={openingBuyId === rec.id}
                                  onClick={() => void handleBuyRecommended(rec.id)}
                                >
                                  <ShoppingBag size={12} aria-hidden="true" />
                                  <span>{t('stylistBuyItem')}</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {assistantSending && (
              <div className="assistant-bubble-row assistant">
                <div className="assistant-bubble assistant typing-bubble">
                  <div className="typing-dots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  <span>{t('stylistTyping')}</span>
                </div>
              </div>
            )}

            {assistantError && (
              <div className="banner banner-error" role="alert">
                <AlertCircle size={17} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>{assistantError}</div>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => void retryLastAssistantPrompt()}
                  disabled={assistantSending}
                >
                  <RefreshCw size={13} aria-hidden="true" />
                  <span>{t('stylistRetry')}</span>
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Composer Form */}
      <form className="assistant-composer" onSubmit={(e) => void handleSubmit(e)}>
        <div className="assistant-input-row">
          <input
            type="text"
            className="assistant-text-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={t('stylistInputPlaceholder')}
            aria-label={t('stylistInputPlaceholder')}
            maxLength={1200}
            disabled={assistantSending}
          />
          <button
            type="submit"
            className="btn btn-purple assistant-send-btn"
            disabled={!inputValue.trim() || assistantSending}
          >
            <Send size={16} aria-hidden="true" />
            <span>{t('stylistSend')}</span>
          </button>
        </div>
        <div
          className="assistant-privacy-hint"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>{t('stylistSessionNote')}</span>
          <span dir="ltr">{inputValue.length}/1200</span>
        </div>
      </form>
    </div>
  );
}

