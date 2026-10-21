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

/*
 * Auto-bootstrap del esquema (serverless): en Vercel la lambda puede no incluir
 * el archivo db/custom.db (empaquetado variable), por lo que /tmp/custom.db se
 * crea vacio. Estas sentencias DDL idempotentes (IF NOT EXISTS) garantizan que
 * las tablas existan siempre, sin depender del bundling.
 */
const DDL = [
  `CREATE TABLE IF NOT EXISTS "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT 'Nueva conversación',
    "mode" TEXT NOT NULL DEFAULT 'chat',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "Message_conversationId_idx" ON "Message"("conversationId")`,
]

let schemaPromise: Promise<void> | null = null

export function ensureDb(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      for (const sql of DDL) {
        await db.$executeRawUnsafe(sql)
      }
    })().catch((e) => {
      /* Permite reintentar en la siguiente peticion si el bootstrap fallo */
      schemaPromise = null
      throw e
    })
  }
  return schemaPromise
}
