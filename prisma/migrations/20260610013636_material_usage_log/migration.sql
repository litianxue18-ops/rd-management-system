-- CreateEnum
CREATE TYPE "MaterialUsageEvent" AS ENUM ('testing', 'trial_prep', 'sample_making', 'loss', 'other');

-- CreateTable
CREATE TABLE "material_usage_log" (
    "id" SERIAL NOT NULL,
    "outbound_id" INTEGER NOT NULL,
    "material_id" INTEGER NOT NULL,
    "project_id" INTEGER NOT NULL,
    "usage_date" DATE NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "event_type" "MaterialUsageEvent" NOT NULL,
    "description" TEXT NOT NULL,
    "operator_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_usage_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "material_usage_log_outbound_id_idx" ON "material_usage_log"("outbound_id");

-- CreateIndex
CREATE INDEX "material_usage_log_project_id_idx" ON "material_usage_log"("project_id");

-- AddForeignKey
ALTER TABLE "material_usage_log" ADD CONSTRAINT "material_usage_log_outbound_id_fkey" FOREIGN KEY ("outbound_id") REFERENCES "inventory_outbound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_usage_log" ADD CONSTRAINT "material_usage_log_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
