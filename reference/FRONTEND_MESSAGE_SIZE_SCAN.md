أهلًا يا شباب 👋 فيه ميزة جديدة في الـ Backend: **"اعرف مقاسك من الكاميرا"**، وجاهزة من عندنا.

━━━━━━━━━━━━━━━━━━
🧠 الفكرة في سطرين
━━━━━━━━━━━━━━━━━━
المستخدم يقف قدام الكاميرا 3 ثواني، المتصفح يلقط حوالي 20 صورة ويبعتهم للـ Backend، والـ Backend يرجّع المقاس المناسب.
التحليل بيعمله AI service منفصل. **انتوا مش هتكلّموه خالص**، بتكلّمونا إحنا بس (endpoint واحد).

━━━━━━━━━━━━━━━━━━
🔌 الـ Endpoint
━━━━━━━━━━━━━━━━━━
POST https://clothesai3d.runasp.net/api/fashion-items/{id}/size-scan
Content-Type: multipart/form-data
• field اسمه frames، متكرر من 8 لـ 40 مرة (JPEG أو PNG، كل صورة أقصاها 2MB، والمجموع أقصاه 20MB)
• الأنسب: 15 لـ 30 صورة JPEG على مدار حوالي 3 ثواني

✅ 200:
{ "size": "M", "alternative": "L", "borderline": true, "sizeRange": "M-L", "confidence": "high" }
• لو borderline = true اعرضوا sizeRange ("بين M و L")، غير كده اعرضوا size.
• size دايمًا مقاس متاح للمنتج ده، فمش محتاجين تنادوا size-check بعدها.
• confidence: high أو medium أو low. لو low اعرضوا المقاس واقترحوا "جرّب تاني لنتيجة أدق".
  لو n/a يبقى المنتج ليه مقاس واحد بس، فاتعرض من غير تحليل.

❌ الأخطاء (نفس شكل { error, errors } المعتاد):
• 422: الصور مانفعتش (مفيش شخص، قريب أوي، لافف، الجسم مش باين كله).
  اعرضوا error زي ما هو (مكتوبة للمستخدم) وخلّوه يعيد. وفيه كمان code: no_pose أو too_close أو turned أو bad_height.
• 400: مشكلة في الصور اللي اتبعتت (العدد أو النوع أو الحجم). ده bug عندنا، مش رسالة للمستخدم.
• 404: المنتج مش موجود.
• 409: المنتج مالوش مقاسات (منتجات Decart حاليًا). اعرضوا "المقاسات غير متوفرة لهذا المنتج".
• 429: أكتر من 10 محاولات في الدقيقة.
• 502: خدمة الـ AI مش متاحة. اعرضوا "مش قادرين نحدد مقاسك دلوقتي، جرّب بعد شوية".
  ⚠️ لحد ما خدمة الـ AI تترفع وتتربط، الـ endpoint هيرجّع 502. اعملوا الـ UI عادي وهيشتغل أول ما تتربط.

━━━━━━━━━━━━━━━━━━
📦 الملفات المرفقة: size-scan-frontend-files.zip
━━━━━━━━━━━━━━━━━━
1) src/services/fashionApi.ts (اتحدث)
   • scanSize(id, frames: Blob[]): بيبني الـ FormData ويبعت.
   • type SizeScanResult.
   • class ApiError: كل الأخطاء بقت ApiError فيها status وcode، والـ message هو نفس error من الـ backend.
     ده backward compatible: ApiError بيورث من Error، فالكود القديم اللي بيعمل err.message شغال زي ما هو.
   ⚠️ ماتحطوش Content-Type بإيدكم مع FormData، المتصفح بيحط الـ boundary لوحده.

2) src/services/captureFrames.ts (جديد)
   captureFrames(video): بيلقط 20 صورة JPEG من الـ <video> على 3 ثواني، ومصغّرة لـ 1280px كحد أقصى.
   استخدموا videoRef بتاع الكاميرا العادية (مش aiVideoRef بتاع Decart).

