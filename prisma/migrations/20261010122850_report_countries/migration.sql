-- AlterTable
ALTER TABLE "OutbreakReport" ADD COLUMN     "countryIso3s" TEXT[] DEFAULT ARRAY[]::TEXT[];
