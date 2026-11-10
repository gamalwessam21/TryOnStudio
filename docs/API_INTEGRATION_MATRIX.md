# TryOnStudio — API Integration Matrix

> **Authoritative Backend Base URL:** `https://clothesai3d.runasp.net`  
> **Serverless Edge Gateway Base URL:** Relative `/api/*` (Vercel Functions)  
> **Swagger Specification:** `https://clothesai3d.runasp.net/swagger/v1/swagger.json`  
> **Audit Status Date:** November 10, 2026

---

## 1. Catalog & Product Endpoints

| Endpoint | HTTP Method | Frontend File | Feature | Expected Request / Response | Auth / Headers | Verification Result | Notes |
| :--- | :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| `/api/health` | `GET` | `src/services/fashionApi.ts`, `src/app/StudioContext.tsx` | Backend Telemetry | **Req:** None<br>**Res:** `{ status: "healthy", database: "ok", storage: "writable", products: 15, mediaFiles: 425, aiSizeService: "ok" }` | None | **Implemented & Verified** | Live test returned HTTP 200. Checked on mount & refreshed on user click. |
| `/api/categories` | `GET` | `src/services/fashionApi.ts`, `src/app/StudioContext.tsx` | Category Navigation | **Req:** None<br>**Res:** Array of `{ id: number, name: string, slug: string, itemCount: number }` | None | **Implemented & Verified** | Live test returned 4 categories: T-Shirts (7), Polo Shirts (2), Hoodies (4), Jackets (2). |
| `/api/categories/{categoryId}/fashion-items` | `GET` | `src/services/fashionApi.ts` | Category Filter | **Req:** Path `categoryId`<br>**Res:** Array of `FashionItem` | None | **Implemented & Verified** | Verified in automated contract test suite. |
| `/api/fashion-items` | `GET` | `src/services/fashionApi.ts`, `src/app/pages/BrowsePage.tsx` | Product Catalog | **Req:** Query `?categoryId=&search=`<br>**Res:** Array of `FashionItem` (15 items) | None | **Implemented & Verified** | Live test confirmed name & description search and category filtering. |
| `/api/fashion-items/{id}` | `GET` | `src/services/fashionApi.ts`, `src/app/StudioContext.tsx` | Item Details | **Req:** Path `{id}`<br>**Res:** `FashionItemDetails` (variants, manufactured sizes, price) | None | **Implemented & Verified** | Live test for item ID 1 returned full details and 5 variants. |
| `/api/fashion-items/{id}/variants` | `GET` | `src/services/fashionApi.ts`, `src/app/StudioContext.tsx` | Color Swatches | **Req:** Path `{id}`<br>**Res:** Array of `FashionVariant` (`colorName`, `colorHex`, `imageUrl`) | None | **Implemented & Verified** | Matches variants array in item details. |
| `/api/fashion-items/rack` | `GET` | `src/services/fashionApi.ts`, `src/features/catalog/ClothingRack360.tsx` | 360° Rotational Rack | **Req:** Query `?take=6`<br>**Res:** Array of `{ id, name, price, frames: string[] }` (24 frames per item) | None | **Implemented & Verified** | Live test returned items with 24 ordered media rotation frames. |
| `/api/media/{id}` | `GET` | `src/components/GarmentImage.tsx`, `ClothingRack360.tsx` | Static Image CDN | **Req:** Path `{id}` with query `?v=2`<br>**Res:** Binary image (JPEG/PNG) | None | **Implemented & Verified** | Live media files render correctly in browser. |

---

## 2. Sizing & Body Scan Endpoints

