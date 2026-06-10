-- CreateEnum
CREATE TYPE "MonthlyReportStatus" AS ENUM ('draft', 'reviewing', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "monthly_report" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "report_year" INTEGER NOT NULL,
    "report_month" INTEGER NOT NULL,
    "month_plan" TEXT NOT NULL,
    "actual_completion" TEXT NOT NULL,
    "outputs" TEXT NOT NULL,
    "problems" TEXT NOT NULL,
    "resource_usage" TEXT NOT NULL,
    "next_month_plan" TEXT NOT NULL,
    "status" "MonthlyReportStatus" NOT NULL DEFAULT 'draft',
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monthly_report_project_id_status_idx" ON "monthly_report"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_report_project_id_report_year_report_month_key" ON "monthly_report"("project_id", "report_year", "report_month");

-- AddForeignKey
ALTER TABLE "monthly_report" ADD CONSTRAINT "monthly_report_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
