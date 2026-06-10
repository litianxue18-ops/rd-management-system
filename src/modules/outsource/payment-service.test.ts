import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { ROLE_CODES as R } from '@/modules/permission/nodes';
import { hashPassword } from '@/modules/auth/password';
import { createSupplier } from './supplier-service';
import { createContract } from './contract-service';
import { registerPayment, listPayments } from './payment-service';

let deptId: number;
let typeId: number;
let leadId: number;
let financeLeadId: number;
let activeProjectId: number;
let supplierId: number;
let activeContractId: number;

async function makeUser(username: string, roleCode: string) {
  const role = await prisma.role.upsert({
    where: { code: roleCode },
    update: {},
    create: { code: roleCode, name: roleCode },
  });
  const u = await prisma.user.create({
    data: {
      username,
      employeeId: username.toUpperCase(),
      name: username,
      passwordHash: await hashPassword('p'),
      departmentId: deptId,
    },
  });
  await prisma.userRole.create({
    data: { userId: u.id, roleId: role.id, isPrimary: true },
  });
  return u.id;
}

beforeEach(async () => {
  deptId = (
    await prisma.department.create({ data: { code: 'rd', name: '研发' } })
  ).id;
  typeId = (
    await prisma.projectType.create({ data: { code: 'MAT', name: '新材料' } })
  ).id;
  await prisma.projectNumberRule.create({
    data: { code: 'default', pattern: 'RD-{TYPE}-{YYYY}-{NNN}' },
  });

  leadId = await makeUser('plead', R.PROJECT_LEAD);
  financeLeadId = await makeUser('fin', R.FINANCE_LEAD);

  activeProjectId = (
    await prisma.project.create({
      data: {
        code: 'P1',
        name: 'p',
        projectTypeId: typeId,
        departmentId: deptId,
        leadUserId: leadId,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2027-01-01'),
        budget: 200000,
        background: 'x',
        goals: 'x',
        techPlan: 'x',
        schedule: 'x',
        budgetDetail: 'x',
        expectedOutput: 'x',
        createdById: leadId,
        status: 'active',
      },
    })
  ).id;

  supplierId = (
    await createSupplier({ code: 'SUP-001', name: '上海材料厂' })
  ).id;

  const c = await createContract(leadId, {
    contractNo: 'CT-2026-001',
    projectId: activeProjectId,
    supplierId,
    title: '高温烧结炉委外加工',
    scope: '按试制方案 A',
    ipOwnership: '成果归我方',
    totalAmount: 100000,
    signedDate: new Date('2026-06-01'),
    startDate: new Date('2026-06-05'),
    endDate: new Date('2026-08-30'),
  });
  // 跳过 4 步审批, 直接 active
  await prisma.outsourceContract.update({
    where: { id: c.id },
    data: { status: 'active' },
  });
  activeContractId = c.id;
});

describe('registerPayment', () => {
  it('正常分两次付款 listPayments 按期数升序', async () => {
    await registerPayment(financeLeadId, {
      contractId: activeContractId,
      amount: 30000,
      paidDate: new Date('2026-07-01'),
      installmentNo: 1,
      note: '首付 30%',
    });
    const c1 = await prisma.outsourceContract.findUniqueOrThrow({
      where: { id: activeContractId },
    });
    expect(c1.status).toBe('active');

    await registerPayment(financeLeadId, {
      contractId: activeContractId,
      amount: 40000,
      paidDate: new Date('2026-08-01'),
      installmentNo: 2,
    });
    const list = await listPayments(activeContractId);
    expect(list).toHaveLength(2);
    expect(list[0].installmentNo).toBe(1);
    expect(list[1].installmentNo).toBe(2);
  });

  it('超额 → BusinessError', async () => {
    await registerPayment(financeLeadId, {
      contractId: activeContractId,
      amount: 60000,
      paidDate: new Date('2026-07-01'),
      installmentNo: 1,
    });
    await expect(
      registerPayment(financeLeadId, {
        contractId: activeContractId,
        amount: 50000,
        paidDate: new Date('2026-08-01'),
        installmentNo: 2,
      }),
    ).rejects.toThrow(/超过合同金额/);
  });

  it('全付完 → 合同自动 → completed', async () => {
    await registerPayment(financeLeadId, {
      contractId: activeContractId,
      amount: 60000,
      paidDate: new Date('2026-07-01'),
      installmentNo: 1,
    });
    await registerPayment(financeLeadId, {
      contractId: activeContractId,
      amount: 40000,
      paidDate: new Date('2026-08-01'),
      installmentNo: 2,
    });
    const c = await prisma.outsourceContract.findUniqueOrThrow({
      where: { id: activeContractId },
    });
    expect(c.status).toBe('completed');
  });

  it('非 active 合同 → 拒绝', async () => {
    await prisma.outsourceContract.update({
      where: { id: activeContractId },
      data: { status: 'draft' },
    });
    await expect(
      registerPayment(financeLeadId, {
        contractId: activeContractId,
        amount: 10000,
        paidDate: new Date(),
        installmentNo: 1,
      }),
    ).rejects.toThrow(/仅 active 合同/);
  });
});
