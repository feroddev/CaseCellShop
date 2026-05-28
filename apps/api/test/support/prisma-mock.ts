import { Prisma } from '@prisma/client';

export function prismaUniqueViolation(
  target: string[] = ['idempotencyKey'],
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(
    'Unique constraint failed',
    { clientVersion: 'test', code: 'P2002' },
    { target },
  );
}
