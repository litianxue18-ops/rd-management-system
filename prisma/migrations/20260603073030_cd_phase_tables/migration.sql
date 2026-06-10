-- CreateEnum
CREATE TYPE "ClosingReportStatus" AS ENUM ('draft', 'reviewing', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "CapitalizationStatus" AS ENUM ('draft', 'reviewing', 'approved', 'rejected', 'cancelled');

-- CreateTable
CREATE TABLE "closing_report" (
    "id" SERIAL NOT NULL,
    "doc_no" TEXT NOT NULL,
    "project_id" INTEGER NOT NULL,
    "basic_summary" TEXT NOT NULL,
    "goal_review" TEXT NOT NULL,
    "outputs" TEXT NOT NULL,
    "budget_review" TEXT NOT NULL,
    "lessons" TEXT NOT NULL,
    "conversion_plan" TEXT NOT NULL,
    "status" "ClosingReportStatus" NOT NULL DEFAULT 'draft',
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "approved_at" TIMESTAMP(3),
    "rejected_reason" TEXT,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "closing_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capitalization_report" (
    "id" SERIAL NOT NULL,
    "doc_no" TEXT NOT NULL,
    "project_id" INTEGER NOT NULL,
    "cond_technical" BOOLEAN NOT NULL DEFAULT false,
    "cond_intent" BOOLEAN NOT NULL DEFAULT false,
    "cond_usability" BOOLEAN NOT NULL DEFAULT false,
    "cond_market" BOOLEAN NOT NULL DEFAULT false,
    "cond_resource" BOOLEAN NOT NULL DEFAULT false,
    "evidence_technical" TEXT NOT NULL,
    "evidence_market" TEXT NOT NULL,
    "evidence_resource" TEXT NOT NULL,
    "evidence_cost" TEXT NOT NULL,
    "capitalization_amount" DECIMAL(14,2) NOT NULL,
    "status" "CapitalizationStatus" NOT NULL DEFAULT 'draft',
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "approved_at" TIMESTAMP(3),
    "rejected_reason" TEXT,

    CONSTRAINT "capitalization_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_check" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "check_type" TEXT NOT NULL,
    "expected_value" DECIMAL(18,2) NOT NULL,
    "actual_value" DECIMAL(18,2) NOT NULL,
    "diff_rate" DECIMAL(8,4) NOT NULL,
    "is_exception" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reconciliation_check_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exception_note" (
    "id" SERIAL NOT NULL,
    "doc_no" TEXT NOT NULL,
    "reconciliation_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "reason" TEXT NOT NULL,
    "resolution" TEXT,
    "raised_by_id" INTEGER NOT NULL,
    "resolved_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "exception_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quarterly_audit" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "check_project" TEXT NOT NULL,
    "check_budget" TEXT NOT NULL,
    "check_material" TEXT NOT NULL,
    "check_outsource" TEXT NOT NULL,
    "check_archive" TEXT NOT NULL,
    "compliant_project" BOOLEAN NOT NULL DEFAULT false,
    "compliant_budget" BOOLEAN NOT NULL DEFAULT false,
    "compliant_material" BOOLEAN NOT NULL DEFAULT false,
    "compliant_outsource" BOOLEAN NOT NULL DEFAULT false,
    "compliant_archive" BOOLEAN NOT NULL DEFAULT false,
    "overall_opinion" TEXT NOT NULL,
    "auditor_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quarterly_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "closing_report_doc_no_key" ON "closing_report"("doc_no");

-- CreateIndex
CREATE UNIQUE INDEX "closing_report_project_id_key" ON "closing_report"("project_id");

-- CreateIndex
CREATE INDEX "closing_report_status_idx" ON "closing_report"("status");

-- CreateIndex
CREATE UNIQUE INDEX "capitalization_report_doc_no_key" ON "capitalization_report"("doc_no");

-- CreateIndex
CREATE INDEX "capitalization_report_project_id_status_idx" ON "capitalization_report"("project_id", "status");

-- CreateIndex
CREATE INDEX "reconciliation_check_is_exception_idx" ON "reconciliation_check"("is_exception");

-- CreateIndex
CREATE UNIQUE INDEX "reconciliation_check_year_month_check_type_key" ON "reconciliation_check"("year", "month", "check_type");

-- CreateIndex
CREATE UNIQUE INDEX "exception_note_doc_no_key" ON "exception_note"("doc_no");

-- CreateIndex
CREATE INDEX "exception_note_reconciliation_id_idx" ON "exception_note"("reconciliation_id");

-- CreateIndex
CREATE INDEX "exception_note_status_idx" ON "exception_note"("status");

-- CreateIndex
CREATE UNIQUE INDEX "quarterly_audit_year_quarter_key" ON "quarterly_audit"("year", "quarter");

-- AddForeignKey
ALTER TABLE "closing_report" ADD CONSTRAINT "closing_report_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capitalization_report" ADD CONSTRAINT "capitalization_report_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exception_note" ADD CONSTRAINT "exception_note_reconciliation_id_fkey" FOREIGN KEY ("reconciliation_id") REFERENCES "reconciliation_check"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
