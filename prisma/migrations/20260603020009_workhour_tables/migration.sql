-- CreateEnum
CREATE TYPE "WorkhourStatus" AS ENUM ('draft', 'reviewing', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "workhour_entry" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "project_id" INTEGER NOT NULL,
    "work_date" DATE NOT NULL,
    "hours" DECIMAL(4,1) NOT NULL,
    "work_content" TEXT NOT NULL,
    "status" "WorkhourStatus" NOT NULL DEFAULT 'draft',
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "rejected_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workhour_entry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workhour_entry_user_id_work_date_idx" ON "workhour_entry"("user_id", "work_date");

-- CreateIndex
CREATE INDEX "workhour_entry_project_id_work_date_status_idx" ON "workhour_entry"("project_id", "work_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "workhour_entry_user_id_project_id_work_date_key" ON "workhour_entry"("user_id", "project_id", "work_date");

-- AddForeignKey
ALTER TABLE "workhour_entry" ADD CONSTRAINT "workhour_entry_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workhour_entry" ADD CONSTRAINT "workhour_entry_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
