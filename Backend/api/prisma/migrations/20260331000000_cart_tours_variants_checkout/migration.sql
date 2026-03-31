-- ─────────────────────────────────────────────
-- New Enums
-- ─────────────────────────────────────────────

CREATE TYPE "CartItemType" AS ENUM ('PRODUCT', 'EVENT_TICKET', 'SOUL_TOUR', 'SERVICE_BOOKING');
CREATE TYPE "PaymentType" AS ENUM ('FULL', 'DEPOSIT', 'BALANCE');
CREATE TYPE "TourBookingStatus" AS ENUM ('PENDING', 'DEPOSIT_PAID', 'FULLY_PAID', 'CONFIRMED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "PromoCodeType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- ─────────────────────────────────────────────
-- Cart (Hybrid: client-side for guests, DB-synced on login)
-- ─────────────────────────────────────────────

CREATE TABLE "carts" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "carts_userId_key" ON "carts"("userId");
CREATE UNIQUE INDEX "carts_sessionId_key" ON "carts"("sessionId");
CREATE INDEX "carts_sessionId_idx" ON "carts"("sessionId");

CREATE TABLE "cart_items" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "itemType" "CartItemType" NOT NULL,
    "itemId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cart_items_cartId_itemType_itemId_variantId_key" ON "cart_items"("cartId", "itemType", "itemId", "variantId");

ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────
-- Soul Tours
-- ─────────────────────────────────────────────

CREATE TABLE "soul_tours" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "shortDesc" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "location" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT DEFAULT 'United States',
    "basePrice" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "capacity" INTEGER NOT NULL,
    "spotsRemaining" INTEGER NOT NULL,
    "coverImageUrl" TEXT,
    "imageUrls" TEXT[],
    "highlights" TEXT[],
    "included" TEXT[],
    "notIncluded" TEXT[],
    "requirements" TEXT,
    "depositMin" DECIMAL(10,2),
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "soul_tours_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "soul_tours_slug_key" ON "soul_tours"("slug");
CREATE INDEX "soul_tours_guideId_startDate_idx" ON "soul_tours"("guideId", "startDate");
CREATE INDEX "soul_tours_slug_idx" ON "soul_tours"("slug");
CREATE INDEX "soul_tours_isPublished_startDate_idx" ON "soul_tours"("isPublished", "startDate");

ALTER TABLE "soul_tours" ADD CONSTRAINT "soul_tours_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "guide_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "tour_room_types" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pricePerNight" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "available" INTEGER NOT NULL,
    "amenities" TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tour_room_types_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "tour_room_types" ADD CONSTRAINT "tour_room_types_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "soul_tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "tour_bookings" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "seekerId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "travelers" INTEGER NOT NULL DEFAULT 1,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "depositAmount" DECIMAL(10,2),
    "depositPaidAt" TIMESTAMP(3),
    "balanceAmount" DECIMAL(10,2),
    "balancePaidAt" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "TourBookingStatus" NOT NULL DEFAULT 'PENDING',
    "specialRequests" TEXT,
    "contactFirstName" TEXT NOT NULL,
    "contactLastName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tour_bookings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tour_bookings_tourId_idx" ON "tour_bookings"("tourId");
CREATE INDEX "tour_bookings_seekerId_idx" ON "tour_bookings"("seekerId");

ALTER TABLE "tour_bookings" ADD CONSTRAINT "tour_bookings_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "soul_tours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tour_bookings" ADD CONSTRAINT "tour_bookings_seekerId_fkey" FOREIGN KEY ("seekerId") REFERENCES "seeker_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tour_bookings" ADD CONSTRAINT "tour_bookings_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "tour_room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────
-- Product Variants
-- ─────────────────────────────────────────────

CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "price" DECIMAL(10,2),
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "attributes" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");
CREATE INDEX "product_variants_productId_idx" ON "product_variants"("productId");

ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────
-- Promo Codes
-- ─────────────────────────────────────────────

CREATE TABLE "promo_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "PromoCodeType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "minOrderAmount" DECIMAL(10,2),
    "maxDiscountAmount" DECIMAL(10,2),
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "appliesToType" TEXT,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");
CREATE INDEX "promo_codes_code_idx" ON "promo_codes"("code");
CREATE INDEX "promo_codes_isActive_expiresAt_idx" ON "promo_codes"("isActive", "expiresAt");

-- ─────────────────────────────────────────────
-- Shipping Methods
-- ─────────────────────────────────────────────

CREATE TABLE "shipping_methods" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "estimatedDaysMin" INTEGER NOT NULL,
    "estimatedDaysMax" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_methods_pkey" PRIMARY KEY ("id")
);

-- ─────────────────────────────────────────────
-- Tax Rates
-- ─────────────────────────────────────────────

CREATE TABLE "tax_rates" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'US',
    "rate" DECIMAL(6,4) NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tax_rates_state_country_key" ON "tax_rates"("state", "country");

-- ─────────────────────────────────────────────
-- Extend existing tables
-- ─────────────────────────────────────────────

-- TicketPurchase: add attendee fields
ALTER TABLE "ticket_purchases" ADD COLUMN "attendeeName" TEXT;
ALTER TABLE "ticket_purchases" ADD COLUMN "attendeeEmail" TEXT;
ALTER TABLE "ticket_purchases" ADD COLUMN "dietaryNeeds" TEXT;
ALTER TABLE "ticket_purchases" ADD COLUMN "accessibilityNeeds" TEXT;

-- Order: add promo/shipping/tax fields
ALTER TABLE "orders" ADD COLUMN "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "shippingCost" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "taxRate" DECIMAL(6,4);
ALTER TABLE "orders" ADD COLUMN "contactEmail" TEXT;
ALTER TABLE "orders" ADD COLUMN "contactFirstName" TEXT;
ALTER TABLE "orders" ADD COLUMN "contactLastName" TEXT;
ALTER TABLE "orders" ADD COLUMN "contactPhone" TEXT;
ALTER TABLE "orders" ADD COLUMN "promoCodeId" TEXT;
ALTER TABLE "orders" ADD COLUMN "shippingMethodId" TEXT;
ALTER TABLE "orders" ADD COLUMN "notes" TEXT;

CREATE INDEX "orders_seekerId_idx" ON "orders"("seekerId");
CREATE INDEX "orders_status_createdAt_idx" ON "orders"("status", "createdAt");

ALTER TABLE "orders" ADD CONSTRAINT "orders_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "promo_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_shippingMethodId_fkey" FOREIGN KEY ("shippingMethodId") REFERENCES "shipping_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- OrderItem: add variantId
ALTER TABLE "order_items" ADD COLUMN "variantId" TEXT;

-- Payment: add tour booking, payment type, checkout session, payment method
ALTER TABLE "payments" ADD COLUMN "tourBookingId" TEXT;
ALTER TABLE "payments" ADD COLUMN "stripeCheckoutSessionId" TEXT;
ALTER TABLE "payments" ADD COLUMN "paymentType" "PaymentType" NOT NULL DEFAULT 'FULL';
ALTER TABLE "payments" ADD COLUMN "paymentMethod" TEXT;

CREATE INDEX "payments_status_createdAt_idx" ON "payments"("status", "createdAt");

ALTER TABLE "payments" ADD CONSTRAINT "payments_tourBookingId_fkey" FOREIGN KEY ("tourBookingId") REFERENCES "tour_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Products: add indexes
CREATE INDEX "products_guideId_idx" ON "products"("guideId");
CREATE INDEX "products_type_isActive_idx" ON "products"("type", "isActive");
