import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

let prismaInstance: PrismaClient | null = null;

try {
  if (process.env.DATABASE_URL) {
    if (process.env.NODE_ENV === 'production') {
      prismaInstance = new PrismaClient();
    } else {
      if (!global.prismaGlobal) {
        global.prismaGlobal = new PrismaClient();
      }
      prismaInstance = global.prismaGlobal;
    }
  }
} catch (err) {
  console.warn('Prisma client initialization notice:', err);
}

export const prisma = prismaInstance;
