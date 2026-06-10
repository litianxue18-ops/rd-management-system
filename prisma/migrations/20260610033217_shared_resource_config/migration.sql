-- CreateTable
CREATE TABLE "shared_resource_config" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "resource_name" TEXT NOT NULL,
    "annual_amount" DECIMAL(14,2) NOT NULL,
    "alloc_basis" TEXT NOT NULL,
    "note" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_resource_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shared_resource_config_year_idx" ON "shared_resource_config"("year");
