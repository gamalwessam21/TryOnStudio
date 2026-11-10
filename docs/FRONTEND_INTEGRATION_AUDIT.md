# TryOnStudio — Complete Frontend & Backend Integration Audit Report

> **Audit Date:** November 10, 2026  
> **Auditor Role:** Senior Full-Stack Engineer, Frontend Architect & QA Engineer  
> **Git Target Branch:** `audit/frontend-integration-audit` (created from latest `origin/dev`)  
> **Authoritative Backend API:** `https://clothesai3d.runasp.net`  
> **Backend Swagger Specification:** `https://clothesai3d.runasp.net/swagger/v1/swagger.json`  
> **Production Frontend URL:** `https://try-on-studio-beta.vercel.app`

---

## 1. Executive Summary

This comprehensive audit evaluated the actual source code of the **TryOnStudio** frontend repository against the deployed ASP.NET Core backend at `https://clothesai3d.runasp.net`, the Vercel serverless gateway functions (`api/*`), and the production deployment.

### Key Audit Findings
1. **Core Catalog & Sizing Integration is 100% Live and Operational**:
   - Zero mock products or hardcoded catalog data exist in the application.
   - All 15 catalog garments, 4 categories, color variants, manufactured sizes, 360-degree rack image series (`/api/media/{id}`), and health telemetry (`/api/health`) are dynamically fetched from the authoritative backend.
2. **Decart Realtime Virtual Try-On Token Service is Active**:
   - `POST /api/tryon/token` on the backend successfully generates valid Decart client JWT tokens scoped for `models: ["lucy-vton-latest"]` and authorized origins (`https://try-on-studio-beta.vercel.app`, `http://localhost:5173`).
3. **AI Fashion Assistant Dual Configuration**:
   - Google Gemini (`gemini-3.5-flash`) is fully implemented, configured, and responsive on **both** the ASP.NET Core backend (`https://clothesai3d.runasp.net/api/assistant/chat`) and the Vercel serverless layer (`api/assistant/chat.ts`). In live tests, it returned rich styling advice with verified catalog item references.
4. **Loyalty OTP is a Backend Demo Mode**:
   - Live testing of `POST /api/loyalty/verify-request` confirms that the backend operates in demo mode: `"Demo mode: no SMS is sent. Enter the code 123456."`. Real SMS delivery is not configured on the upstream server.
5. **Critical Backend Payment Confirmation Disconnection**:
   - `src/services/commerceApi.ts` implements `confirmOrderStripeSession(orderNumber, sessionId)` for `POST /api/orders/{orderNumber}/verify-payment`. However, `ReceiptPage.tsx` **never invokes this method**. As a result, orders paid via Stripe remain marked as `pending_payment` on the authoritative backend.
6. **Receipt Token Omission on Page Refresh**:
   - `ReceiptPage.tsx` calls `commerceApi.getOrder(resolvedNum)` without passing the `receiptAccessToken`. Because confirmed orders are stored only in volatile React `useState`, refreshing the page loses access to orders that require the `X-Receipt-Token` header.

---

## 2. Overall Integration Status

| Classification | Count | Features Included |
| :--- | :---: | :--- |
| **Implemented & Verified** | 9 | Catalog Browsing, 360° Rack, Manufactured Size Check, AI Body Size Scan Submission, Decart WebRTC Virtual Try-On, MediaPipe Gesture Tracking, AI Fashion Assistant (Gemini), Arabic/English Localization, Cash on Delivery Order Creation. |
| **Implemented but Not Connected** | 1 | Backend Stripe Payment Confirmation (`POST /api/orders/{orderNumber}/verify-payment` implemented in client service but not called in `ReceiptPage.tsx`). |
| **Partially Implemented** | 1 | Digital Receipt Access Token Persistence (`X-Receipt-Token` not passed in `getOrder`, and lost on page reload). |
| **Backend Dependency** | 1 | Real SMS Delivery for Loyalty OTP (backend operates in hardcoded demo mode with fixed code `123456`). |
| **Needs Testing** | 0 | All implemented features have been subjected to live contract and unit tests. |
| **Not Implemented** | 0 | No features from the core specifications are completely missing. |

---

## 3. Feature-by-Feature Detailed Audit

### A. Authentication & User Data
- **Implementation Status:** **Implemented & Verified**
- **Evidence:**
  - Customer information (`fullName`, `phone`) is collected on `CheckoutPage.tsx` and validated by `validateCustomerInfo()` in `src/utils/commerceHelpers.ts`.
  - Phone validation enforces Egyptian mobile formatting (`^(?:\+?20|0)?1[0125]\d{8}$`).
  - No sensitive credentials (such as passwords or credit card numbers) are stored or handled by the frontend.
  - Verification tokens from `POST /api/loyalty/verify-confirm` are held in volatile React memory (`CommerceContext.tsx`), preventing cross-site scripting (XSS) extraction from `localStorage`.
- **Finding:** Customer checkout uses guest checkout with phone verification. There is no traditional user authentication system, which is aligned with the design specification.

