import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";

export const maxDuration = 60;

export const runtime = "nodejs";

/*
 * POST /api/documents/extract
 * Extrae el texto de documentos para analisis por la IA.
 * Soporta en el servidor: DOCX, TXT, MD, CSV, JSON, XML y texto plano.
 * Los PDF se extraen en el navegador con pdfjs-dist (ver extractDocumentText
 * en src/app/page.tsx): su renderizador binario falla bajo bundlers.
 * Body: { name: string, dataBase64: string } (base64 puro o data URL)
 */
const MAX_B64 = 14_000_000; /* ~10 MB de archivo */
const MAX_TEXT = 12_000; /* caracteres enviados al LLM */

const TEXT_EXT = new Set([
  "txt", "md", "csv", "json", "xml", "html", "htm", "log", "yml", "yaml", "tsv",
]);

function looksLikeText(buf: Buffer): boolean {
  const sample = buf.subarray(0, Math.min(1000, buf.length));
  for (const b of sample) {
    if (b === 0) return false; /* NUL = binario */
  }
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const name: string = typeof body?.name === "string" ? body.name : "documento";
    const raw: string = typeof body?.dataBase64 === "string" ? body.dataBase64 : "";

    if (!raw) {
      return NextResponse.json(
        { error: "Falta el archivo a extraer." },
        { status: 400 }
      );
    }
    const base64 = raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;
    if (base64.length > MAX_B64) {
      return NextResponse.json(
        { error: "El archivo supera el límite de 10 MB." },
        { status: 413 }
      );
    }

    const buf = Buffer.from(base64, "base64");
    if (buf.length === 0) {
      return NextResponse.json({ error: "El archivo está vacío." }, { status: 400 });
    }

    const ext = (name.split(".").pop() ?? "").toLowerCase();
    let text = "";

    if (ext === "docx") {
      const result = await mammoth.extractRawText({ buffer: buf });
      text = result.value ?? "";
    } else if (ext === "pdf") {
      return NextResponse.json(
        { error: "Los PDF se procesan directamente en tu navegador." },
        { status: 415 }
      );
    } else if (TEXT_EXT.has(ext) || looksLikeText(buf)) {
      text = buf.toString("utf8");
    } else {
      return NextResponse.json(
        {
          error:
            "Formato no soportado. Usa PDF, DOCX, TXT, MD, CSV, JSON o XML.",
        },
        { status: 415 }
      );
    }

    /* Limpieza: normaliza saltos y lineas en blanco excesivas */
    text = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

    if (!text) {
      return NextResponse.json(
        { error: "No se pudo extraer texto del documento (¿está vacío?)." },
        { status: 422 }
      );
    }

    let truncated = false;
    if (text.length > MAX_TEXT) {
      text = `${text.slice(0, MAX_TEXT)}\n[...documento truncado...]`;
      truncated = true;
    }

    return NextResponse.json({ name, chars: text.length, truncated, text });
  } catch (e) {
    console.error("extract error:", e);
    return NextResponse.json(
      { error: "No se pudo extraer el texto del documento." },
      { status: 500 }
    );
  }
}
