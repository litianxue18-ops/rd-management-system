-- CreateEnum
CREATE TYPE "CostAllocationStatus" AS ENUM ('draft', 'reviewing', 'approved');

-- CreateTable
CREATE TABLE "cost_allocation" (
    "id" SERIAL NOT NULL,
    "doc_no" TEXT NOT NULL,
    "project_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "labor_cost" DECIMAL(14,2) NOT NULL,
    "material_cost" DECIMAL(14,2) NOT NULL,
    "trial_cost" DECIMAL(14,2) NOT NULL,
    "outsource_cost" DECIMAL(14,2) NOT NULL,
    "shared_cost" DECIMAL(14,2) NOT NULL,
    "equity_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "status" "CostAllocationStatus" NOT NULL DEFAULT 'draft',
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_allocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cost_allocation_doc_no_key" ON "cost_allocation"("doc_no");

-- CreateIndex
CREATE INDEX "cost_allocation_year_month_status_idx" ON "cost_allocation"("year", "month", "status");

-- CreateIndex
CREATE UNIQUE INDEX "cost_allocation_project_id_year_month_key" ON "cost_allocation"("project_id", "year", "month");

-- AddForeignKey
ALTER TABLE "cost_allocation" ADD CONSTRAINT "cost_allocation_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
