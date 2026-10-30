السلام عليكم يا شباب 👋
الـ Backend اترفع وشغال. ده كل اللي محتاجينه عشان نربط.

━━━━━━━━━━━━━━━━━━
🔗 الروابط
━━━━━━━━━━━━━━━━━━
• API: https://clothesai3d.runasp.net
• Swagger (كل الـ endpoints وتقدروا تجربوها): https://clothesai3d.runasp.net/swagger
• Health: https://clothesai3d.runasp.net/api/health

اعملوا ملف .env في root المشروع وحطوا فيه:
VITE_API_BASE_URL=https://clothesai3d.runasp.net
(من غير / في الآخر، وبعدين restart لـ npm run dev)

━━━━━━━━━━━━━━━━━━
📦 الملف المرفق: frontend-changes.zip
━━━━━━━━━━━━━━━━━━
فيه 5 ملفات من src بعد التعديل، ونفس التعديلات في frontend-changes.patch.
ليه لازم تبدّلوهم؟ لأن الفرونت الحالي فيه حاجات مش هتشتغل مع الـ Backend الجديد:

1) src/services/fashionApi.ts ← أهم ملف
   • الـ BASE_URL كان مكتوب ثابت على "clothesai-api.runasp.net" (السيرفر القديم). بقى بيتقري من VITE_API_BASE_URL، يعني تغيّروا السيرفر من الـ .env من غير ما تلمسوا الكود.
   • اتضافت الـ types الجديدة: availableSizes في FashionItemDetails، وtryOnPrompt في FashionVariant، وSizeCheckResult وRackItem.
   • اتضافت functions جديدة: getSizes() وgetItemSizes(id) وcheckSize(id, size) وgetRackItems(take).

2) src/vite-env.d.ts
   • تعريف type لـ VITE_API_BASE_URL، عشان TypeScript مايدّيش error على import.meta.env.

3) src/main.tsx
   • كان بيعمل render لـ <App /> بدل <Root />، فـ Root كانت declared ومش مستخدمة. ده كان مخلّي npm run build يفشل أصلًا (TS6133). دلوقتي البيلد بيعدّي، وصفحة #/rack بتفتح.

4) src/components/HomePage.tsx
   • الـ ClothingRack كان بياخد IDs ثابتة من الكود ("hd1", "jk2"...)، ودي مش موجودة في الـ API، فزرار "Try it on" كان بيفتح منتج غلط.
   • دلوقتي بيجيب القطع من GET /api/fashion-items/rack، ومعاها صور اللف (frames) الحقيقية، والـ ID صح.
   • لو الـ API مارجّعش حاجة، الـ Rack مابيظهرش بدل ما الصفحة تقع.

5) src/components/StudioPage.tsx
   • تعديل صغير: لو اللون عنده tryOnPrompt، بيتبعت لـ Decart كـ prompt في setImage() بدل الـ prompt العام. Decart بيقول إن الوصف الدقيق بيحسّن النتيجة. لو null، بيستخدم الـ prompt القديم زي ما هو.

⚠️ مهم: الملفات دي معمولة على النسخة اللي اتبعتتلي (فيها ClothingRack). لو عدّلتوا في الملفات دي من ساعتها، ماتعملوش replace على طول: طبّقوا الـ patch (git apply frontend-changes.patch)، أو قارنوا الملفات واعملوا merge، عشان شغلكم الجديد مايضيعش.
بعد التبديل اتأكدوا إن npm run build بيعدّي، وأنا مجرّبه عندي (tsc بيعدّي).

━━━━━━━━━━━━━━━━━━
❌ شكل الأخطاء (ثابت في كل الـ endpoints)
━━━━━━━━━━━━━━━━━━
{ "error": "Fashion item not found.", "errors": null }
{ "error": "Validation failed.", "errors": { "Size": ["size is required."] } }

request() عندكم بيقرا data.error أصلًا، فمش محتاجين تغيّروا حاجة.
400 = validation · 404 = مش موجود · 429 = طلبات توكن كتير · 502 = الـ AI مش متاح

