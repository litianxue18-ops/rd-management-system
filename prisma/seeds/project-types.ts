import { PrismaClient } from '@prisma/client';

const TYPES = [
  { code: 'MAT', name: '新材料配方研发', description: '阻燃材料、高附着力胶水、氧化物及环保涂层等' },
  { code: 'PRC', name: '生产工艺优化', description: '在线涂布均匀性、涂布精度、节能干燥等' },
  { code: 'NEW', name: '新产品开发', description: '高阻隔酒盒内衬膜、智能调光汽车膜、超薄阻燃 BOPET 等' },
  { code: 'EQP', name: '设备改造与自动化升级', description: '分切机张力控制、在线检测、涂布相关设备等' },
];

export async function seedProjectTypes(prisma: PrismaClient) {
  for (const t of TYPES) {
    await prisma.projectType.upsert({ where: { code: t.code }, update: t, create: t });
  }
  console.log(`seeded ${TYPES.length} project types`);
}