### B. Product Catalog & 360° Interactive Rack
- **Implementation Status:** **Implemented & Verified**
- **Evidence:**
  - `GET /api/categories`: Returns 4 categories (T-Shirts, Polo Shirts, Hoodies, Jackets).
  - `GET /api/fashion-items`: Returns 15 dynamic items with prices, descriptions, and thumbnails.
  - `GET /api/fashion-items/rack?take=6`: Returns items with 24 multi-angle frame URLs (`https://clothesai3d.runasp.net/api/media/{guid}?v=2`).
  - `ClothingRack360.tsx`: Implements horizontal touch/drag math to scrub through frames smoothly.
  - `GarmentImage.tsx`: Handles network failures with an SVG fallback placeholder.
- **Inventory vs. Manufactured Sizes:**
  - The sizes shown on `SelectedOutfitCard.tsx` (`availableSizes`) represent **manufactured size offerings**, not live warehouse stock levels.
  - Live stock is validated by `POST /api/fashion-items/{id}/size-check` and on `POST /api/orders`.

### C. Virtual Try-On (Decart WebRTC & MediaPipe Gestures)
- **Implementation Status:** **Implemented & Verified**
- **Evidence:**
  - Live test of `POST /api/tryon/token` returned HTTP 200 with a valid Decart client token (`apiKey`) expiring in 2 minutes.
  - `useDecartTryOn.ts` uses `@decartai/sdk` with `models.realtime('lucy-vton-latest')` and registers `apiKeyProvider` for dynamic token renewal.
  - MediaPipe Pose Landmarker (`@mediapipe/tasks-vision@1.2.0`) tracks 33 skeletal landmarks. `swipeDetector.ts` validates horizontal wrist velocity above the hip line with a 1.5-second cooldown.
  - 10 automated unit tests in `src/__tests__/tryOnStudio.test.ts` verify gesture thresholds and anti-false-positive filters.

### D. AI Fashion Assistant (Google Gemini 3.5 Flash)
- **Implementation Status:** **Implemented & Verified**
- **Evidence:**
  - Live testing of `POST /api/assistant/chat` returned HTTP 200 with `model: "gemini-3.5-flash"` and structured item recommendations (`recommendedItems: [{ id: 1, ... }, { id: 4, ... }]`).
  - Live testing of Vercel production endpoint `https://try-on-studio-beta.vercel.app/api/assistant/chat` confirmed `configured: true`.
  - PII scrubbing in `api/assistant/chat.ts` strips 13–19 digit card numbers and phone numbers before forwarding to Gemini.
  - Rate limiting is enforced at 18 requests per minute per IP.
  - Secret key `GEMINI_API_KEY` is strictly confined to server-side execution.

### E. AI Body Size Recommendation
- **Implementation Status:** **Implemented & Verified**
- **Evidence:**
  - `captureFrames.ts` captures 20 camera frames over 3 seconds using HTML5 Canvas, downscaling to max 1280px and dynamically adjusting JPEG compression to guarantee $\le 2\text{ MB/frame}$ and $\le 20\text{ MB total upload}$.
  - Posts multipart/form-data to `/api/fashion-items/{id}/size-scan`.
  - Live backend test with 1x1 test frames returned HTTP 422 (`no_pose`) or HTTP 409 (for items without sizes), confirming active upstream computer vision processing.

### F. Checkout & Orders
- **Implementation Status:** **Implemented & Verified**
- **Evidence:**
  - `CheckoutPage.tsx` submits orders via `POST /api/orders` with an `Idempotency-Key` header (UUID v4).
  - Validation test on live backend confirmed strict validation: returns HTTP 400 if `Customer`, `FashionItemId`, or `PaymentMethod` is missing.
  - Price manipulation protection: the backend recalculates subtotal, discounts, and final total based on its internal catalog.
  - Cash on Delivery (COD) creates a confirmed order immediately and routes to `/orders/{orderNumber}`.

### G. Stripe Payment Integration
- **Implementation Status:** **Implemented but Not Connected (Backend Confirmation Missing)**
- **Evidence:**
  - `POST /api/payments/stripe` on Vercel creates a hosted checkout session in piastres ($1\text{ EGP} = 100\text{ piastres}$) after verifying product prices against the backend catalog.
  - Returns `checkoutUrl` (`https://checkout.stripe.com/...`).
  - Upon return to `/orders/{orderNumber}?session_id=cs_...`, `ReceiptPage.tsx` calls `commerceApi.verifyStripeSession(sessionId)`.
  - **Defect:** `ReceiptPage.tsx` does NOT call `commerceApi.confirmOrderStripeSession(orderNumber, sessionId)`. The backend endpoint `POST /api/orders/{orderNumber}/verify-payment` is never invoked, leaving the order in `pending_payment` status on the backend database.

