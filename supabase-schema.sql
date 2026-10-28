-- ========================================================
-- RINQ SHOP - SUPABASE POSTGRESQL INITIAL SCHEMA
-- Dán toàn bộ mã này vào SQL Editor trên Supabase và bấm RUN
-- ========================================================

-- 1. Bảng Product
CREATE TABLE IF NOT EXISTS "Product" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "priceNote" TEXT,
    "imageUrl" TEXT,
    "supplierVariantId" TEXT,
    "fulfillmentType" TEXT DEFAULT 'HYBRID',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- 2. Bảng StockItem
CREATE TABLE IF NOT EXISTS "StockItem" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "isSold" BOOLEAN NOT NULL DEFAULT false,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- 3. Bảng Order
CREATE TABLE IF NOT EXISTS "Order" (
    "id" TEXT NOT NULL,
    "telegramId" TEXT NOT NULL,
    "username" TEXT,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "totalAmount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "qrMessageId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- 4. Bảng TelegramUser
CREATE TABLE IF NOT EXISTS "TelegramUser" (
    "id" TEXT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramUser_pkey" PRIMARY KEY ("id")
);

-- 5. Bảng WebAuthSession
CREATE TABLE IF NOT EXISTS "WebAuthSession" (
    "token" TEXT NOT NULL,
    "telegramId" TEXT,
    "username" TEXT,
    "firstName" TEXT,
    "photoUrl" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WebAuthSession_pkey" PRIMARY KEY ("token")
);

-- 6. Bảng BotHeartbeat
CREATE TABLE IF NOT EXISTS "BotHeartbeat" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lastPing" BIGINT NOT NULL,
    CONSTRAINT "BotHeartbeat_pkey" PRIMARY KEY ("id")
);

-- 7. Bảng Coupon
CREATE TABLE IF NOT EXISTS "Coupon" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "discount" INTEGER NOT NULL,
    "isPercent" BOOLEAN NOT NULL DEFAULT false,
    "maxUsage" INTEGER NOT NULL DEFAULT 100,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- 8. Bảng Giveaway
CREATE TABLE IF NOT EXISTS "Giveaway" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "reward" TEXT NOT NULL,
    "description" TEXT,
    "winnerCount" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    CONSTRAINT "Giveaway_pkey" PRIMARY KEY ("id")
);

-- 9. Bảng GiveawayParticipant
CREATE TABLE IF NOT EXISTS "GiveawayParticipant" (
    "id" SERIAL NOT NULL,
    "giveawayId" INTEGER NOT NULL,
    "telegramId" TEXT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GiveawayParticipant_pkey" PRIMARY KEY ("id")
);

-- 10. Bảng GiveawayWinner
CREATE TABLE IF NOT EXISTS "GiveawayWinner" (
    "id" SERIAL NOT NULL,
    "giveawayId" INTEGER NOT NULL,
    "telegramId" TEXT NOT NULL,
    "username" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GiveawayWinner_pkey" PRIMARY KEY ("id")
);

-- Indexes & Unique Keys
CREATE INDEX IF NOT EXISTS "StockItem_productId_isSold_idx" ON "StockItem"("productId", "isSold");
CREATE INDEX IF NOT EXISTS "Order_telegramId_status_idx" ON "Order"("telegramId", "status");
CREATE INDEX IF NOT EXISTS "WebAuthSession_token_isVerified_idx" ON "WebAuthSession"("token", "isVerified");
CREATE UNIQUE INDEX IF NOT EXISTS "Coupon_code_key" ON "Coupon"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "GiveawayParticipant_giveawayId_telegramId_key" ON "GiveawayParticipant"("giveawayId", "telegramId");

-- Foreign Keys
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockItem_productId_fkey') THEN
        ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockItem_orderId_fkey') THEN
        ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Order_productId_fkey') THEN
        ALTER TABLE "Order" ADD CONSTRAINT "Order_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GiveawayParticipant_giveawayId_fkey') THEN
        ALTER TABLE "GiveawayParticipant" ADD CONSTRAINT "GiveawayParticipant_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GiveawayWinner_giveawayId_fkey') THEN
        ALTER TABLE "GiveawayWinner" ADD CONSTRAINT "GiveawayWinner_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
