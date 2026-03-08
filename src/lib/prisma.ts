import { PrismaClient } from '@prisma/client';
import { createPrismaClient } from './prisma-client';

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  createPrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  }).prisma;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
