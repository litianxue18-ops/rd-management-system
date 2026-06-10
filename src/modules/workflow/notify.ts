import { prisma } from '@/shared/prisma';
import type { Prisma } from '@prisma/client';

export interface NotifyInput {
  eventType: string;
  entityType?: string;
  entityId?: number;
  message: string;
}

/** 推给某角色的所有在职用户. */
export async function notifyRoles(roles: string[], input: NotifyInput, tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma;
  const recipients = await client.userRole.findMany({
    where: { role: { code: { in: roles } }, user: { isActive: true } },
    select: { userId: true },
    distinct: ['userId'],
  });
  if (recipients.length === 0) return 0;
  await client.notification.createMany({
    data: recipients.map((r) => ({
      recipientId: r.userId,
      eventType: input.eventType,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      message: input.message,
    })),
  });
  return recipients.length;
}

/** 推给特定用户. */
export async function notifyUsers(userIds: number[], input: NotifyInput, tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma;
  if (userIds.length === 0) return 0;
  await client.notification.createMany({
    data: userIds.map((uid) => ({
      recipientId: uid,
      eventType: input.eventType,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      message: input.message,
    })),
  });
  return userIds.length;
}
