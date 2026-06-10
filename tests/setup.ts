import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { beforeEach } from 'vitest';

loadEnv();

if (!process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL not set');
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const prisma = new PrismaClient();

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "finance_book_entry", "exception_note", "reconciliation_check", "quarterly_audit", "shared_resource_config", "capitalization_report", "closing_report", "outsource_payment", "outsource_contract", "outsource_supplier", "trial_cost_transfer", "trial_production_order", "sample_scrap_log", "material_usage_log", "inventory_ledger", "inventory_return", "inventory_outbound", "inventory_inbound", "material", "warehouse", "monthly_report", "workhour_entry", "cost_allocation", "project_change_request", "project_member", "project", "project_number_rule", "project_type", "approval_log", "approval_step", "approval_instance", "notification", "user_role", "role_permission_node", "user", "role", "department" RESTART IDENTITY CASCADE');
});
