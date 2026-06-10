-- CreateEnum
CREATE TYPE "SampleType" AS ENUM ('sample', 'scrap');

-- CreateEnum
CREATE TYPE "SampleDisposalMethod" AS ENUM ('retained', 'destroyed', 'sold', 'internal_use');

-- CreateEnum
CREATE TYPE "TrialOrderStatus" AS ENUM ('draft', 'reviewing', 'approved', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "TrialTransferStatus" AS ENUM ('draft', 'reviewing', 'approved', 'settled', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "OutsourceContractStatus" AS ENUM ('draft', 'reviewing', 'active', 'completed', 'rejected', 'cancelled');

-- CreateTable
CREATE TABLE "sample_scrap_log" (
    "id" SERIAL NOT NULL,
    "doc_no" TEXT NOT NULL,
    "project_id" INTEGER NOT NULL,
    "type" "SampleType" NOT NULL,
    "source_outbound_id" INTEGER,
    "material_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "consumed_qty" DECIMAL(12,2) NOT NULL,
    "product_name" TEXT,
    "product_qty" DECIMAL(12,2),
    "product_unit" TEXT,
    "disposal_method" "SampleDisposalMethod" NOT NULL,
    "disposal_income" DECIMAL(12,2),
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "registered_by_id" INTEGER NOT NULL,
    "supervised_by_id" INTEGER,
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supervised_at" TIMESTAMP(3),

    CONSTRAINT "sample_scrap_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trial_production_order" (
    "id" SERIAL NOT NULL,
    "doc_no" TEXT NOT NULL,
    "project_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "planned_qty" DECIMAL(12,2) NOT NULL,
    "planned_unit" TEXT NOT NULL,
    "actual_qty" DECIMAL(12,2),
    "scheduled_start" DATE,
    "scheduled_end" DATE,
    "actual_start" DATE,
    "actual_end" DATE,
    "status" "TrialOrderStatus" NOT NULL DEFAULT 'draft',
    "requester_id" INTEGER NOT NULL,
    "production_lead_id" INTEGER,
    "rejected_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trial_production_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trial_cost_transfer" (
    "id" SERIAL NOT NULL,
    "doc_no" TEXT NOT NULL,
    "trial_order_id" INTEGER NOT NULL,
    "project_id" INTEGER NOT NULL,
    "labor_cost" DECIMAL(14,2) NOT NULL,
    "machine_cost" DECIMAL(14,2) NOT NULL,
    "material_cost" DECIMAL(14,2) NOT NULL,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TrialTransferStatus" NOT NULL DEFAULT 'draft',
    "requester_id" INTEGER NOT NULL,
    "rejected_reason" TEXT,
    "settled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trial_cost_transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outsource_supplier" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact_person" TEXT,
    "contact_phone" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outsource_supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outsource_contract" (
    "id" SERIAL NOT NULL,
    "contract_no" TEXT NOT NULL,
    "project_id" INTEGER NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "ip_ownership" TEXT NOT NULL,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "signed_date" DATE NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "OutsourceContractStatus" NOT NULL DEFAULT 'draft',
    "requester_id" INTEGER NOT NULL,
    "rejected_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outsource_contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outsource_payment" (
    "id" SERIAL NOT NULL,
    "contract_id" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paid_date" DATE NOT NULL,
    "installment_no" INTEGER NOT NULL,
    "note" TEXT,
    "registered_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outsource_payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sample_scrap_log_doc_no_key" ON "sample_scrap_log"("doc_no");

-- CreateIndex
CREATE INDEX "sample_scrap_log_project_id_idx" ON "sample_scrap_log"("project_id");

-- CreateIndex
CREATE INDEX "sample_scrap_log_status_idx" ON "sample_scrap_log"("status");

-- CreateIndex
CREATE UNIQUE INDEX "trial_production_order_doc_no_key" ON "trial_production_order"("doc_no");

-- CreateIndex
CREATE INDEX "trial_production_order_project_id_status_idx" ON "trial_production_order"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "trial_cost_transfer_doc_no_key" ON "trial_cost_transfer"("doc_no");

-- CreateIndex
CREATE INDEX "trial_cost_transfer_project_id_status_idx" ON "trial_cost_transfer"("project_id", "status");

-- CreateIndex
CREATE INDEX "trial_cost_transfer_trial_order_id_idx" ON "trial_cost_transfer"("trial_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "outsource_supplier_code_key" ON "outsource_supplier"("code");

-- CreateIndex
CREATE UNIQUE INDEX "outsource_contract_contract_no_key" ON "outsource_contract"("contract_no");

-- CreateIndex
CREATE INDEX "outsource_contract_project_id_status_idx" ON "outsource_contract"("project_id", "status");

-- CreateIndex
CREATE INDEX "outsource_payment_contract_id_idx" ON "outsource_payment"("contract_id");

-- AddForeignKey
ALTER TABLE "sample_scrap_log" ADD CONSTRAINT "sample_scrap_log_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_scrap_log" ADD CONSTRAINT "sample_scrap_log_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trial_production_order" ADD CONSTRAINT "trial_production_order_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trial_cost_transfer" ADD CONSTRAINT "trial_cost_transfer_trial_order_id_fkey" FOREIGN KEY ("trial_order_id") REFERENCES "trial_production_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trial_cost_transfer" ADD CONSTRAINT "trial_cost_transfer_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outsource_contract" ADD CONSTRAINT "outsource_contract_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outsource_contract" ADD CONSTRAINT "outsource_contract_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "outsource_supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outsource_payment" ADD CONSTRAINT "outsource_payment_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "outsource_contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
