import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

/* Sirve los videos largos generados (.storage/videos/{id}.mp4) con soporte de
 * peticiones Range para que el reproductor pueda adelantar y retroceder. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ file: string }> }
) {
  const { file } = await ctx.params;
  // Solo nombres seguros: evita cualquier recorrido de directorios
  if (!/^[a-zA-Z0-9_-]+\.mp4$/.test(file)) {
    return NextResponse.json({ error: "Archivo no válido" }, { status: 400 });
  }
  const filePath = path.join(process.cwd(), ".storage", "videos", file);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Video no encontrado" }, { status: 404 });
  }
  const size = fs.statSync(filePath).size;
  const data = fs.readFileSync(filePath);
  const range = req.headers.get("range");
  const baseHeaders: Record<string, string> = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600",
  };

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m?.[1] ? parseInt(m[1], 10) : 0;
    let end = m?.[2] ? parseInt(m[2], 10) : size - 1;
    if (Number.isNaN(start) || start >= size) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }
    end = Math.min(end, size - 1);
    const chunk = new Uint8Array(data.subarray(start, end + 1));
    return new NextResponse(chunk, {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }

  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: { ...baseHeaders, "Content-Length": String(size) },
  });
}
