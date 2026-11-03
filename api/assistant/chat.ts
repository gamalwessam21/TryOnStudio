interface CatalogItemSummary {
  id: number;
  name: string;
  description: string;
  price: number;
  categoryId: number;
  categoryName: string;
  thumbnailUrl: string;
  variantCount: number;
}

interface CatalogVariantSummary {
  id: number;
  colorName: string;
  colorHex: string;
  imageUrl: string;
}

interface CatalogItemDetail extends CatalogItemSummary {
  variants?: CatalogVariantSummary[];
  availableSizes?: string[];
}

interface IncomingChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AssistantContextPayload {
  selectedItem?: {
    id: number;
    name: string;
    categoryName: string;
    priceUsd: number;
    selectedColor?: string | null;
    availableColors?: string[];
    availableSizes?: string[];
    description?: string;
  } | null;
  outfitConfirmed?: boolean;
  tryOnActive?: boolean;
  scannedSize?: string | null;
  stylePreferences?: {
    fit?: string;
    aesthetic?: string;
    undertone?: string;
    budgetEgp?: number | null;
  };
  verifiedLoyaltyPoints?: number | null;
}

interface IncomingChatBody {
  messages?: unknown;
  language?: unknown;
  context?: AssistantContextPayload;
}

const MAX_MESSAGE_CHARS = 1200;
const MAX_HISTORY_MESSAGES = 16;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 18;

const ipBuckets = new Map<string, { count: number; resetAt: number }>();

function getCatalogBaseUrl(): string {
  const raw = process.env.VITE_API_BASE_URL?.trim();
  return raw ? raw.replace(/\/+$/, '') : 'https://clothesai3d.runasp.net';
}

function getUsdToEgpRate(): number {
  const parsed = Number(process.env.USD_TO_EGP_RATE);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
}

