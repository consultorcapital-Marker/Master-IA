import { PrismaClient } from '@prisma/client'
import fs from "fs"
import path from "path"

/*
 * Vercel (serverless): el filesystem es de solo lectura salvo /tmp.
 * Se copia la base SQLite al arranque de cada instancia y se apunta
 * DATABASE_URL a esa copia escribible (persistencia efímera por instancia).
 */
if (process.env.VERCEL === "1") {
  const srcDb = path.join(process.cwd(), "db", "custom.db")
  const tmpDb = "/tmp/custom.db"
  if (fs.existsSync(srcDb) && !fs.existsSync(tmpDb)) {
    try {
      fs.copyFileSync(srcDb, tmpDb)
    } catch {
      /* sin base local: se usará DATABASE_URL del entorno */
    }
  }
  process.env.DATABASE_URL = "file:/tmp/custom.db"
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