### H. Customer Loyalty Program
- **Implementation Status:** **Implemented & Verified (with Backend Demo Dependency)**
- **Evidence:**
  - `GET /api/loyalty/rules`: Returns `{ earnUnitAmountEgp: 10, pointsEarnedPerUnit: 1, redemptionBlockPoints: 100, redemptionBlockValueEgp: 10, minRedemptionPoints: 100, maxRedemptionRatio: 1.0 }`.
  - `POST /api/loyalty/verify-request`: Returns `challengeSent: true` with message `"Demo mode: no SMS is sent. Enter the code 123456."`.
  - `POST /api/loyalty/verify-confirm` with code `123456`: Returns valid bearer token.
  - `GET /api/loyalty/account` with `Authorization: Bearer <token>`: Returns account ledger and balance.
  - Tokens are held purely in React state, never written to `localStorage`.

### I. Digital Receipt
- **Implementation Status:** **Partially Implemented (Access Token Loss on Refresh)**
- **Evidence:**
  - `ReceiptPage.tsx` renders order metadata, item breakdown, payment status, and print layout.
  - **Defect 1:** Line 89 calls `commerceApi.getOrder(resolvedNum)` without passing `receiptAccessToken`.
  - **Defect 2:** Confirmed orders exist only in transient React memory. If a customer reloads `/orders/ORD-xxxx`, the receipt access token is lost.

### J. Bi-Directional Localization (Arabic RTL & English LTR)
- **Implementation Status:** **Implemented & Verified**
- **Evidence:**
  - `LanguageContext.tsx` contains exactly 280 English keys and 280 corresponding Arabic keys (1:1 parity).
  - Toggling language automatically updates `<html dir="rtl" lang="ar">`.
  - All product names, currency amounts, and sizes are isolated with `<bdi>` tags to prevent bidirectional text corruption.

### K. Responsive Design & UX
- **Implementation Status:** **Implemented & Verified**
- **Evidence:**
  - Handset (< 640px), tablet (640px–1024px), and desktop (1024px+) viewports use responsive CSS media queries in `src/styles/`.
  - Floating drawer on mobile adapts to a compact full-screen chat interface.
  - Sidebar folds into an accessible slide-over drawer with Escape-key dismiss.

---

## 4. Discrepancies Between README.md and Reality

| Feature / Area | README.md Claim | Code & Live API Reality | Impact / Evidence |
| :--- | :--- | :--- | :--- |
| **TryOn Token Response** | `{ token: string, expiresAt: string }` | `{ apiKey: string, expiresAt: string }` | Swagger schema `TryOnTokenDto` and `src/types/api.ts` use `apiKey`. |
| **Loyalty Max Discount** | "Capped at 25% of subtotal" | `maxRedemptionRatio: 1.0` (100% allowable) | Live backend `GET /api/loyalty/rules` returns `maxRedemptionRatio: 1`. |
| **Loyalty OTP Delivery** | Implied real cellular SMS delivery | Backend operates in Demo Mode (`123456`) | Backend returns: `"Demo mode: no SMS is sent. Enter the code 123456."` |
| **Stripe Backend Sync** | Claims `ReceiptPage` calls `verify-payment` on backend | `confirmOrderStripeSession` is never called | Method exists in `commerceApi.ts` but is absent from `ReceiptPage.tsx`. |
| **Receipt Token Persistence** | Claims `X-Receipt-Token` is stored and sent | Token is omitted from `getOrder` and lost on page reload | In-memory `recentConfirmedOrders` resets on reload. |

---

## 5. Security & Resilience Findings

1. **API Keys Protection:** PASSED. Neither `GEMINI_API_KEY` nor `STRIPE_SECRET_KEY` is present in frontend client bundles.
2. **PII Sanitization:** PASSED. Credit card numbers and phone numbers are scrubbed prior to Gemini prompt transmission.
3. **Session Token Storage:** PASSED. Decart tokens and Loyalty bearer tokens are stored strictly in memory, eliminating XSS extraction risk.
4. **Idempotency:** PASSED. Every checkout attempt generates a UUID v4 transmitted via `Idempotency-Key`.
5. **Frame Size Validation:** PASSED. Canvas frame capture strictly restricts single images to $\le 2\text{ MB}$ and total payload to $\le 20\text{ MB}$.

---

## 6. Critical Bugs & Recommended Fixes

### Bug 1: Stripe Backend Payment Confirmation Disconnected
- **Severity:** High
- **File:** `src/app/pages/ReceiptPage.tsx`
- **Correction:** When `commerceApi.verifyStripeSession(sessionId)` returns `paymentStatus === 'paid'`, immediately call:
  ```ts
  const updatedRemoteOrder = await commerceApi.confirmOrderStripeSession(resolvedNum, sessionId);
  setOrder(updatedRemoteOrder);
  recordConfirmedOrder(updatedRemoteOrder);
  ```

### Bug 2: Missing Receipt Access Token on Reload
- **Severity:** Medium
- **Files:** `src/app/pages/ReceiptPage.tsx`, `src/app/CommerceContext.tsx`
- **Correction:**
  1. Pass `currentOrder?.receiptAccessToken` when invoking `commerceApi.getOrder(resolvedNum, token)`.
  2. Persist confirmed orders to `sessionStorage` (scoped to current tab session) so that page reloads maintain receipt authorization.