function checkRateLimit(clientKey: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  if (ipBuckets.size > 500) {
    for (const [k, v] of ipBuckets.entries()) {
      if (v.resetAt <= now) ipBuckets.delete(k);
    }
  }
  const existing = ipBuckets.get(clientKey);
  if (!existing || existing.resetAt <= now) {
    ipBuckets.set(clientKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return { allowed: false, retryAfterSec };
  }
  existing.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

function scrubAccidentalPii(text: string): string {
  // Scrub raw card-like 13-19 digit sequences and long phone numbers before sending to Gemini
  return text
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, '[REDACTED_CARD]')
    .replace(/(?:\+?\d[\d\s-]{8,14}\d)/g, '[REDACTED_PHONE]');
}

function detectArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

async function fetchLiveCatalog(baseUrl: string): Promise<CatalogItemSummary[]> {
  try {
    const res = await fetch(`${baseUrl}/api/fashion-items`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? (data as CatalogItemSummary[]) : [];
  } catch (err) {
    console.error('[assistant/chat] Failed to fetch live catalog:', err);
    return [];
  }
}

async function fetchItemDetailsSafe(
  baseUrl: string,
  id: number
): Promise<CatalogItemDetail | null> {
  try {
    const res = await fetch(`${baseUrl}/api/fashion-items/${encodeURIComponent(String(id))}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as CatalogItemDetail;
  } catch {
    return null;
  }
}

function buildSystemInstruction(params: {
  catalog: CatalogItemSummary[];
  enrichedDetails: Map<number, CatalogItemDetail>;
  usdToEgpRate: number;
  uiLanguage: 'en' | 'ar';
  preferArabicReply: boolean;
  context?: AssistantContextPayload;
}): string {
  const {
    catalog,
    enrichedDetails,
    usdToEgpRate,
    uiLanguage,
    preferArabicReply,
    context,
  } = params;

  const catalogLines =
    catalog.length > 0
      ? catalog
          .map((item) => {
            const egp = Math.round(item.price * usdToEgpRate);
            const detail = enrichedDetails.get(item.id);
            const colors =
              detail?.variants?.map((v) => v.colorName).filter(Boolean).join(', ') ||
              `${item.variantCount} color variant(s)`;
            const sizes =
              detail?.availableSizes && detail.availableSizes.length > 0
                ? detail.availableSizes.join(', ')
                : 'Check item details (tops offer sizes; showcase items may have none)';
            const desc = (item.description || '').slice(0, 140);
            return `- ID ${item.id}: "${item.name}" | Category: ${item.categoryName} | Price: ${egp} EGP ($${item.price.toFixed(2)} USD) | Colors: ${colors} | Manufactured Sizes: ${sizes} | Summary: ${desc}`;
          })
          .join('\n')
      : '- Live catalog could not be loaded right now. Do NOT invent product names, prices, or IDs.';

  const selected = context?.selectedItem;
  const selectedBlock = selected
    ? [
        `Currently Selected Garment: ID ${selected.id} — "${selected.name}" (${selected.categoryName})`,
        `Price: ${Math.round(selected.priceUsd * usdToEgpRate)} EGP ($${selected.priceUsd.toFixed(2)} USD)`,
        `Selected Color: ${selected.selectedColor || 'Default'}`,
        `Available Colors: ${selected.availableColors?.join(', ') || 'See variant selector'}`,
        `Manufactured Sizes: ${
          selected.availableSizes && selected.availableSizes.length > 0
            ? selected.availableSizes.join(', ')
            : 'No sizes offered for this item'
        }`,
        `Outfit Confirmed: ${context?.outfitConfirmed ? 'Yes' : 'No'}`,
        `Live Virtual Try-On Streaming: ${context?.tryOnActive ? 'Active' : 'Not active'}`,
        `Recent Camera Size-Scan Result: ${context?.scannedSize || 'None confirmed in this session'}`,
      ].join('\n')
    : 'Currently Selected Garment: None selected yet.';

  const prefs = context?.stylePreferences;
  const prefsBlock = prefs
    ? [
        prefs.aesthetic ? `Preferred Aesthetic: ${prefs.aesthetic}` : '',
        prefs.fit ? `Preferred Fit: ${prefs.fit}` : '',
        prefs.undertone ? `Self-Described Undertone/Palette: ${prefs.undertone}` : '',
        prefs.budgetEgp ? `Target Budget: ${prefs.budgetEgp} EGP` : '',
      ]
        .filter(Boolean)
        .join(' | ') || 'None specified yet.'
    : 'None specified yet.';

  const loyaltyBlock =
    typeof context?.verifiedLoyaltyPoints === 'number'
      ? `Verified Customer Loyalty Balance: ${context.verifiedLoyaltyPoints} points (worth ${Math.floor(context.verifiedLoyaltyPoints / 100) * 10} EGP in redeemable discounts).`
      : 'Verified Customer Loyalty Balance: Not verified in this session.';

  const targetLanguageNote = preferArabicReply
    ? 'Respond in natural, polished, friendly Arabic (العربية) matching the user message.'
    : uiLanguage === 'ar'
    ? 'The UI is currently in Arabic; respond in Arabic unless the user clearly writes in English.'
    : 'Respond in clear, warm, stylish English unless the user writes in Arabic.';

  return `You are the **TryOnStudio Personal Fashion & Styling Assistant**, an expert personal stylist embedded inside TryOnStudio — an AI virtual clothing try-on and camera size-scanning platform.

LANGUAGE RULE:
- ${targetLanguageNote}

YOUR ROLE & TONE:
- Speak like a knowledgeable, encouraging personal stylist — warm, practical, concise, and tailored to the user's preferences (never stiff or generic customer-support robotic).
- Structure longer advice with short bullet points so it is easy to scan on mobile and desktop.

CORE TOPICS YOU HELP WITH & STRICT GUARDRAILS:
1. **Outfit Coordination**: Combine t-shirts, polos, hoodies, sweatshirts, jackets, trousers, footwear, and accessories; layering, color harmony, seasonal styling, and building multiple looks around one piece.
2. **Skin Tone & Color Matching**: Explain warm, cool, and neutral undertones, complementary neutrals, and accent colors as helpful, flexible inspiration — NEVER as rigid rules. **CRITICAL**: NEVER claim to detect or determine a user's skin tone from a photo or camera feed; instead invite them to share their color preferences or describe their undertone if they wish.
3. **Body Proportions & Clothing Fit**: Explain slim, regular, relaxed, and oversized silhouettes, how cuts shape proportions, and the difference between personal style preference vs. garment sizing. **CRITICAL**: Always remain inclusive, respectful, and comfort-focused; NEVER make negative judgments about body shapes or promote unrealistic body standards.
4. **Occasion-Based Styling**: University, work/interviews, parties/social events, dates, travel, everyday wear, and seasonal weather.
5. **Personal Style Discovery**: Minimalist, classic, streetwear, casual, smart-casual, formal, wardrobe essentials, and budget-aware capsule wardrobes.
6. **Catalog-Grounded Product Recommendations**:
   - ONLY recommend specific TryOnStudio products from the LIVE CATALOG below.
   - NEVER invent product names, prices, discounts, stock counts, sizes, or URLs.
   - Note honestly that listed sizes on TryOnStudio represent *manufactured sizes* for that design, not real-time warehouse stock counts.
   - Currently our live catalog focuses on upper-body tops (T-Shirts, Polo Shirts, Hoodies & Sweatshirts, Jackets); when building a full head-to-toe outfit, recommend the real top/jacket from our catalog and suggest general styles/colors of trousers and shoes to pair with it (making clear which items are from our catalog vs. general pairing ideas).
7. **Virtual Try-On & Camera Size-Scan Assistance**:
   - Virtual Try-On: User selects a garment & color variant, enables their camera over HTTPS, clicks "Start Try-On" (streams via Decart WebRTC), and can swipe their hand left/right (MediaPipe gesture) or use Next/Previous controls to cycle variants, then click "Choose This Outfit".
   - Camera Size Scan: Works for tops with manufactured sizes. User turns off live AI try-on (uses raw camera), stands 1–2 metres back with full body from head to feet visible in good lighting for a 3-second (or 8-second) countdown while ~20 frames are analyzed. Note honestly that camera height estimation currently reads ~6% low, so borderline results may shift by one size.
   - **CRITICAL**: NEVER claim that a virtual try-on or size scan succeeded unless the Context below explicitly shows it is active/completed.
8. **Shopping, Checkout, Receipts & Loyalty Rewards**:
   - Prices are converted from catalog USD using the store rate (1 USD = ${usdToEgpRate} EGP).
   - Checkout collects Full Name and Mobile Phone Number, validates variant/size selection, and supports Cash on Delivery (COD) and hosted Stripe Sandbox online card payment (never raw card entry in our app), generating a persisted Digital Receipt once the backend confirms the order.
   - **Loyalty Program Rules**: Customers earn **1 point for every 10 EGP** spent on eligible completed purchases (after discounts; pending, failed, or cancelled orders earn 0 points, and refunds reverse points). Points redeem at **100 points = 10 EGP discount** (minimum 100 points) after customer identity verification (a phone number alone without verification cannot spend an existing balance).
9. **General Fashion Education**: Color theory, garment silhouettes, layering, and practical garment care (only state general care best practices unless specific fabric details exist in the item summary).

LIVE TRYONSTUDIO CATALOG (${catalog.length} items):
${catalogLines}

CURRENT APPLICATION CONTEXT:
${selectedBlock}
User Style Preferences: ${prefsBlock}
${loyaltyBlock}

MACHINE-READABLE RECOMMENDATION TAG RULE:
- Whenever your answer recommends 1 to 4 specific items from the LIVE TRYONSTUDIO CATALOG above, append a single line at the very end of your message in this exact format using their real numeric IDs:
[[RECOMMENDED_IDS: 1, 8]]
- Do NOT include IDs that are not in the live catalog above. If you are not recommending specific catalog items in this turn, omit that tag completely.`;
}

function extractRecommendations(
  rawText: string,
  catalog: CatalogItemSummary[],
  usdToEgpRate: number
): {
  cleanReply: string;
  recommendedItems: Array<{
    id: number;
    name: string;
    categoryName: string;
    priceUsd: number;
    priceEgp: number;
    thumbnailUrl: string;
    variantCount: number;
  }>;
} {
  const catalogById = new Map(catalog.map((it) => [it.id, it]));
  const pickedIds: number[] = [];

  const tagRegex = /\[\[RECOMMENDED_IDS:\s*([\d,\s]+)\]\]/gi;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(rawText)) !== null) {
    const nums = match[1]
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && catalogById.has(n));
    for (const id of nums) {
      if (!pickedIds.includes(id)) pickedIds.push(id);
    }
  }

  const cleanReply = rawText.replace(tagRegex, '').trim();

  // Fallback: if Gemini mentioned exact catalog item names without the tag, surface up to 3
  if (pickedIds.length === 0 && catalog.length > 0) {
    const lowerReply = cleanReply.toLowerCase();
    for (const item of catalog) {
      if (item.name && lowerReply.includes(item.name.toLowerCase())) {
        if (!pickedIds.includes(item.id)) pickedIds.push(item.id);
        if (pickedIds.length >= 3) break;
      }
    }
  }

  const recommendedItems = pickedIds.slice(0, 4).map((id) => {
    const item = catalogById.get(id)!;
    return {
      id: item.id,
      name: item.name,
      categoryName: item.categoryName,
      priceUsd: item.price,
      priceEgp: Math.round(item.price * usdToEgpRate),
      thumbnailUrl: item.thumbnailUrl,
      variantCount: item.variantCount,
    };
  });

  return { cleanReply, recommendedItems };
}

export async function GET(): Promise<Response> {
  const configured = Boolean(process.env.GEMINI_API_KEY?.trim());
  return Response.json({
    configured,
    provider: 'google-gemini',
    model: process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash',
    usdToEgpRate: getUsdToEgpRate(),
  });
}

export async function POST(request: Request): Promise<Response> {
  const forwardedFor = request.headers.get('x-forwarded-for') || 'local';
  const clientIp = forwardedFor.split(',')[0].trim() || 'local';
  const rate = checkRateLimit(clientIp);
  if (!rate.allowed) {
    return Response.json(
      {
        error: 'Too many fashion assistant messages in a short time. Please wait a moment and try again.',
        code: 'rate_limited',
      },
      {
        status: 429,
        headers: { 'Retry-After': String(rate.retryAfterSec) },
      }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.error('[assistant/chat] GEMINI_API_KEY is missing in server environment.');
    return Response.json(
      {
        error:
          'The AI Fashion Assistant is not configured on the server yet (missing GEMINI_API_KEY).',
        code: 'ai_unconfigured',
      },
      { status: 503 }
    );
  }

  let body: IncomingChatBody;
  try {
    body = (await request.json()) as IncomingChatBody;
  } catch {
    return Response.json(
      { error: 'Invalid JSON request payload.', code: 'invalid_json' },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json(
      { error: 'Please enter a message for the Fashion Assistant.', code: 'empty_messages' },
      { status: 400 }
    );
  }

  const sanitizedMessages: IncomingChatMessage[] = [];
  for (const rawMsg of body.messages.slice(-MAX_HISTORY_MESSAGES)) {
    if (!rawMsg || typeof rawMsg !== 'object') continue;
    const role = (rawMsg as { role?: unknown }).role;
    const content = (rawMsg as { content?: unknown }).content;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') {
      continue;
    }
    const trimmed = content.trim();
    if (!trimmed) continue;
    if (role === 'user' && trimmed.length > MAX_MESSAGE_CHARS) {
      return Response.json(
        {
          error: `Message is too long (maximum ${MAX_MESSAGE_CHARS} characters).`,
          code: 'message_too_long',
        },
        { status: 400 }
      );
    }
    sanitizedMessages.push({
      role,
      content: scrubAccidentalPii(trimmed.slice(0, MAX_MESSAGE_CHARS * 2)),
    });
  }

  const lastMessage = sanitizedMessages[sanitizedMessages.length - 1];
  if (!lastMessage || lastMessage.role !== 'user') {
    return Response.json(
      { error: 'The latest message must be from the user.', code: 'invalid_turn' },
      { status: 400 }
    );
  }

  const uiLanguage: 'en' | 'ar' = body.language === 'ar' ? 'ar' : 'en';
  const preferArabicReply = detectArabic(lastMessage.content);
  const catalogBaseUrl = getCatalogBaseUrl();
  const usdToEgpRate = getUsdToEgpRate();

  const catalog = await fetchLiveCatalog(catalogBaseUrl);
  const enrichedDetails = new Map<number, CatalogItemDetail>();

  // Enrich details for up to 6 items (including currently selected item) for exact color/size grounding
  const detailIds = new Set<number>();
  if (body.context?.selectedItem?.id) {
    detailIds.add(body.context.selectedItem.id);
  }
  for (const item of catalog.slice(0, 5)) {
    detailIds.add(item.id);
  }
  await Promise.all(
    Array.from(detailIds).map(async (id) => {
      const det = await fetchItemDetailsSafe(catalogBaseUrl, id);
      if (det) enrichedDetails.set(id, det);
    })
  );

  const systemInstruction = buildSystemInstruction({
    catalog,
    enrichedDetails,
    usdToEgpRate,
    uiLanguage,
    preferArabicReply,
    context: body.context,
  });

  const geminiContents = sanitizedMessages.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const primaryModel = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash';
  const candidateModels = Array.from(new Set([primaryModel, 'gemini-2.5-flash-lite']));

  let lastStatus = 502;
  let lastErrorText = '';

  for (const modelName of candidateModels) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 24_000);
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          modelName
        )}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemInstruction }],
            },
            contents: geminiContents,
            generationConfig: {
              temperature: 0.65,
              maxOutputTokens: 1400,
            },
          }),
          signal: controller.signal,
        }
      );

      lastStatus = geminiRes.status;
      if (!geminiRes.ok) {
        lastErrorText = await geminiRes.text().catch(() => '');
        console.error(
          `[assistant/chat] Gemini model ${modelName} returned HTTP ${geminiRes.status}`
        );
        if (geminiRes.status === 429) {
          return Response.json(
            {
              error:
                'The AI stylist is handling high traffic right now. Please wait a few seconds and try again.',
              code: 'provider_rate_limited',
            },
            { status: 429 }
          );
        }
        continue;
      }

      const payload = (await geminiRes.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              text?: string;
              thought?: boolean;
            }>;
          };
        }>;
      };

      const candidateParts = payload.candidates?.[0]?.content?.parts ?? [];
      const nonThoughtParts = candidateParts.filter((p) => !p.thought);
      const partsToUse = nonThoughtParts.length > 0 ? nonThoughtParts : candidateParts;
      const rawReply = partsToUse
        .map((p) => p.text ?? '')
        .join('')
        .trim();

      if (!rawReply) {
        continue;
      }

      const { cleanReply, recommendedItems } = extractRecommendations(
        rawReply,
        catalog,
        usdToEgpRate
      );

      return Response.json({
        reply: cleanReply,
        model: modelName,
        recommendedItems,
      });
    } catch (err) {
      console.error(`[assistant/chat] Error calling Gemini model ${modelName}:`, err);
    } finally {
      clearTimeout(timer);
    }
  }

  console.error('[assistant/chat] All Gemini model attempts failed:', lastStatus, lastErrorText.slice(0, 160));
  return Response.json(
    {
      error:
        'Could not generate a styling response right now. Please try again in a moment.',
      code: 'ai_unavailable',
    },
    { status: 502 }
  );
}

