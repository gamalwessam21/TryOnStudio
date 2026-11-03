# TryOnStudio — Backend Commerce & Loyalty Specification (.NET 8 / ASP.NET Core)

This specification defines the authoritative contract between the **TryOnStudio** frontend and the remote ASP.NET Core backend (`https://clothesai3d.runasp.net`).

---

## 1. Overview & Current Discrepancy

- **Current Live Endpoints on `clothesai3d.runasp.net`**:
  - `GET /api/health`
  - `GET /api/fashion-items`
  - `GET /api/fashion-items/categories`
  - `GET /api/fashion-items/{id}`
  - `GET /api/fashion-items/rack-items`
  - `POST /api/fashion-items/size-check`
  - `POST /api/tryon/token`
- **Missing Endpoints (Frontend implemented with graceful client fallback)**:
  - `/api/orders`
  - `/api/orders/{orderNumber}`
  - `/api/loyalty/rules`
  - `/api/loyalty/challenge`
  - `/api/loyalty/verify`
  - `/api/loyalty/account/{phone}`

---

## 2. Orders Controller (`OrdersController.cs`)

### Route: `POST /api/orders`
Creates a new order, validates stock, checks the customer's loyalty token if points are redeemed, and reserves or confirms the order.

#### HTTP Headers:
- `Idempotency-Key: chk-xxxxxxxx-xxxx` (Optional but highly recommended; prevents duplicate submissions on double-clicks or retries).

#### Request Body (`CreateOrderDto`):
```json
{
  "customerName": "Mohamed Gamal",
  "customerPhone": "01012345678",
  "items": [
    {
      "fashionItemId": 1,
      "variantId": 1,
      "size": "L",
      "quantity": 1
    }
  ],
  "paymentMethod": "cod", // "cod" | "stripe"
  "pointsToRedeem": 500, // 0 if none
  "loyaltyVerificationToken": "tok_live_xxxx" // Required if pointsToRedeem > 0
}
```

#### Response (`201 Created` or `200 OK` - `OrderResponseDto`):
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
      "imageUrl": "https://clothesai3d.runasp.net/images/denim-1.jpg",
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
  "paymentStatus": "pending_collection", // "pending_collection" | "pending_payment" | "paid"
  "orderStatus": "confirmed", // "pending" | "confirmed" | "delivered" | "cancelled"
  "createdAt": "2026-11-04T00:30:00Z",
  "pointsEarned": 220,
  "updatedLoyaltyBalance": 450
}
```

---

### Route: `GET /api/orders/{orderNumber}`
Retrieves authoritative order and receipt details.

#### Response (`200 OK`):
Returns the `OrderResponseDto` schema shown above.

---

## 3. Loyalty Controller (`LoyaltyController.cs`)

### Route: `GET /api/loyalty/rules`
Returns active points earning and redemption rules.

#### Response (`200 OK`):
```json
{
  "earnUnitAmountEgp": 10,
  "pointsEarnedPerUnit": 1,
  "redemptionBlockPoints": 100,
  "redemptionBlockValueEgp": 10,
  "minRedemptionPoints": 100,
  "maxRedemptionRatio": 0.5
}
```

---

### Route: `POST /api/loyalty/challenge`
Initiates customer verification before revealing points or redeeming them.

#### Request:
```json
{
  "phone": "01012345678"
}
```

#### Response (`200 OK`):
```json
{
  "challengeId": "chl_98234",
  "maskedPhone": "010••••••78",
  "expiresAt": "2026-11-04T00:45:00Z",
  "message": "Verification code sent via SMS to 010••••••78."
}
```

---

### Route: `POST /api/loyalty/verify`
Confirms the SMS OTP and generates a scoped verification token.

#### Request:
```json
{
  "phone": "01012345678",
  "code": "123456",
  "challengeId": "chl_98234"
}
```

#### Response (`200 OK`):
```json
{
  "verificationToken": "tok_loyalty_98234_abc",
  "expiresAt": "2026-11-04T01:30:00Z",
  "account": {
    "phoneMasked": "010••••••78",
    "currentBalance": 950,
    "availableDiscountEgp": 90,
    "totalEarnedPoints": 1400,
    "totalRedeemedPoints": 450,
    "tierName": "Silver Stylist",
    "recentTransactions": [
      {
        "id": "tx_01",
        "type": "earned",
        "points": 220,
        "description": "Order #TYS-20261104-8921 (Cash on Delivery delivered)",
        "createdAt": "2026-11-04T00:30:00Z"
      }
    ]
  }
}
```

---

### Route: `GET /api/loyalty/account/{phone}`
Returns account ledger if authorized with `Authorization: Bearer <verificationToken>`.

---

## 4. Recommended Entity Framework Core Schema

```csharp
public class Order
{
    public int Id { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public string ReceiptNumber { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public decimal SubtotalEgp { get; set; }
    public decimal DiscountEgp { get; set; }
    public int PointsRedeemed { get; set; }
    public decimal FinalTotalEgp { get; set; }
    public string PaymentMethod { get; set; } = "cod"; // "cod" | "stripe"
    public string PaymentStatus { get; set; } = "pending_collection";
    public string OrderStatus { get; set; } = "confirmed";
    public string? TransactionReference { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<OrderItem> Items { get; set; } = new();
}

public class LoyaltyAccount
{
    public int Id { get; set; }
    public string CustomerPhone { get; set; } = string.Empty;
    public int CurrentBalance { get; set; }
    public int TotalEarned { get; set; }
    public int TotalRedeemed { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public List<LoyaltyTransaction> Transactions { get; set; } = new();
}

public class LoyaltyTransaction
{
    public int Id { get; set; }
    public int LoyaltyAccountId { get; set; }
    public string Type { get; set; } = "earned"; // "earned" | "redeemed" | "adjusted"
    public int Points { get; set; }
    public string Description { get; set; } = string.Empty;
    public string? OrderNumber { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
```
