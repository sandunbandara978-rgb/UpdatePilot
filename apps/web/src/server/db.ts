import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

let prismaInstance: PrismaClient | null = null;

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl) {
  try {
    if (process.env.NODE_ENV === 'production') {
      prismaInstance = new PrismaClient({
        log: ['error', 'warn'],
      });
    } else {
      if (!global.prismaGlobal) {
        global.prismaGlobal = new PrismaClient({
          log: ['query', 'error', 'warn'],
        });
      }
      prismaInstance = global.prismaGlobal;
    }
  } catch (err) {
    console.error('CRITICAL: Prisma client failed to initialize with DATABASE_URL:', err);
    throw err;
  }
} else if (process.env.NODE_ENV === 'production' && process.env.VERCEL) {
  console.error(
    'CRITICAL CONFIGURATION ERROR: DATABASE_URL is required on Vercel production deployment for multi-tenant PostgreSQL persistence. Without DATABASE_URL, data cannot persist across serverless invocations.'
  );
}

export const prisma = prismaInstance;
