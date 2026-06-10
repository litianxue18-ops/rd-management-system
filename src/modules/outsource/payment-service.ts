import { prisma } from '@/shared/prisma';
import { BusinessError } from '@/shared/errors';
import { setCompleted } from './contract-service';

export interface PaymentInput {
  contractId: number;
  amount: number;
  paidDate: Date;
  installmentNo: number;
  note?: string;
}

/**
 * 登记付款.
 * 校验:
 *  - amount > 0
 *  - 合同 status='active'
 *  - 累计 + amount <= totalAmount
 * 副作用:
 *  - 若累计 + amount == totalAmount, 合同 → completed
 */
export async function registerPayment(operatorId: number, input: PaymentInput) {
  if (input.amount <= 0) throw new BusinessError('付款金额必须 > 0');
  if (!(input.installmentNo > 0)) throw new BusinessError('期数必须 > 0');

  return prisma.$transaction(async (tx) => {
    const c = await tx.outsourceContract.findUnique({
      where: { id: input.contractId },
      include: { payments: true },
    });
    if (!c) throw new BusinessError('合同不存在');
    if (c.status !== 'active') {
      throw new BusinessError('仅 active 合同可登记付款');
    }
    const paidSoFar = c.payments.reduce(
      (acc, p) => acc + Number(p.amount),
      0,
    );
    const newTotal = paidSoFar + input.amount;
    const totalAmount = Number(c.totalAmount);
    if (newTotal > totalAmount) {
      throw new BusinessError(
        `超过合同金额 (已付 ${paidSoFar}, 本次 ${input.amount}, 总额 ${totalAmount})`,
      );
    }

    const payment = await tx.outsourcePayment.create({
      data: {
        contractId: input.contractId,
        amount: input.amount,
        paidDate: input.paidDate,
        installmentNo: input.installmentNo,
        note: input.note,
        registeredById: operatorId,
      },
    });

    if (newTotal === totalAmount) {
      await setCompleted(input.contractId, tx);
    }

    return payment;
  });
}

export async function listPayments(contractId: number) {
  return prisma.outsourcePayment.findMany({
    where: { contractId },
    orderBy: { installmentNo: 'asc' },
  });
}
