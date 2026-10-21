import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 300;

/* Marcadores persistidos en el contenido del mensaje:
 * - Video listo:   [MASTER_VIDEO:{url}|{promptEncoded}|{taskId}]
 * - Video en curso:[MASTER_TASK:{taskId}|{promptEncoded}]
 * - Foto adjunta:  [MASTER_PHOTO:{dataUrl}] al inicio del mensaje del usuario
 * El cliente los convierte en reproductor de video, reanuda la tarea o muestra
 * la miniatura de la foto animada. */

function generateTitle(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 44) return clean || "Nuevo video";
  return clean.slice(0, 44).trimEnd() + "…";
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function upsertAssistantMessage(
  conversationId: string,
  taskId: string,
  content: string
) {
  const existing = await db.message.findFirst({
    where: { conversationId, role: "assistant", content: { contains: taskId } },
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

/* ====== POST: iniciar la generación de un video ====== */
export async function POST(req: NextRequest) {
  let promptFallback = "";
  try {
    const body = await req.json();
    const prompt: string =
      typeof body?.prompt === "string" ? body.prompt.trim().slice(0, 800) : "";
    let conversationId: string | null =
      typeof body?.conversationId === "string" && body.conversationId
        ? body.conversationId
        : null;
    const quality: "speed" | "quality" =
      body?.quality === "quality" ? "quality" : "speed";
    // Foto para animar (imagen -> video): data URL JPEG/PNG ya reducida en el cliente
    const image: string =
      typeof body?.image === "string" && body.image.startsWith("data:image/")
        ? body.image
        : "";
    // Formato: YouTube 16:9 (1920x1080) o TikTok 9:16 vertical (1080x1920)
    const format: "landscape" | "portrait" =
      body?.format === "portrait" ? "portrait" : "landscape";
    // Duración del clip: 5 o 10 segundos
    const duration: number = body?.duration === 10 ? 10 : 5;

    if (!prompt && !image) {
      return NextResponse.json(
        { error: "Describe el video que quieres crear." },
        { status: 400 }
      );
    }
    if (!prompt && image) {
      promptFallback = "Anima esta imagen con movimiento suave y cinematográfico";
    }

    // La tarea se crea ANTES de persistir: si el servicio falla (p. ej. límite
    // de peticiones), no quedan mensajes huérfanos en la base de datos
    const zai = await ZAI.create();
    const finalPrompt = prompt || promptFallback;
    // Con foto adjunta la API deriva la resolución de la imagen (probado);
    // en texto->video se usa el formato elegido (YouTube 16:9 o TikTok 9:16)
    const task = await zai.video.generations.create({
      ...(image
        ? { image_url: image }
        : { size: format === "portrait" ? "1080x1920" : "1920x1080" }),
      prompt: finalPrompt,
      quality,
      with_audio: false,
      fps: 30,
      duration,
    });
    if (!task?.id) {
      throw new Error("El servicio de video no devolvió una tarea");
    }

    // Crear conversación al vuelo si es necesario (igual que /api/chat)
    if (!conversationId) {
      const created = await db.conversation.create({
        data: {
          title:
            "Video: " +
            generateTitle(prompt || (image ? "Foto animada" : "Nuevo video")),
          mode: "videos",
        },
      });
      conversationId = created.id;
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

    // Guardar mensaje del usuario (con la foto adjunta si la hay) y título
    await db.message.create({
      data: {
        role: "user",
        content: image ? `[MASTER_PHOTO:${image}]${finalPrompt}` : finalPrompt,
        conversationId,
      },
    });
    const count = await db.message.count({ where: { conversationId } });
    if (count === 1) {
      await db.conversation.update({
        where: { id: conversationId },
        data: {
          title:
            "Video: " +
            generateTitle(prompt || (image ? "Foto animada" : "Nuevo video")),
          mode: "videos",
        },
      });
    }

    return NextResponse.json({
      taskId: task.id,
      conversationId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/429|too many/i.test(msg)) {
      console.error("Estudio de video ocupado (429)");
      return NextResponse.json(
        {
          error:
            "El estudio de video está ocupado en este momento. Espera un par de minutos e inténtalo de nuevo.",
        },
        { status: 429 }
      );
    }
    console.error("Error creando tarea de video:", e);
    return NextResponse.json(
      {
        error:
          "No se pudo iniciar la creación del video. Inténtalo de nuevo en unos segundos.",
      },
      { status: 500 }
    );
  }
}

/* ====== GET: consultar el estado de la tarea ====== */
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const taskId = params.get("taskId");
    const conversationId = params.get("conversationId");
    const prompt = safeDecode(params.get("prompt") ?? "");
    const persistPending = params.get("persist") === "1";

    if (!taskId) {
      return NextResponse.json(
        { error: "Falta el identificador de la tarea" },
        { status: 400 }
      );
    }

    const zai = await ZAI.create();
    const result = await zai.async.result.query(taskId);

    if (result.task_status === "SUCCESS") {
      const videoUrl =
        result.video_result?.[0]?.url ||
        result.video_url ||
        result.url ||
        result.video;
      if (!videoUrl || typeof videoUrl !== "string") {
        if (conversationId) {
          await upsertAssistantMessage(
            conversationId,
            taskId,
            "⚠️ El video terminó sin resultado. Inténtalo de nuevo."
          );
        }
        return NextResponse.json({ status: "fail" });
      }
      if (conversationId) {
        await upsertAssistantMessage(
          conversationId,
          taskId,
          `🎬 **¡Tu video está listo!**\n\n[MASTER_VIDEO:${videoUrl}|${encodeURIComponent(
            prompt
          )}|${taskId}]`
        );
      }
      return NextResponse.json({ status: "success", videoUrl });
    }

    if (result.task_status === "FAIL") {
      if (conversationId) {
        await upsertAssistantMessage(
          conversationId,
          taskId,
          "⚠️ No pude generar el video con esa descripción. Prueba a reformularla (evita contenido sensible) e inténtalo de nuevo."
        );
      }
      return NextResponse.json({ status: "fail" });
    }

    // Todavía procesando: guardar marcador de reanudación si se solicita
    if (persistPending && conversationId) {
      await upsertAssistantMessage(
        conversationId,
        taskId,
        `⏳ **Tu video sigue generándose.**\n\n[MASTER_TASK:${taskId}|${encodeURIComponent(
          prompt
        )}]`
      );
    }
    return NextResponse.json({ status: "processing" });
  } catch (e) {
    console.error("Error consultando tarea de video:", e);
    return NextResponse.json({ status: "processing" }, { status: 200 });
  }
}
