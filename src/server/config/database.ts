import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

import { fileURLToPath } from 'url';

let currentDir = '';
try {
  if (typeof __dirname !== 'undefined') {
    currentDir = __dirname;
  } else if (import.meta && import.meta.url) {
    currentDir = path.dirname(fileURLToPath(import.meta.url));
  }
} catch {
  // fallback if neither is available
}

// Handle Vercel serverless read-only filesystem for SQLite
if (process.env.VERCEL && (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:'))) {
  const tmpDbPath = '/tmp/dev.db';
  if (!fs.existsSync(tmpDbPath)) {
    const candidatePaths = [
      path.join(process.cwd(), 'prisma', 'dev.db'),
      path.join(process.cwd(), 'dev.db'),
      path.resolve(process.cwd(), 'prisma', 'dev.db'),
      currentDir ? path.join(currentDir, '..', '..', '..', 'prisma', 'dev.db') : '',
      currentDir ? path.join(currentDir, '..', '..', 'prisma', 'dev.db') : '',
      currentDir ? path.join(currentDir, '..', 'prisma', 'dev.db') : '',
      currentDir ? path.join(currentDir, 'prisma', 'dev.db') : '',
    ].filter(Boolean);
    for (const src of candidatePaths) {
      if (fs.existsSync(src)) {
        try {
          fs.copyFileSync(src, tmpDbPath);
          break;
        } catch (e) {
          console.warn('Could not copy dev.db to /tmp:', e);
        }
      }
    }
  }
  process.env.DATABASE_URL = `file:${tmpDbPath}`;
} else if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./dev.db';
}

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma =
  globalThis.prismaGlobal ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}

export default prisma;