━━━━━━━━━━━━━━━━━━
📚 الـ Endpoints
━━━━━━━━━━━━━━━━━━
Catalog:
• GET /api/categories → [{ id, name, slug, itemCount }]
• GET /api/categories/{id}/fashion-items → FashionItem[]
• GET /api/fashion-items?categoryId=&search= → FashionItem[] (الاتنين اختياريين)
• GET /api/fashion-items/{id} → { id, name, description, price, categoryId, categoryName, variants[], availableSizes[] }
• GET /api/fashion-items/{id}/variants → [{ id, colorName, colorHex, imageUrl, tryOnPrompt }]
• GET /api/fashion-items/rack?take=6 → [{ id, name, price, frames[] }]

المقاسات (جديد):
• GET /api/sizes → ["XS","S","M","L","XL","XXL","XXXL"]
• GET /api/fashion-items/{id}/sizes → ["S","M","XXL"]
• POST /api/fashion-items/{id}/size-check
   Body: { "size": "L" }
   Response: { "fashionItemId": 8, "requestedSize": "L", "isAvailable": false,
               "availableSizes": ["S","M","XXL"], "nearestAvailableSizes": ["M","XXL"] }

AI Try-On:
• POST /api/tryon/token → { apiKey, expiresAt }

━━━━━━━━━━━━━━━━━━
📏 سيناريو المقاس
━━━━━━━━━━━━━━━━━━
1. الـ AI بتاعكم يعمل scan للجسم ويطلّع مقاس. ده شغل الفرونت، ولسه مش موجود في الكود الحالي (فيه pose tracking بس).
2. حوّلوا النتيجة لواحد من الأكواد اللي في /api/sizes (case-insensitive، يعني "m" زي "M").
3. ابعتوها لـ size-check واعرضوا النتيجة: متاح، أو مش متاح وجنبه nearestAvailableSizes كاقتراح.
• isAvailable معناها "المنتج بيتعمل بالمقاس ده"، مش إن فيه مخزون.
• لو availableSizes فاضية، اعرضوا "المقاسات غير متوفرة" (منتجات Decart حاليًا مالهاش مقاسات).
• للتجربة: Darko Polo متاح بس في S وM وXXL.

━━━━━━━━━━━━━━━━━━
🤖 الـ AI (Decart)
━━━━━━━━━━━━━━━━━━
• /api/tryon/token بيرجّع توكن مؤقت (حوالي دقيقتين) من Decart. المفتاح الحقيقي متخزن على السيرفر ومش هيوصلكم، وده عشان محدش ياخده من المتصفح.
• apiKeyProvider في StudioPage بيطلبه قبل كل connect، وده الصح. ماتخزنوش التوكن.
• لحد ما نحط مفتاح Decart على السيرفر، الـ endpoint ده هيرجّع 502، وباقي الحاجات كلها شغالة.

━━━━━━━━━━━━━━━━━━
🖼️ الصور
━━━━━━━━━━━━━━━━━━
• thumbnailUrl وimageUrl وframes[] روابط كاملة: https://clothesai3d.runasp.net/api/media/{guid}، وعليها CORS، فـ fetch() للـ blob (اللي بتعملوه لـ Decart) شغال.
• imageUrl: القطعة لوحدها على خلفية بيضا، WebP مقاس 1000×1250 (4:5).
• frames: 24 صورة WebP شفافة مقاس 600×800 (3:4). [0] = من الضهر، وآخر واحدة = من الأمام.
• thumbnailUrl ممكن تبقى "" لو مفيش صورة، والكود عندكم بيعرض GarmentArt في الحالة دي.

━━━━━━━━━━━━━━━━━━
📝 ملاحظات
━━━━━━━━━━━━━━━━━━
• كل الـ IDs أرقام، ما عدا RackItem.id فهو string (زي الـ type بتاع ClothingRack).
• price رقم بالدولار USD (مثلًا 44.99).
• الداتا الحالية: 15 منتج في 4 categories: T-Shirts وPolo Shirts وHoodies & Sweatshirts وJackets.
• أول request بعد فترة ممكن ياخد كام ثانية، لأن السيرفر المجاني بيقف لو مفيش زيارات لمدة 3 ساعات.
• localhost:5173 مسموح في CORS، فاشتغلوا لوكال على الـ API المرفوع عادي.
  ⭐ لما ترفعوا الفرونت، ابعتولي الرابط بالظبط (مثلًا https://tryon.vercel.app) عشان أضيفه، وإلا المتصفح هيمنع الطلبات.
• الفرونت لازم يترفع على HTTPS، لأن الكاميرا مابتشتغلش غير على HTTPS.

أي سؤال، افتحوا Swagger الأول، فيه كل حاجة ✌️
