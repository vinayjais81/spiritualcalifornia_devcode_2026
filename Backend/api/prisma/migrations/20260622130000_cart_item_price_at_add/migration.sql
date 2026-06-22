-- Drift fix: CartItem.priceAtAdd was added to schema.prisma without a
-- migration, so deployed databases are missing the column (Prisma P2022
-- ColumnNotFound on CartService.getCart). Add it now.
-- Nullable + IF NOT EXISTS: legacy rows have no snapshot price, and the
-- column may already exist on DBs that were `db push`-ed.

ALTER TABLE "cart_items" ADD COLUMN IF NOT EXISTS "priceAtAdd" DECIMAL(10,2);
