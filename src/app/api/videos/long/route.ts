import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

export const runtime = "nodejs";
export const maxDuration = 300;

const execFileAsync = promisify(execFile);

/* ====== Videos largos (estilo Imagine): guion multi-escena + unión con ffmpeg ======
 * Flujo:
 *  1. POST: el LLM convierte la idea en N escenas (guion), se crea el pipeline en
 *     disco y se lanza la escena 1. El mensaje del asistente guarda el marcador
 *     [MASTER_PIPELINE:{id}|{ideaEncoded}] para reanudar aunque el usuario cierre.
 *  2. GET: avanza la máquina de estados (crea tareas de escenas respetando el
 *     límite de peticiones, consulta resultados, descarga clips y los une con
 *     ffmpeg en un único MP4 servido por /api/videos/file/{id}.mp4).
 * El estado vive en .storage/pipelines/{id}.json: sobrevive a recargas y reinicios.
 */

const STORAGE =
  process.env.MASTER_STORAGE_DIR || path.join(process.cwd(), ".storage");
const PIPELINES_DIR = path.join(STORAGE, "pipelines");
const VIDEOS_DIR = path.join(STORAGE, "videos");
const MIN_CREATE_GAP_MS = 125_000; // separación entre creaciones de tareas (límite de peticiones)
const MAX_SCENE_ATTEMPTS = 2;

interface PipelineScene {
  prompt: string;
  taskId?: string;
  url?: string;
  status: "pending" | "processing" | "ready" | "failed";
  attempts?: number;
}

interface Pipeline {
  id: string;
  conversationId: string;
  idea: string;
  format: "landscape" | "portrait";
  quality: "speed" | "quality";
  clipDuration: number;
  stage: "generating" | "stitching" | "done" | "failed";
  scenes: PipelineScene[];
  finalFile?: string;
  error?: string;
  createdAt: number;
  lastCreateAt: number;
}

/* Bloqueo en proceso para que varias pestañas no avancen el mismo pipeline a la vez */
const locks = new Set<string>();

function ensureDirs() {
  fs.mkdirSync(PIPELINES_DIR, { recursive: true });
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}

function pipelinePath(id: string): string {
  return path.join(PIPELINES_DIR, `${id}.json`);
}

function loadPipeline(id: string): Pipeline | null {
  try {
    return JSON.parse(fs.readFileSync(pipelinePath(id), "utf8")) as Pipeline;
  } catch {
    return null;
  }
}

function savePipeline(p: Pipeline) {
  fs.writeFileSync(pipelinePath(p.id), JSON.stringify(p, null, 1));
}

function generateTitle(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 44) return clean || "Video largo";
  return clean.slice(0, 44).trimEnd() + "…";
}

async function upsertAssistantMessage(
  conversationId: string,
  pipelineId: string,
  content: string
) {
  const existing = await db.message.findFirst({
    where: {
      conversationId,
      role: "assistant",
      content: { contains: pipelineId },
    },
    orderBy: { createdAt: "asc" },
  });
  if (existing) {
    await db.message.update({
      where: { id: existing.id },
      data: { content },
    });
  } else {
    await db.message.create({
      data: { role: "assistant", content, conversationId },
    });
  }
  await db.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
}

/* ====== Guion: el LLM divide la idea en escenas ====== */
async function buildStoryboard(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  idea: string,
  scenes: number,
  format: "landscape" | "portrait",
  clipDuration: number
): Promise<string[]> {
  const platform =
    format === "portrait"
      ? "TikTok (video vertical 9:16)"
      : "YouTube (video horizontal 16:9)";
  const system = `Eres el director de un estudio de video con IA integrado en Master IA. Convierte la idea del usuario en un guion de ${scenes} escenas que, unidas en orden, forman UN solo video continuo de ~${scenes * clipDuration} segundos pensado para ${platform}.

Reglas para cada escena:
- Describe el clip en 1 o 2 frases muy visuales: sujeto, acción, movimiento de cámara, luz y estilo.
- Las escenas son consecutivas y coherentes entre sí: mismo estilo y paleta de color, con progresión natural (inicio, desarrollo y cierre).
- Movimientos de cámara fluidos para que la unión entre escenas se sienta continua.
- Sin textos en pantalla, sin diálogos y sin marcas registradas.
Responde SOLO con JSON válido: {"scenes": ["escena 1", "escena 2"]} con exactamente ${scenes} escenas.`;

  try {
    const res = await zai.chat.completions.create({
      messages: [
        { role: "assistant" as const, content: system },
        { role: "user" as const, content: idea },
      ],
      thinking: { type: "disabled" },
    });
    const raw = res.choices[0]?.message?.content ?? "";
    const jsonStr = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed?.scenes)) {
      const list = parsed.scenes
        .filter((s: unknown) => typeof s === "string" && (s as string).trim())
        .map((s: string) => s.trim().slice(0, 500));
      if (list.length >= 2) return list.slice(0, scenes);
    }
  } catch (e) {
    console.error("Error creando el guion:", e);
  }
  // Respaldo: variaciones de la idea original
  const variants = [
    idea,
    `${idea}, plano de detalle con movimiento de cámara lento`,
    `${idea}, ángulo amplio de cierre con la luz cambiando`,
  ];
  return variants.slice(0, scenes);
}

