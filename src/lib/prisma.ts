import { PrismaClient } from '@prisma/client';
import { createPrismaClient } from './prisma-client';

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  createPrismaClient({
    log: ['query'],
  }).prisma;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
