# TryOnStudio — Authoritative Backend Commerce & Loyalty Specification (.NET 8 / ASP.NET Core)

> **Authoritative Backend Base URL:** `https://clothesai3d.runasp.net`  
> **Serverless Edge Function URL:** Relative `/api/payments/stripe` (Vercel Serverless Gateway)  
> **Currency Conversion Standard:** 50 EGP per 1 USD (fixed backend rate)  
> **Specification Version:** 2.0 (Synchronized with Project Owner Backend Handoff)  
> **Target Framework:** ASP.NET Core (.NET 8) Web API  

---

## 1. Overview & Source of Truth Hierarchy

This specification defines the authoritative backend contract for commerce, orders, loyalty, sizing, and virtual try-on in the **TryOnStudio** ecosystem.

### Source of Truth Order
1. **Latest Backend Handoff (Project Owner)** — Takes precedence over older documentation and outdated Swagger annotations whenever a conflict arises.
2. **Authoritative Backend API (`https://clothesai3d.runasp.net`)** — Live running ASP.NET Core service.
3. **Vercel Serverless Edge Gateway** — Scoped exclusively to Stripe Checkout session generation (`POST /api/payments/stripe`) to protect Stripe server credentials and serve mobile/web clients.

### Critical Route Replacements (Audit & Sync)

| Outdated / Deprecated Endpoint | Authoritative Live Endpoint | Notes |
| :--- | :--- | :--- |
| `/api/loyalty/challenge` | `POST /api/loyalty/verify-request` | Initiates phone OTP challenge (fixed demo code `123456`) |
| `/api/loyalty/verify` | `POST /api/loyalty/verify-confirm` | Confirms OTP and issues scoped verification token |
| `/api/loyalty/account/{phone}` | `GET /api/loyalty/account` | Requires `Authorization: Bearer <verificationToken>` header |
| `/api/fashion-items/categories` | `GET /api/categories` | Top-level categories endpoint |
| `/api/fashion-items/rack-items` | `GET /api/fashion-items/rack?take=6` | Clamped 1–20; returns 24 ordered 360° frames |
| `POST /api/fashion-items/size-check` | `POST /api/fashion-items/{id}/size-check` | Item ID is a required path parameter |

---

## 2. Standard Error Response Contract

All ASP.NET Core backend endpoints return a standardized JSON error format:

```json
{
  "error": "Descriptive error message for the client.",
  "code": "specific_error_code",
  "errors": {
    "FieldName": ["Validation failure description."]
  }
}
```

### Standard HTTP Status Codes:
- `400 Bad Request`: Validation failure (malformed payload, invalid phone, quantity out of range).
- `401 Unauthorized`: Missing or invalid `Authorization: Bearer <token>` or expired verification token.
- `403 Forbidden`: Phone mismatch or attempted unauthorized ledger access.
- `404 Not Found`: Entity not found, or order not found / invalid `X-Receipt-Token`.
- `409 Conflict`: Business logic conflict (e.g., product has no manufactured sizes, customer points balance changed during checkout, duplicate idempotency key with differing payload).
- `413 Payload Too Large`: Size-scan upload exceeded 2 MB per frame or 20 MB total.
- `422 Unprocessable Entity`: AI processing failure (e.g. `no_pose`, `too_close`, `turned`, `bad_height` during size scan).
- `429 Too Many Requests`: Rate limit reached. Clients must honor the `Retry-After` header.
- `502 Bad Gateway`: Upstream AI provider (Decart, AI size engine) waking up or unavailable.
- `503 Service Unavailable`: Feature not configured on server (e.g. missing API keys).
- `500 Internal Server Error`: Unhandled server exception.

---

## 3. Orders & Commerce Controller (`OrdersController.cs`)

### 3.1 Single-Product Order Constraint
> [!IMPORTANT]
> The backend order endpoint supports **exactly one clothing item per order**. It does **not** accept an array of multi-product items.
> All client carts and checkout workflows must operate under this constraint. Multi-item cart checkouts must not submit fake combined orders without a future backend contract revision.

---

### 3.2 Create Order: `POST /api/orders`

Creates a new purchase order, performs authoritative server-side price calculation, validates stock and sizing, checks loyalty tokens if points are redeemed, and holds or confirms the order.

#### Required HTTP Headers:
- `Content-Type: application/json`
- `Idempotency-Key: <UUID>` (Generates a unique UUID v4 per checkout attempt; reuses the same key ONLY when retrying identical network failures).