/* ====== Crear la tarea de una escena (con respaldo a 5 s) ====== */
async function createSceneTask(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  scenePrompt: string,
  format: "landscape" | "portrait",
  quality: "speed" | "quality",
  clipDuration: number
) {
  const size = format === "portrait" ? "1080x1920" : "1920x1080";
  try {
    return await zai.video.generations.create({
      prompt: scenePrompt,
      quality,
      with_audio: false,
      size,
      fps: 30,
      duration: clipDuration,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/429|too many/i.test(msg)) throw e; // límite de peticiones: se reintenta luego
    // Otro error (p. ej. duración no soportada): reintento con 5 s
    return await zai.video.generations.create({
      prompt: scenePrompt,
      quality,
      with_audio: false,
      size,
      fps: 30,
      duration: 5,
    });
  }
}

/* ====== Descargar y unir las escenas con ffmpeg ====== */
async function downloadTo(url: string, file: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar un clip (${res.status})`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

async function stitchScenes(p: Pipeline): Promise<string> {
  const sceneFiles: string[] = [];
  for (let i = 0; i < p.scenes.length; i++) {
    const f = path.join(VIDEOS_DIR, `${p.id}-scene${i}.mp4`);
    await downloadTo(p.scenes[i].url as string, f);
    sceneFiles.push(f);
  }
  const listFile = path.join(VIDEOS_DIR, `${p.id}-list.txt`);
  fs.writeFileSync(
    listFile,
    sceneFiles.map((f) => `file '${f}'`).join("\n") + "\n"
  );
  const outFile = path.join(VIDEOS_DIR, `${p.id}.mp4`);
  try {
    await execFileAsync("ffmpeg", [
      "-y", "-v", "error", "-f", "concat", "-safe", "0",
      "-i", listFile, "-c", "copy", outFile,
    ]);
  } catch {
    // Respaldo: recodificar si los clips no son concatenables directamente
    await execFileAsync("ffmpeg", [
      "-y", "-v", "error", "-f", "concat", "-safe", "0",
      "-i", listFile, "-c:v", "libx264", "-preset", "veryfast",
      "-crf", "20", "-pix_fmt", "yuv420p", outFile,
    ]);
  }
  for (const f of [...sceneFiles, listFile]) {
    try { fs.unlinkSync(f); } catch { /* ya no existe */ }
  }
  return path.basename(outFile);
}

function progress(p: Pipeline) {
  return NextResponse.json({
    status:
      p.stage === "done" ? "done" : p.stage === "failed" ? "failed" : "processing",
    stage: p.stage,
    total: p.scenes.length,
    ready: p.scenes.filter((s) => s.status === "ready").length,
    clipDuration: p.clipDuration,
    format: p.format,
    sceneStatus: p.scenes.map((s) => s.status),
    finalUrl: p.finalFile ? `/api/videos/file/${p.finalFile}` : undefined,
    error: p.error,
  });
}

/* ====== POST: crear el guion y arrancar el pipeline ====== */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const idea: string =
      typeof body?.idea === "string" ? body.idea.trim().slice(0, 800) : "";
    let conversationId: string | null =
      typeof body?.conversationId === "string" && body.conversationId
        ? body.conversationId
        : null;
    const quality: "speed" | "quality" =
      body?.quality === "quality" ? "quality" : "speed";
    const format: "landscape" | "portrait" =
      body?.format === "portrait" ? "portrait" : "landscape";
    const scenes = Math.min(4, Math.max(2, Number(body?.scenes) || 3));
    const clipDuration = Number(body?.clipDuration) === 10 ? 10 : 5;

    if (!idea) {
      return NextResponse.json(
        { error: "Describe el video largo que quieres crear." },
        { status: 400 }
      );
    }

    ensureDirs();
    const zai = await ZAI.create();
    const scenePrompts = await buildStoryboard(
      zai, idea, scenes, format, clipDuration
    );

    const id = `pl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const pipeline: Pipeline = {
      id,
      conversationId: conversationId ?? "",
      idea,
      format,
      quality,
      clipDuration,
      stage: "generating",
      scenes: scenePrompts.map((prompt) => ({
        prompt,
        status: "pending" as const,
      })),
      createdAt: Date.now(),
      lastCreateAt: 0,
    };

    // Crear la primera tarea ya (si el servicio lo permite; si no, el GET la creará)
    try {
      pipeline.lastCreateAt = Date.now();
      const task = await createSceneTask(
        zai, scenePrompts[0], format, quality, clipDuration
      );
      pipeline.scenes[0].taskId = task.id;
      pipeline.scenes[0].status = "processing";
    } catch (e) {
      console.error("Primera tarea pendiente (se creará en el sondeo):", e);
    }

    // El pipeline se guarda en disco antes de tocar la base de datos
    savePipeline(pipeline);
    if (!conversationId) {
      const created = await db.conversation.create({
        data: {
          title: "Video largo: " + generateTitle(idea),
          mode: "videos",
        },
      });
      conversationId = created.id;
      pipeline.conversationId = conversationId;
      savePipeline(pipeline);
    } else {
      const existing = await db.conversation.findUnique({
        where: { id: conversationId },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Conversación no encontrada" },
          { status: 404 }
        );
      }
    }

    await db.message.create({
      data: { role: "user", content: idea, conversationId },
    });
    const count = await db.message.count({ where: { conversationId } });
    if (count === 1) {
      await db.conversation.update({
        where: { id: conversationId },
        data: {
          title: "Video largo: " + generateTitle(idea),
          mode: "videos",
        },
      });
    }
    await upsertAssistantMessage(
      conversationId,
      id,
      `🎞️ **Tu video largo está en marcha:** ${pipeline.scenes.length} escenas · ~${pipeline.scenes.length * pipeline.clipDuration} segundos\n\n[MASTER_PIPELINE:${id}|${encodeURIComponent(idea)}]`
    );

    return NextResponse.json({
      pipelineId: id,
      conversationId,
      scenes: pipeline.scenes.length,
      clipDuration: pipeline.clipDuration,
    });
  } catch (e) {
    console.error("Error iniciando video largo:", e);
    return NextResponse.json(
      {
        error:
          "No se pudo iniciar el video largo. Inténtalo de nuevo en unos segundos.",
      },
      { status: 500 }
    );
  }
}

