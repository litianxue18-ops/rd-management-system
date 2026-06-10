-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('draft', 'reviewing', 'rejected', 'active', 'closed', 'cancelled');

-- CreateTable
CREATE TABLE "project_type" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "project_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_number_rule" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_number_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "project_type_id" INTEGER NOT NULL,
    "department_id" INTEGER NOT NULL,
    "lead_user_id" INTEGER NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'draft',
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "budget" DECIMAL(14,2) NOT NULL,
    "background" TEXT NOT NULL,
    "goals" TEXT NOT NULL,
    "tech_plan" TEXT NOT NULL,
    "schedule" TEXT NOT NULL,
    "budget_detail" TEXT NOT NULL,
    "expected_output" TEXT NOT NULL,
    "attachments_note" TEXT,
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "activated_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "rejected_reason" TEXT,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_member" (
    "project_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "is_lead" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_member_pkey" PRIMARY KEY ("project_id","user_id")
);

-- CreateTable
CREATE TABLE "project_change_request" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "new_budget" DECIMAL(14,2),
    "new_end_date" DATE,
    "details" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'draft',
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_at" TIMESTAMP(3),

    CONSTRAINT "project_change_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_type_code_key" ON "project_type"("code");

-- CreateIndex
CREATE UNIQUE INDEX "project_number_rule_code_key" ON "project_number_rule"("code");

-- CreateIndex
CREATE UNIQUE INDEX "project_code_key" ON "project"("code");

-- CreateIndex
CREATE INDEX "project_status_lead_user_id_idx" ON "project"("status", "lead_user_id");

-- CreateIndex
CREATE INDEX "project_department_id_status_idx" ON "project"("department_id", "status");

-- CreateIndex
CREATE INDEX "project_change_request_project_id_status_idx" ON "project_change_request"("project_id", "status");

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_project_type_id_fkey" FOREIGN KEY ("project_type_id") REFERENCES "project_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_change_request" ADD CONSTRAINT "project_change_request_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
