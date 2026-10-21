import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/debug-db — diagnostico temporal del estado de la base de datos
 * en el entorno serverless. Eliminar tras el fix.
 */
export async function GET() {
  const info: Record<string, unknown> = {
    cwd: process.cwd(),
    vercel: process.env.VERCEL ?? null,
    databaseUrl: process.env.DATABASE_URL ?? null,
    nodeEnv: process.env.NODE_ENV ?? null,
  };

  try {
    info.cwdFiles = fs.readdirSync(process.cwd()).slice(0, 30);
    const dbDir = path.join(process.cwd(), "db");
    info.dbDirExists = fs.existsSync(dbDir);
    if (info.dbDirExists) info.dbDirFiles = fs.readdirSync(dbDir);
    info.tmpDbExists = fs.existsSync("/tmp/custom.db");
    if (info.tmpDbExists) {
      const st = fs.statSync("/tmp/custom.db");
      info.tmpDbSize = st.size;
    }
  } catch (e) {
    info.fsError = String(e);
  }

  try {
    const n = await db.conversation.count();
    info.conversationCount = n;
    info.dbQuery = "ok";
  } catch (e) {
    info.dbQuery = "error";
    info.dbError = e instanceof Error ? e.message.slice(0, 500) : String(e);
  }

  return NextResponse.json(info);
}