الـ zip فيه الملفين دول بس، بنفس المسارات (src/services/...).
• captureFrames.ts: ملف جديد، حطوه على طول.
• fashionApi.ts: لو عدّلتوا فيه حاجة من بعد آخر نسخة بعتهالكم، اعملوا merge مش replace. والتعديل الجديد 3 حاجات بس: ApiError، وSizeScanResult، وscanSize().

━━━━━━━━━━━━━━━━━━
🧩 مثال استخدام (في StudioPage)
━━━━━━━━━━━━━━━━━━
import { fashionApi, ApiError, type SizeScanResult } from "../services/fashionApi";
import { captureFrames } from "../services/captureFrames";

const [scan, setScan] = useState<SizeScanResult | null>(null);
const [scanError, setScanError] = useState("");
const [scanning, setScanning] = useState(false);

async function findMySize() {
  if (!videoRef.current || status !== "live") return;
  setScanning(true); setScanError(""); setScan(null);
  try {
    const frames = await captureFrames(videoRef.current);           // حوالي 3 ثواني
    setScan(await fashionApi.scanSize(Number(selected.id), frames));
  } catch (err) {
    if (err instanceof ApiError && err.status === 422) setScanError(err.message);
    else if (err instanceof ApiError && err.status === 409) setScanError("Sizes aren't available for this item.");
    else setScanError("We couldn't get your size right now. Please try again.");
  } finally {
    setScanning(false);
  }
}

// العرض:
// scan && (scan.borderline ? `Your size: between ${scan.sizeRange}` : `Your size: ${scan.size}`)

━━━━━━━━━━━━━━━━━━
🎨 الـ UX المطلوب
━━━━━━━━━━━━━━━━━━
• زرار "Find my size" يظهر بعد ما الكاميرا تشتغل (status === "live")، ويتقفل وقت الـ scanning.
• قبل التصوير اعرضوا التعليمات وعدّاد 3-2-1:
  "قف على بعد 1-2 متر، جسمك كله باين من راسك لرجلك، وشك للكاميرا، ودراعاتك بعيد شوية عن جسمك."
• وقت التصوير والتحليل (3 ثواني تصوير + ثواني تحليل): loading.
  أول طلب بعد ما خدمة الـ AI تصحى ممكن ياخد لحد 60 ثانية، فخلّوا الـ loading واضح.
• بعد النتيجة: زرار "Try again".
• اعملوا الـ scan **قبل** Try On with AI أو من غيره، عشان الصور تتاخد من الكاميرا العادية.

━━━━━━━━━━━━━━━━━━
🔒 مهم: نص الخصوصية
━━━━━━━━━━━━━━━━━━
في StudioPage مكتوب: "Your camera stays on your device." ودي **مابقتش صحيحة**: صور الـ scan بتتبعت للسيرفر، وكمان Decart بياخد فيديو الكاميرا.
غيّروها لحاجة زي:
"To find your size, a few photos are sent to our server for analysis and are not stored."
والأفضل تظهر جنب زرار "Find my size" قبل ما المستخدم يدوس.

━━━━━━━━━━━━━━━━━━
⚠️ حدود معروفة (من فريق الـ AI)
━━━━━━━━━━━━━━━━━━
• الطول بيتقاس من الكاميرا، وحاليًا بيطلع أقل بحوالي 6%، فممكن المقاس ينزل درجة.
• محتاج الجسم كله يبان. كاميرا اللابتوب على المكتب غالبًا مش هتجيب الرجلين، فالمستخدم لازم يبعد أو يرفع اللابتوب.
• مقاس الجزء العلوي بس (تيشيرتات وبولو وهوديز وجواكت).

━━━━━━━━━━━━━━━━━━
🚧 الحالة دلوقتي
━━━━━━━━━━━━━━━━━━
الـ endpoint مرفوع وشغال، لكن خدمة الـ AI لسه مش مربوطة، فالـ endpoint هيرجّع 502 لحد ما أقولكم. ابنوا الـ UI عادي.
(الحالات اللي مش محتاجة AI شغالة من دلوقتي: 400 و404 و409، والمنتج اللي ليه مقاس واحد.)

أي سؤال، الـ endpoint موجود في Swagger: https://clothesai3d.runasp.net/swagger ✌️
