-- AlterTable
ALTER TABLE "role_permission_node" DROP CONSTRAINT "role_permission_node_pkey";
ALTER TABLE "role_permission_node" ADD CONSTRAINT "role_permission_node_pkey" PRIMARY KEY ("role_id", "node_code", "raci");
