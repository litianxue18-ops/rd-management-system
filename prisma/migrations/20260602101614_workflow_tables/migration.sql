-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('draft', 'running', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('pending', 'approved', 'rejected', 'skipped', 'transferred');

-- CreateEnum
CREATE TYPE "ApprovalAction" AS ENUM ('submit', 'approve', 'reject', 'withdraw', 'transfer', 'notify');

-- CreateTable
CREATE TABLE "approval_instance" (
    "id" SERIAL NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "workflow_code" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'draft',
    "current_step_id" INTEGER,
    "submitted_by" INTEGER NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "approval_instance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_step" (
    "id" SERIAL NOT NULL,
    "instance_id" INTEGER NOT NULL,
    "step_index" INTEGER NOT NULL,
    "step_name" TEXT NOT NULL,
    "required_role" TEXT NOT NULL,
    "assigned_user_id" INTEGER,
    "status" "StepStatus" NOT NULL DEFAULT 'pending',
    "acted_by" INTEGER,
    "acted_at" TIMESTAMP(3),
    "comments" TEXT,

    CONSTRAINT "approval_step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_log" (
    "id" SERIAL NOT NULL,
    "instance_id" INTEGER NOT NULL,
    "step_id" INTEGER,
    "action" "ApprovalAction" NOT NULL,
    "actor_id" INTEGER NOT NULL,
    "target_user_id" INTEGER,
    "comments" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" SERIAL NOT NULL,
    "recipient_id" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" INTEGER,
    "message" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "approval_instance_entity_type_entity_id_idx" ON "approval_instance"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "approval_instance_submitted_by_idx" ON "approval_instance"("submitted_by");

-- CreateIndex
CREATE INDEX "approval_instance_status_idx" ON "approval_instance"("status");

-- CreateIndex
CREATE INDEX "approval_step_assigned_user_id_status_idx" ON "approval_step"("assigned_user_id", "status");

-- CreateIndex
CREATE INDEX "approval_log_instance_id_idx" ON "approval_log"("instance_id");

-- CreateIndex
CREATE INDEX "notification_recipient_id_read_at_idx" ON "notification"("recipient_id", "read_at");

-- AddForeignKey
ALTER TABLE "approval_step" ADD CONSTRAINT "approval_step_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "approval_instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_log" ADD CONSTRAINT "approval_log_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "approval_instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
