import { NextResponse } from "next/server";
import fs from "fs";
import { createZai } from "@/lib/zai";

export const dynamic = "force-dynamic";

/**
 * GET /api/debug-zai — diagnostico temporal del SDK en serverless.
 * Eliminar tras el fix.
 */
export async function GET() {
  const info: Record<string, unknown> = {
    tmpConfigExists: fs.existsSync("/tmp/.z-ai-config"),
    tmpConfigSize: (() => {
      try {
        return fs.statSync("/tmp/.z-ai-config").size;
      } catch {
        return null;
      }
    })(),
    envZaiConfigB64: !!process.env.ZAI_CONFIG_B64,
  };

  try {
    const zai = await createZai();
    info.createZai = "ok";
    const r = (await zai.chat.completions.create({
      messages: [{ role: "user", content: "Responde solo: PING" }],
    })) as { choices?: Array<{ message?: { content?: string } }> };
    info.chatOk = true;
    info.chatReply =
      r?.choices?.[0]?.message?.content?.slice(0, 100) ?? JSON.stringify(r).slice(0, 200);
  } catch (e) {
    info.createZai = info.createZai ?? "ok";
    info.chatOk = false;
    info.chatError =
      e instanceof Error ? `${e.name}: ${e.message.slice(0, 400)}` : String(e).slice(0, 400);
  }

  return NextResponse.json(info);
}
