-- AlterTable
ALTER TABLE "Outbreak" ADD COLUMN     "sourceId" TEXT;

-- AlterTable
ALTER TABLE "OutbreakReport" ADD COLUMN     "displayId" TEXT,
ADD COLUMN     "scopeLabel" TEXT;

-- CreateIndex
CREATE INDEX "Outbreak_sourceId_idx" ON "Outbreak"("sourceId");

-- AddForeignKey
ALTER TABLE "Outbreak" ADD CONSTRAINT "Outbreak_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
