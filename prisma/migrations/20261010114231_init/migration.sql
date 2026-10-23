-- CreateEnum
CREATE TYPE "PathogenType" AS ENUM ('VIRUS', 'BACTERIUM', 'PARASITE', 'FUNGUS', 'PRION', 'OTHER');

-- CreateEnum
CREATE TYPE "OutbreakStatus" AS ENUM ('SUSPECTED', 'CONFIRMED', 'REPORTED', 'DECLARED_OVER', 'HISTORICAL');

-- CreateEnum
CREATE TYPE "LocationPrecision" AS ENUM ('POINT', 'ADMIN2', 'ADMIN1', 'COUNTRY', 'REGION', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Indicator" AS ENUM ('CASES', 'DEATHS', 'INCIDENCE_RATE', 'MORTALITY_RATE', 'CASE_FATALITY_RATE');

-- CreateEnum
CREATE TYPE "CaseClassification" AS ENUM ('CONFIRMED', 'PROBABLE', 'SUSPECTED', 'REPORTED_UNSPECIFIED', 'ESTIMATED');

-- CreateEnum
CREATE TYPE "Aggregation" AS ENUM ('PERIOD_TOTAL', 'CUMULATIVE', 'PREVALENCE', 'RATE');

-- CreateEnum
CREATE TYPE "GeoScope" AS ENUM ('COUNTRY', 'REGION', 'INCOME_GROUP', 'GLOBAL', 'OTHER');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "SyncTrigger" AS ENUM ('SCHEDULED', 'MANUAL', 'CLI');

-- CreateTable
CREATE TABLE "Disease" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scientificName" TEXT,
    "alternativeNames" TEXT[],
    "description" TEXT NOT NULL,
    "pathogenType" "PathogenType" NOT NULL,
    "pathogen" TEXT,
    "transmission" TEXT NOT NULL,
    "symptoms" TEXT,
    "prevention" TEXT,
    "references" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Disease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Country" (
    "id" TEXT NOT NULL,
    "iso2" CHAR(2) NOT NULL,
    "iso3" CHAR(3) NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "subregion" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "homepageUrl" TEXT NOT NULL,
    "documentationUrl" TEXT,
    "license" TEXT NOT NULL,
    "licenseUrl" TEXT,
    "attributionRequirements" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSuccessfulSync" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceIndicator" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "diseaseId" TEXT NOT NULL,
    "indicator" "Indicator" NOT NULL,
    "caseClassification" "CaseClassification" NOT NULL,
    "aggregation" "Aggregation" NOT NULL,
    "unit" TEXT NOT NULL,
    "definition" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceIndicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outbreak" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "diseaseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "status" "OutbreakStatus" NOT NULL,
    "firstReportedAt" TIMESTAMP(3),
    "lastReportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Outbreak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutbreakLocation" (
    "id" TEXT NOT NULL,
    "outbreakId" TEXT NOT NULL,
    "countryId" TEXT,
    "regionName" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "locationPrecision" "LocationPrecision" NOT NULL,

    CONSTRAINT "OutbreakLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiseaseObservation" (
    "id" TEXT NOT NULL,
    "diseaseId" TEXT NOT NULL,
    "countryId" TEXT,
    "sourceId" TEXT NOT NULL,
    "sourceIndicatorId" TEXT NOT NULL,
    "indicator" "Indicator" NOT NULL,
    "value" DECIMAL(20,6),
    "lowerBound" DECIMAL(20,6),
    "upperBound" DECIMAL(20,6),
    "rawValue" TEXT,
    "unit" TEXT NOT NULL,
    "caseClassification" "CaseClassification" NOT NULL,
    "aggregation" "Aggregation" NOT NULL,
    "geoScope" "GeoScope" NOT NULL,
    "geoCode" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "reportedAt" TIMESTAMP(3),
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceRecordId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "isLatest" BOOLEAN NOT NULL DEFAULT true,
    "supersededAt" TIMESTAMP(3),
    "contentHash" TEXT NOT NULL,
    "syncJobId" TEXT,
    "sourceMetadata" JSONB,

    CONSTRAINT "DiseaseObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutbreakReport" (
    "id" TEXT NOT NULL,
    "outbreakId" TEXT,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3),
    "contentSummary" TEXT,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutbreakReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "trigger" "SyncTrigger" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" "SyncStatus" NOT NULL,
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "recordsInserted" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "recordsUnchanged" INTEGER NOT NULL DEFAULT 0,
    "recordsSkipped" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "warnings" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Disease_slug_key" ON "Disease"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Country_iso2_key" ON "Country"("iso2");

-- CreateIndex
CREATE UNIQUE INDEX "Country_iso3_key" ON "Country"("iso3");

-- CreateIndex
CREATE INDEX "Country_region_idx" ON "Country"("region");

-- CreateIndex
CREATE INDEX "Country_name_idx" ON "Country"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DataSource_slug_key" ON "DataSource"("slug");

-- CreateIndex
CREATE INDEX "SourceIndicator_diseaseId_idx" ON "SourceIndicator"("diseaseId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceIndicator_sourceId_code_key" ON "SourceIndicator"("sourceId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Outbreak_slug_key" ON "Outbreak"("slug");

-- CreateIndex
CREATE INDEX "Outbreak_diseaseId_lastReportedAt_idx" ON "Outbreak"("diseaseId", "lastReportedAt");

-- CreateIndex
CREATE INDEX "Outbreak_status_idx" ON "Outbreak"("status");

-- CreateIndex
CREATE INDEX "OutbreakLocation_outbreakId_idx" ON "OutbreakLocation"("outbreakId");

-- CreateIndex
CREATE INDEX "OutbreakLocation_countryId_idx" ON "OutbreakLocation"("countryId");

-- CreateIndex
CREATE INDEX "DiseaseObservation_sourceId_sourceRecordId_isLatest_idx" ON "DiseaseObservation"("sourceId", "sourceRecordId", "isLatest");

-- CreateIndex
CREATE INDEX "DiseaseObservation_diseaseId_indicator_isLatest_periodEnd_idx" ON "DiseaseObservation"("diseaseId", "indicator", "isLatest", "periodEnd");

-- CreateIndex
CREATE INDEX "DiseaseObservation_countryId_isLatest_idx" ON "DiseaseObservation"("countryId", "isLatest");

-- CreateIndex
CREATE INDEX "DiseaseObservation_sourceIndicatorId_isLatest_idx" ON "DiseaseObservation"("sourceIndicatorId", "isLatest");

-- CreateIndex
CREATE INDEX "DiseaseObservation_geoScope_geoCode_idx" ON "DiseaseObservation"("geoScope", "geoCode");

-- CreateIndex
CREATE UNIQUE INDEX "DiseaseObservation_sourceId_sourceRecordId_revision_key" ON "DiseaseObservation"("sourceId", "sourceRecordId", "revision");

-- CreateIndex
CREATE INDEX "OutbreakReport_outbreakId_idx" ON "OutbreakReport"("outbreakId");

-- CreateIndex
CREATE INDEX "OutbreakReport_publishedAt_idx" ON "OutbreakReport"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutbreakReport_sourceId_externalId_key" ON "OutbreakReport"("sourceId", "externalId");

-- CreateIndex
CREATE INDEX "SyncJob_sourceId_startedAt_idx" ON "SyncJob"("sourceId", "startedAt");

-- CreateIndex
CREATE INDEX "SyncJob_status_idx" ON "SyncJob"("status");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "SourceIndicator" ADD CONSTRAINT "SourceIndicator_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceIndicator" ADD CONSTRAINT "SourceIndicator_diseaseId_fkey" FOREIGN KEY ("diseaseId") REFERENCES "Disease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outbreak" ADD CONSTRAINT "Outbreak_diseaseId_fkey" FOREIGN KEY ("diseaseId") REFERENCES "Disease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutbreakLocation" ADD CONSTRAINT "OutbreakLocation_outbreakId_fkey" FOREIGN KEY ("outbreakId") REFERENCES "Outbreak"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutbreakLocation" ADD CONSTRAINT "OutbreakLocation_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiseaseObservation" ADD CONSTRAINT "DiseaseObservation_diseaseId_fkey" FOREIGN KEY ("diseaseId") REFERENCES "Disease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiseaseObservation" ADD CONSTRAINT "DiseaseObservation_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiseaseObservation" ADD CONSTRAINT "DiseaseObservation_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiseaseObservation" ADD CONSTRAINT "DiseaseObservation_sourceIndicatorId_fkey" FOREIGN KEY ("sourceIndicatorId") REFERENCES "SourceIndicator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiseaseObservation" ADD CONSTRAINT "DiseaseObservation_syncJobId_fkey" FOREIGN KEY ("syncJobId") REFERENCES "SyncJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutbreakReport" ADD CONSTRAINT "OutbreakReport_outbreakId_fkey" FOREIGN KEY ("outbreakId") REFERENCES "Outbreak"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutbreakReport" ADD CONSTRAINT "OutbreakReport_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