| Endpoint | HTTP Method | Frontend File | Feature | Expected Request / Response | Auth / Headers | Verification Result | Notes |
| :--- | :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| `/api/sizes` | `GET` | `src/services/fashionApi.ts`, `src/app/StudioContext.tsx` | Global Sizes | **Req:** None<br>**Res:** `["XS","S","M","L","XL","XXL","XXXL"]` | None | **Implemented & Verified** | Returns ordered manufactured size array. |
| `/api/fashion-items/{id}/sizes` | `GET` | `src/services/fashionApi.ts` | Product Sizing | **Req:** Path `{id}`<br>**Res:** Array of strings (e.g. `["S","M","L"]`) | None | **Implemented & Verified** | Distinguishes manufactured sizes offered for item from global scale. |
| `/api/fashion-items/{id}/size-check` | `POST` | `src/services/fashionApi.ts`, `SelectedOutfitCard.tsx` | Manufactured Size Check | **Req:** `{ size: "M" }`<br>**Res:** `{ fashionItemId: 1, requestedSize: "M", isAvailable: true, availableSizes: string[], nearestAvailableSizes: string[] }` | Content-Type: `application/json` | **Implemented & Verified** | Live test for item 1 with size "M" returned `isAvailable: true`. |
| `/api/fashion-items/{id}/size-scan` | `POST` | `src/services/fashionApi.ts`, `src/features/size-scan/useSizeScan.ts` | AI Camera Body Scan | **Req:** Multipart form data (`frames`: 8–40 JPEG blobs)<br>**Res:** `{ size: "M", alternative: "L", borderline: false, confidence: "0.88" }` | `multipart/form-data`, Timeout: 65s | **Implemented & Verified** | Live test with blank 1x1 frames confirmed server processing (returns 422 `no_pose` or 409). |

---

## 3. Realtime Virtual Try-On Endpoints

| Endpoint | HTTP Method | Frontend File | Feature | Expected Request / Response | Auth / Headers | Verification Result | Notes |
| :--- | :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| `/api/tryon/token` | `POST` | `src/services/fashionApi.ts`, `src/features/tryon/useDecartTryOn.ts` | Decart Client Token | **Req:** Empty body `{}`<br>**Res:** `{ apiKey: string, expiresAt: string }` | None | **Implemented & Verified** | Live test returned HTTP 200 with valid JWT scoped for `lucy-vton-latest`. |
| Decart WebRTC Signaling | WebRTC PeerConnection | `src/features/tryon/useDecartTryOn.ts` | Virtual Try-On Video | **Req:** Live camera stream + garment reference image<br>**Res:** Remote MediaStream with draped garment | Bearer JWT from `/api/tryon/token` | **Implemented & Verified** | Connects to `models.realtime('lucy-vton-latest')`. |

---

## 4. AI Fashion Assistant Endpoints

| Endpoint | HTTP Method | Frontend File | Feature | Expected Request / Response | Auth / Headers | Verification Result | Notes |
| :--- | :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| `/api/assistant/chat` | `GET` | `src/services/commerceApi.ts`, `api/assistant/chat.ts` | Assistant Status | **Req:** None<br>**Res:** `{ configured: true, provider: "google-gemini", model: "gemini-3.5-flash", usdToEgpRate: 50 }` | None | **Implemented & Verified** | Verified on both live ASP.NET backend and production Vercel deployment. |
| `/api/assistant/chat` | `POST` | `src/services/commerceApi.ts`, `api/assistant/chat.ts` | Stylist Chat Inference | **Req:** `{ messages, language, context }`<br>**Res:** `{ reply: string, model: string, recommendedItems: [...] }` | Rate Limit: 18 req/min | **Implemented & Verified** | Live test against backend returned 200 with grounded product IDs (`1, 4, 8, 9`). |

---

## 5. Orders, Checkout & Stripe Endpoints

