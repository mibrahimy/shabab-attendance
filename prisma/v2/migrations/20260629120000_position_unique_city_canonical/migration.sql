-- DropIndex
DROP INDEX "Position_cityId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Position_cityId_canonicalId_key" ON "Position"("cityId", "canonicalId");
