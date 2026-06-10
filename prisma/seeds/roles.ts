import { PrismaClient } from '@prisma/client';
import { ROLE_CODES } from '../../src/modules/permission/nodes';

const ROLES: Array<{ code: string; name: string; isSystem?: boolean; description?: string }> = [
  { code: ROLE_CODES.PROJECT_LEAD,     name: '项目负责人' },
  { code: ROLE_CODES.RD_DIRECTOR,      name: '研发中心负责人' },
  { code: ROLE_CODES.TECH_COMMITTEE,   name: '技术委员会' },
  { code: ROLE_CODES.RESEARCHER,       name: '研发员' },
  { code: ROLE_CODES.PRODUCTION_LEAD,  name: '生产部负责人' },
  { code: ROLE_CODES.PURCHASE_LEAD,    name: '采购部负责人' },
  { code: ROLE_CODES.WAREHOUSE_KEEPER, name: '仓库管理员' },
  { code: ROLE_CODES.EQUIPMENT_LEAD,   name: '设备部负责人' },
  { code: ROLE_CODES.HR_LEAD,          name: '人力资源负责人' },
  { code: ROLE_CODES.FINANCE_LEAD,     name: '财务部负责人' },
  { code: ROLE_CODES.AUDIT_LEAD,       name: '审计部负责人' },
  { code: ROLE_CODES.CEO,              name: '总经理' },
  { code: ROLE_CODES.SUPER_ADMIN,      name: '系统管理员', isSystem: true, description: '不参与业务流程, 仅基础数据维护' },
];

export async function seedRoles(prisma: PrismaClient) {
  for (const r of ROLES) {
    await prisma.role.upsert({ where: { code: r.code }, update: r, create: r });
  }
  console.log(`seeded ${ROLES.length} roles`);
}
