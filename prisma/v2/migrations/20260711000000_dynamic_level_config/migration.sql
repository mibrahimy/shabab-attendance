-- Self-describing per-city levels (NodeType) and roles (Position). Adds:
--   NodeType.key / color / headPositionKey, Position.key / attachLevelKey
-- and makes canonicalId NULLABLE on both (the global canonical tables become an
-- OPTIONAL cross-city spine; a null canonical = a custom, city-defined level/role).
-- A per-city UNIQUE(cityId, key) gives each level/role a stable per-city identity.
--
-- Additive + reversible; the currently-deployed app ignores the new columns. The
-- new columns are backfilled by prisma/migrate-backfill-level-config.ts (key =
-- canonical.key, color/head/attach from the old in-code maps) so runtime behavior
-- is unchanged until the Phase-2 refactor reads them.

ALTER TABLE "NodeType" ADD COLUMN "key" TEXT;
ALTER TABLE "NodeType" ADD COLUMN "color" TEXT;
ALTER TABLE "NodeType" ADD COLUMN "headPositionKey" TEXT;
ALTER TABLE "NodeType" ALTER COLUMN "canonicalId" DROP NOT NULL;

ALTER TABLE "Position" ADD COLUMN "key" TEXT;
ALTER TABLE "Position" ADD COLUMN "attachLevelKey" TEXT;
ALTER TABLE "Position" ALTER COLUMN "canonicalId" DROP NOT NULL;

-- NULLs compare as distinct, so these indexes are safe to create while `key` is
-- still all-NULL (pre-backfill) and while national rows share cityId = NULL.
CREATE UNIQUE INDEX "NodeType_cityId_key_key" ON "NodeType" ("cityId", "key");
CREATE UNIQUE INDEX "Position_cityId_key_key" ON "Position" ("cityId", "key");
