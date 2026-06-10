import { PrismaClient } from '@prisma/client';

const RULES = [
  { code: 'default', pattern: 'RD-{TYPE}-{YYYY}-{NNN}', description: '默认规则: RD-类型代码-年-3位序号' },
];

export async function seedNumberRules(prisma: PrismaClient) {
  for (const r of RULES) {
    await prisma.projectNumberRule.upsert({ where: { code: r.code }, update: r, create: r });
  }
  console.log(`seeded ${RULES.length} number rules`);
}
