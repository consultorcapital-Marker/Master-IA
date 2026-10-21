import { NextRequest, NextResponse } from "next/server";
import { createZai } from "@/lib/zai";

export const maxDuration = 60;

/**
 * POST /api/asr
 * Recibe audio grabado en el navegador (base64, WAV/WEBM/MP4) y devuelve
 * la transcripcion de voz a texto usando el SDK (audio.asr).
 * Body: { audio: string } — base64 puro o data URL completa.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const raw: unknown = body?.audio;
    if (typeof raw !== "string" || raw.length === 0) {
      return NextResponse.json(
        { error: "Falta el audio a transcribir." },
        { status: 400 }
      );
    }

    /* Acepta data URL completa ("data:audio/webm;base64,XXX") o base64 puro */
    const base64 = raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;

    /* Limite aproximado de 20 MB de audio (base64 ~27 MB de texto) */
    if (base64.length > 27_000_000) {
      return NextResponse.json(
        { error: "El audio es demasiado largo (maximo ~2 minutos)." },
        { status: 413 }
      );
    }

    const zai = await createZai();
    const response = await zai.audio.asr.create({ file_base64: base64 });
    const text = (response?.text ?? "").trim();

    return NextResponse.json({ text });
  } catch {
    return NextResponse.json(
      { error: "No se pudo transcribir el audio. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