#### Request Body (`CreateOrderPayload`):
```json
{
  "fashionItemId": 1,
  "variantId": 1,
  "size": "L",
  "quantity": 1,
  "customer": {
    "fullName": "Mohamed Gamal",
    "phone": "01012345678"
  },
  "paymentMethod": "cod",
  "pointsToRedeem": 500,
  "loyaltyVerificationToken": "tok_loyalty_98234_abc"
}
```

#### Field Specifications:
- `fashionItemId` (number, required): Authoritative integer ID from the catalog.
- `variantId` (number, optional): Authoritative integer variant/color ID.
- `size` (string or `null`, optional): Selected manufactured size. Must be `null` if the product has no sizes (`availableSizes` is empty).
- `quantity` (number, required): Integer between 1 and 20.
- `customer.fullName` (string, required): 3 to 100 characters.
- `customer.phone` (string, required): Valid phone number (10–15 digits).
- `paymentMethod` (string, required): `"cod"` (Cash on Delivery) or `"stripe"`.
- `pointsToRedeem` (number, optional): Integer in multiples of 100. Default 0.
- `loyaltyVerificationToken` (string, optional): Required if `pointsToRedeem > 0`. Must match the customer phone number.

#### Authoritative Server Pricing Calculations:
The backend does **not** trust client prices, subtotals, or discounts:
1. `unitPriceUsd` is retrieved from the database.
2. `unitPriceEgp = Math.Round(unitPriceUsd * 50)`.
3. `subtotalEgp = unitPriceEgp * quantity`.
4. If `pointsToRedeem > 0`, backend validates token and balance: `discountEgp = (pointsToRedeem / 100) * 10`.
5. `finalTotalEgp = Math.Max(0, subtotalEgp - discountEgp)`.
6. `pointsEarned`: For COD, calculated immediately as `Math.Floor(finalTotalEgp / 10) * 1`. For Stripe, earned upon successful payment verification.

#### Success Response (`201 Created` - `PersistedOrder`):
```json
{
  "orderNumber": "TYS-20261104-8921",
  "receiptNumber": "REC-TYS-20261104-8921",
  "transactionReference": "COD-TYS-20261104-8921",
  "customerName": "Mohamed Gamal",
  "customerPhoneMasked": "010••••••78",
  "currency": "EGP",
  "items": [
    {
      "fashionItemId": 1,
      "productName": "Minimalist Denim Jacket",
      "categoryName": "Jackets",
      "variantId": 1,
      "colorName": "Classic Indigo",
      "imageUrl": "https://clothesai3d.runasp.net/api/media/denim-1",
      "size": "L",
      "quantity": 1,
      "unitPriceEgp": 2250,
      "unitPriceUsd": 45.0,
      "lineTotalEgp": 2250
    }
  ],
  "subtotalEgp": 2250,
  "discountEgp": 50,
  "pointsRedeemed": 500,
  "finalTotalEgp": 2200,
  "paymentMethod": "cod",
  "paymentStatus": "pending_collection",
  "orderStatus": "confirmed",
  "createdAt": "2026-11-04T00:30:00Z",
  "pointsEarned": 220,
  "updatedLoyaltyBalance": 450,
  "checkoutUrl": null,
  "receiptAccessToken": "rcpt_sec_9942a8b3e"
}
```

> [!CAUTION]
> **Receipt Token Security Rule:**
> `receiptAccessToken` is returned **only once** in the `201 Created` response.
> Clients must store this token mapped to the order number in `localStorage` under `tys.receiptTokens`.
> Subsequent `GET /api/orders/{orderNumber}` requests return `"receiptAccessToken": null`. Client applications must **never** overwrite the stored token with `null` when merging remote order updates.

---

### 3.3 Get Order & Digital Receipt: `GET /api/orders/{orderNumber}`

Retrieves authoritative order and digital receipt details.

#### Required HTTP Headers:
- `X-Receipt-Token: <receiptAccessToken>`

> [!WARNING]
> Requests without a valid `X-Receipt-Token` return `404 Not Found` to prevent unauthorized enumeration of customer receipts.

#### Response (`200 OK`):
Returns the `PersistedOrder` schema shown above (with `receiptAccessToken: null`).

---

### 3.4 Confirm Stripe Payment: `POST /api/orders/{orderNumber}/verify-payment`

Notifies the backend to verify and record a completed Stripe Checkout session.

#### Request Body:
```json
{
  "sessionId": "cs_test_a1b2c3d4e5f6g7"
}
```

#### Server Actions:
1. Validates that `sessionId` exists and matches the order's metadata.
2. Checks that Stripe payment status is `paid`.
3. Verifies currency is `EGP` and amount matches `finalTotalEgp`.
4. Transitions `paymentStatus` to `paid` and `orderStatus` to `confirmed`.
5. Permanently awards `pointsEarned` to the customer's loyalty account.
6. Returns the updated `PersistedOrder`.