/* ====== GET: avanzar y consultar el estado del pipeline ====== */
export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "Falta el identificador del video largo" },
        { status: 400 }
      );
    }
    const p = loadPipeline(id);
    if (!p) {
      return NextResponse.json(
        { error: "Video largo no encontrado" },
        { status: 404 }
      );
    }
    if (p.stage === "done" || p.stage === "failed") return progress(p);
    if (locks.has(id)) return progress(p); // otra llamada lo está avanzando
    locks.add(id);

    try {
      const zai = await ZAI.create();

      if (p.stage === "generating") {
        // 1) Crear la siguiente tarea pendiente respetando el intervalo mínimo
        const now = Date.now();
        if (now - p.lastCreateAt >= MIN_CREATE_GAP_MS) {
          const idx = p.scenes.findIndex(
            (s) => !s.taskId && s.status !== "failed"
          );
          if (idx >= 0) {
            p.lastCreateAt = now;
            try {
              const task = await createSceneTask(
                zai, p.scenes[idx].prompt, p.format, p.quality, p.clipDuration
              );
              p.scenes[idx].taskId = task.id;
              p.scenes[idx].status = "processing";
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              if (!/429|too many/i.test(msg)) {
                p.scenes[idx].attempts = (p.scenes[idx].attempts ?? 0) + 1;
                if ((p.scenes[idx].attempts ?? 0) >= MAX_SCENE_ATTEMPTS) {
                  p.scenes[idx].status = "failed";
                  p.error = "Una de las escenas no pudo generarse.";
                }
              }
            }
            savePipeline(p);
          }
        }

        // 2) Consultar las tareas activas
        for (const scene of p.scenes) {
          if (!scene.taskId || scene.url) continue;
          try {
            const r = await zai.async.result.query(scene.taskId);
            if (r.task_status === "SUCCESS") {
              const url =
                r.video_result?.[0]?.url || r.video_url || r.url || r.video;
              if (typeof url === "string" && url) {
                scene.url = url;
                scene.status = "ready";
              }
            } else if (r.task_status === "FAIL") {
              scene.attempts = (scene.attempts ?? 0) + 1;
              if ((scene.attempts ?? 0) >= MAX_SCENE_ATTEMPTS) {
                scene.status = "failed";
                p.error = "Una de las escenas no pudo generarse.";
              } else {
                scene.taskId = undefined; // reintentar la creación
                scene.status = "pending";
              }
            }
          } catch {
            /* error puntual de consulta: se reintenta en el siguiente sondeo */
          }
        }
        savePipeline(p);

        if (p.scenes.every((s) => s.status === "ready")) {
          p.stage = "stitching";
          savePipeline(p);
        }
      }

      if (p.stage === "stitching") {
        try {
          p.finalFile = await stitchScenes(p);
          p.stage = "done";
          p.error = undefined;
          savePipeline(p);
          await upsertAssistantMessage(
            p.conversationId,
            p.id,
            `🎬 **¡Tu video largo está listo!** ${p.scenes.length} escenas unidas en un solo video.\n\n[MASTER_VIDEO:/api/videos/file/${p.finalFile}|${encodeURIComponent(p.idea)}|${p.id}]`
          );
        } catch (e) {
          console.error("Error uniendo escenas:", e);
          p.stage = "failed";
          p.error = "No se pudieron unir las escenas del video.";
          savePipeline(p);
        }
      }
    } finally {
      locks.delete(id);
    }

    return progress(p);
  } catch (e) {
    console.error("Error avanzando el video largo:", e);
    return NextResponse.json({ status: "processing" }, { status: 200 });
  }
}