| Endpoint | HTTP Method | Frontend File | Feature | Expected Request / Response | Auth / Headers | Verification Result | Notes |
| :--- | :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| `/api/orders` | `POST` | `src/services/commerceApi.ts`, `src/app/pages/CheckoutPage.tsx` | Order Creation | **Req:** `CreateOrderPayload`<br>**Res:** `PersistedOrder` (`orderNumber`, `status`, `receiptAccessToken`) | Header: `Idempotency-Key` (UUID v4) | **Implemented & Verified** | Live test confirmed strict validation: returns HTTP 400 if required fields are missing. |
| `/api/orders/{orderNumber}` | `GET` | `src/services/commerceApi.ts`, `src/app/pages/ReceiptPage.tsx` | Digital Receipt Lookup | **Req:** Path `{orderNumber}`<br>**Res:** `PersistedOrder` | Header: `X-Receipt-Token` | **Partially Implemented** | Header exists in `commerceApi.ts` but `ReceiptPage.tsx` does not pass it on initial mount/refresh. |
| `/api/orders/{orderNumber}/verify-payment` | `POST` | `src/services/commerceApi.ts` | Backend Payment Confirmation | **Req:** `{ sessionId: string }`<br>**Res:** `PersistedOrder` (`paymentStatus: 'paid'`) | Content-Type: `application/json` | **Implemented but Not Connected** | Method exists in `commerceApi.ts`, but `ReceiptPage.tsx` does not call it after Stripe redirect. |
| `/api/payments/stripe` | `GET` | `src/services/commerceApi.ts`, `api/payments/stripe.ts` | Stripe Gateway Status | **Req:** Optional query `?sessionId=`<br>**Res:** `{ stripeConfigured: true, stripeMode: "sandbox", usdToEgpRate: 50 }` | Server Secret | **Implemented & Verified** | Live test on Vercel production returned HTTP 200 in Sandbox mode. |
| `/api/payments/stripe` | `POST` | `src/services/commerceApi.ts`, `api/payments/stripe.ts` | Stripe Session Creation | **Req:** `{ orderNumber, fashionItemId, variantId, size, quantity, ... }`<br>**Res:** `{ sessionId, checkoutUrl, mode }` | Server Secret | **Implemented & Verified** | Verified validation: rejects unpersisted orders with 400 (`missing_persisted_order`). |

---

## 6. Loyalty Program Endpoints

| Endpoint | HTTP Method | Frontend File | Feature | Expected Request / Response | Auth / Headers | Verification Result | Notes |
| :--- | :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| `/api/loyalty/rules` | `GET` | `src/services/commerceApi.ts`, `src/app/CommerceContext.tsx` | Loyalty Rules | **Req:** None<br>**Res:** `{ earnUnitAmountEgp: 10, pointsEarnedPerUnit: 1, redemptionBlockPoints: 100, redemptionBlockValueEgp: 10, minRedemptionPoints: 100, maxRedemptionRatio: 1.0 }` | None | **Implemented & Verified** | Live test returned HTTP 200 with authoritative ratios. |
| `/api/loyalty/verify-request` | `POST` | `src/services/commerceApi.ts`, `src/app/pages/LoyaltyPage.tsx` | SMS OTP Request | **Req:** `{ phone: string }`<br>**Res:** `{ challengeSent: true, expiresInSeconds: 300, message: "Demo mode: no SMS is sent. Enter the code 123456." }` | Rate Limit | **Backend Dependency** | Backend operates in demo mode with fixed code `123456`. Real SMS is not dispatched. |
| `/api/loyalty/verify-confirm` | `POST` | `src/services/commerceApi.ts`, `src/app/pages/LoyaltyPage.tsx` | SMS OTP Confirm | **Req:** `{ phone: string, code: "123456" }`<br>**Res:** `{ verificationToken: string, expiresAt: string, account: LoyaltyAccountDto }` | Content-Type: `application/json` | **Implemented & Verified** | Live test with code `123456` returned valid verification token and account. |
| `/api/loyalty/account` | `GET` | `src/services/commerceApi.ts`, `src/app/pages/LoyaltyPage.tsx` | Points Ledger | **Req:** None<br>**Res:** `LoyaltyAccountDto` (`currentBalance`, `transactions: []`) | Header: `Authorization: Bearer <token>` | **Implemented & Verified** | Live test with bearer token returned 200. Without token, returned 401. |
