-- CreateEnum
CREATE TYPE "InventoryChangeType" AS ENUM ('init', 'inbound', 'outbound', 'return', 'scrap', 'adjust');

-- CreateEnum
CREATE TYPE "InventoryRequestStatus" AS ENUM ('draft', 'reviewing', 'approved', 'issued', 'rejected', 'cancelled', 'returned');

-- CreateTable
CREATE TABLE "material" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "spec" TEXT,
    "unit" TEXT NOT NULL,
    "category" TEXT,
    "is_hazmat" BOOLEAN NOT NULL DEFAULT false,
    "safety_stock" DECIMAL(12,2),
    "max_stock" DECIMAL(12,2),
    "shelf_life_days" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_inbound" (
    "id" SERIAL NOT NULL,
    "doc_no" TEXT NOT NULL,
    "material_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit_price" DECIMAL(12,2),
    "change_type" "InventoryChangeType" NOT NULL DEFAULT 'inbound',
    "supplier" TEXT,
    "batch_no" TEXT,
    "expiry_date" DATE,
    "note" TEXT,
    "received_at" DATE NOT NULL,
    "operator_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_inbound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_outbound" (
    "id" SERIAL NOT NULL,
    "doc_no" TEXT NOT NULL,
    "project_id" INTEGER NOT NULL,
    "material_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "requested_qty" DECIMAL(12,2) NOT NULL,
    "issued_qty" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "returned_qty" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unit_price" DECIMAL(12,2),
    "purpose" TEXT NOT NULL,
    "status" "InventoryRequestStatus" NOT NULL DEFAULT 'draft',
    "requester_id" INTEGER NOT NULL,
    "approved_by_id" INTEGER,
    "issued_by_id" INTEGER,
    "rejected_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMP(3),
    "issued_at" TIMESTAMP(3),

    CONSTRAINT "inventory_outbound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_return" (
    "id" SERIAL NOT NULL,
    "outbound_id" INTEGER NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "returned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operator_id" INTEGER NOT NULL,

    CONSTRAINT "inventory_return_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_ledger" (
    "id" SERIAL NOT NULL,
    "material_id" INTEGER NOT NULL,
    "warehouse_id" INTEGER NOT NULL,
    "change_type" "InventoryChangeType" NOT NULL,
    "change_qty" DECIMAL(12,2) NOT NULL,
    "balance_after" DECIMAL(12,2) NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" INTEGER NOT NULL,
    "project_id" INTEGER,
    "operator_id" INTEGER NOT NULL,
    "note" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "material_code_key" ON "material"("code");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_code_key" ON "warehouse"("code");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_inbound_doc_no_key" ON "inventory_inbound"("doc_no");

-- CreateIndex
CREATE INDEX "inventory_inbound_material_id_received_at_idx" ON "inventory_inbound"("material_id", "received_at");

-- CreateIndex
CREATE INDEX "inventory_inbound_warehouse_id_received_at_idx" ON "inventory_inbound"("warehouse_id", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_outbound_doc_no_key" ON "inventory_outbound"("doc_no");

-- CreateIndex
CREATE INDEX "inventory_outbound_project_id_status_idx" ON "inventory_outbound"("project_id", "status");

-- CreateIndex
CREATE INDEX "inventory_outbound_requester_id_status_idx" ON "inventory_outbound"("requester_id", "status");

-- CreateIndex
CREATE INDEX "inventory_outbound_material_id_idx" ON "inventory_outbound"("material_id");

-- CreateIndex
CREATE INDEX "inventory_outbound_status_idx" ON "inventory_outbound"("status");

-- CreateIndex
CREATE INDEX "inventory_return_outbound_id_idx" ON "inventory_return"("outbound_id");

-- CreateIndex
CREATE INDEX "inventory_ledger_material_id_warehouse_id_occurred_at_idx" ON "inventory_ledger"("material_id", "warehouse_id", "occurred_at");

-- CreateIndex
CREATE INDEX "inventory_ledger_project_id_idx" ON "inventory_ledger"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_ledger_source_type_source_id_material_id_key" ON "inventory_ledger"("source_type", "source_id", "material_id");

-- AddForeignKey
ALTER TABLE "inventory_inbound" ADD CONSTRAINT "inventory_inbound_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_inbound" ADD CONSTRAINT "inventory_inbound_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_outbound" ADD CONSTRAINT "inventory_outbound_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_outbound" ADD CONSTRAINT "inventory_outbound_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_outbound" ADD CONSTRAINT "inventory_outbound_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_return" ADD CONSTRAINT "inventory_return_outbound_id_fkey" FOREIGN KEY ("outbound_id") REFERENCES "inventory_outbound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ledger" ADD CONSTRAINT "inventory_ledger_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ledger" ADD CONSTRAINT "inventory_ledger_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