---

## 4. Stripe Checkout Session Gateway (Vercel Serverless Function)

To prevent exposing `STRIPE_SECRET_KEY` on the client and to maintain compatibility with both web and mobile apps, Stripe session creation is hosted via Vercel serverless functions.

### 4.1 Create Stripe Session: `POST /api/payments/stripe`

#### Request Body:
```json
{
  "orderNumber": "TYS-20261104-8921",
  "fashionItemId": 1,
  "variantId": 1,
  "size": "L",
  "quantity": 1,
  "verifiedDiscountEgp": 50,
  "idempotencyKey": "7f91c92a-3b56-4b2a-8d19-5a1e2f3b4c5d"
}
```

> [!IMPORTANT]
> `verifiedDiscountEgp` **must equal** `order.discountEgp` returned by the backend order creation endpoint. Never use client-estimated discount figures.
> `idempotencyKey` passes the unique UUID of the checkout attempt to Stripe (no `chk-` prefix required).

#### Response (`200 OK`):
```json
{
  "sessionId": "cs_test_a1b2c3d4e5f6g7",
  "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_a1b2c3d4e5f6g7",
  "mode": "sandbox"
}
```

#### Zero-Payable Total Handling:
If loyalty points cover 100% of the purchase (`finalTotalEgp == 0`), Stripe session creation will reject the request with `zero_payable_total`. The frontend must require the customer to select Cash on Delivery or reduce points redemption.

---

### 4.2 Stripe Status & Verification: `GET /api/payments/stripe`
- Without query parameter: Returns `{ stripeConfigured: true, stripeMode: "sandbox", usdToEgpRate: 50, defaultLoyaltyRules: { ... } }`.
- With `?sessionId=cs_test_...`: Validates session status with Stripe directly.

---

## 5. Customer Loyalty Program Controller (`LoyaltyController.cs`)

### 5.1 Loyalty Rules: `GET /api/loyalty/rules`

Returns active points earning and redemption rules.

#### Response (`200 OK`):
```json
{
  "earnUnitAmountEgp": 10,
  "pointsEarnedPerUnit": 1,
  "redemptionBlockPoints": 100,
  "redemptionBlockValueEgp": 10,
  "minRedemptionPoints": 100,
  "maxRedemptionRatio": 1.0
}
```

#### Authoritative Rules Summary:
- **Earning:** 1 point per 10 EGP spent on the final paid total (`Math.Floor(finalTotalEgp / 10)`).
- **Redemption Block:** 100 points = 10 EGP discount.
- **Minimum Redemption:** 100 points.
- **Stepping:** Multiples of 100 points only (e.g., 100, 200, 300).
- **Maximum Ratio:** 1.0 (allows up to 100% of merchandise value to be covered by points).

---

### 5.2 Request OTP Challenge: `POST /api/loyalty/verify-request`

Initiates customer phone verification before allowing access to points balance or applying discounts.

#### Request Body:
```json
{
  "phone": "01012345678"
}
```

#### Response (`200 OK`):
```json
{
  "challengeSent": true,
  "expiresInSeconds": 300,
  "message": "Demo mode: no SMS is sent. Enter the code 123456."
}
```

#### Security & Lifecycle Rules:
- **Demo Mode:** Current backend demo mode uses fixed code `123456`. No external SMS gateway is invoked.
- **Challenge Expiration:** 300 seconds (5 minutes).
- **Rate Limit:** Maximum 10 combined loyalty OTP requests and confirmations per IP per minute.
- **Lockout:** Maximum 5 incorrect verification attempts before a 15-minute phone lockout (`429 otp_locked`).
- A new request invalidates any previous unconfirmed challenge for that phone.

---

### 5.3 Confirm OTP Challenge: `POST /api/loyalty/verify-confirm`

Validates the OTP code and returns an authorized, scoped verification token with the customer account summary.

#### Request Body:
```json
{
  "phone": "01012345678",
  "code": "123456"
}
```

