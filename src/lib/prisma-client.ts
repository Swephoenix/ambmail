import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

type PrismaClientOptions = Omit<
  ConstructorParameters<typeof PrismaClient>[0],
  'adapter' | 'accelerateUrl'
>;

export const createPrismaClient = (options: PrismaClientOptions = {}) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({
    ...options,
    adapter,
  });

  return { prisma, pool };
};