#### Response (`200 OK`):
```json
{
  "verificationToken": "tok_loyalty_98234_abc",
  "expiresAt": "2026-11-04T01:30:00Z",
  "account": {
    "customerPhoneMasked": "010••••••78",
    "currentBalance": 950,
    "lifetimeEarned": 1400,
    "lifetimeRedeemed": 450,
    "availableDiscountEgp": 90,
    "rules": {
      "earnUnitAmountEgp": 10,
      "pointsEarnedPerUnit": 1,
      "redemptionBlockPoints": 100,
      "redemptionBlockValueEgp": 10,
      "minRedemptionPoints": 100,
      "maxRedemptionRatio": 1.0
    },
    "transactions": [
      {
        "id": "tx_01",
        "type": "earn",
        "pointsDelta": 220,
        "orderNumber": "TYS-20261104-8921",
        "description": "Order #TYS-20261104-8921 (Delivered)",
        "createdAt": "2026-11-04T00:30:00Z"
      }
    ]
  }
}
```

> [!CAUTION]
> **Token Storage In-Memory Rule:**
> `verificationToken` has a 30-minute validity window.
> It **must remain in memory only** (React context or state).
> It must **never** be written to `localStorage`, `sessionStorage`, cookies, or indexedDB.

---

### 5.4 Get Loyalty Account: `GET /api/loyalty/account`

Fetches authoritative ledger balance and history.

#### Required HTTP Header:
- `Authorization: Bearer <verificationToken>`

#### Response (`200 OK`):
Returns the `LoyaltyAccountSummary` schema.

---

## 6. AI Fashion Stylist Controller (`AssistantController.cs`)

### 6.1 Assistant Telemetry: `GET /api/assistant/chat`
Returns status: `{ "configured": true, "provider": "google-gemini", "model": "gemini-3.5-flash", "usdToEgpRate": 50 }`.

### 6.2 Assistant Chat Inference: `POST /api/assistant/chat`
Proxies chat prompts to Google Gemini with grounding on the 15 active catalog items.

#### Request Body:
```json
{
  "messages": [
    { "role": "user", "content": "I need a jacket for a casual outdoor dinner." }
  ],
  "language": "en",
  "context": {
    "selectedItem": {
      "id": 1,
      "name": "Minimalist Denim Jacket",
      "categoryName": "Jackets",
      "priceUsd": 45.0
    },
    "outfitConfirmed": true,
    "tryOnActive": false,
    "scannedSize": "L",
    "stylePreferences": {
      "aesthetic": "Minimalist",
      "fit": "Regular",
      "budgetEgp": 3000
    },
    "verifiedLoyaltyPoints": 950
  }
}
```

#### Response (`200 OK`):
```json
{
  "reply": "The Minimalist Denim Jacket in Classic Indigo pairs wonderfully with casual trousers...",
  "model": "gemini-3.5-flash",
  "recommendedItems": [
    {
      "id": 1,
      "name": "Minimalist Denim Jacket",
      "categoryName": "Jackets",
      "priceUsd": 45.0,
      "priceEgp": 2250,
      "thumbnailUrl": "https://clothesai3d.runasp.net/api/media/denim-1",
      "variantCount": 5
    }
  ]
}
```
- Timeout: 55 seconds.
- Rate Limit: 18 requests per IP per minute.

---

## 7. Sizing & Camera Body Scan Endpoints

### 7.1 Manufactured Size Check: `POST /api/fashion-items/{id}/size-check`
- Checks whether a size code exists in manufactured sizes for that item.
- Request: `{ "size": "L" }`.
- Response: `{ "fashionItemId": 1, "requestedSize": "L", "isAvailable": true, "availableSizes": ["S","M","L","XL"], "nearestAvailableSizes": ["M","XL"] }`.

### 7.2 Camera Size Scan: `POST /api/fashion-items/{id}/size-scan`
- Content-Type: `multipart/form-data` (browser sets boundary automatically).
- Field: `frames` (repeated 8 to 40 JPEG/PNG blobs, recommended 15–30 images over ~3s, max 2 MB/frame, max 20 MB total).
- Response (`200 OK`):
  ```json
  {
    "size": "M",
    "alternative": "L",
    "borderline": true,
    "sizeRange": "M-L",
    "confidence": "high"
  }
  ```
- **Display Rule:** When `borderline: true`, the UI displays `sizeRange` (e.g. "Between M and L"). When `false`, displays `size`.
- Timeout: 60 seconds.
- Error codes on 422: `no_pose`, `too_close`, `turned`, `bad_height`.

---

## 8. Realtime Virtual Try-On (`/api/tryon/token`)

- `POST /api/tryon/token`: Requests ephemeral WebRTC Decart client JWT (~2 minutes validity).
- Body: None required (no request body needed).
- Response: `{ "apiKey": "eyJhbGciOi...", "expiresAt": "2026-11-04T00:32:00Z" }`.
- Model: `lucy-vton-latest`.
- Tokens are held in memory and requested fresh prior to each connection (never persisted).

