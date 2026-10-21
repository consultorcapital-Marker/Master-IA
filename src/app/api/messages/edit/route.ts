import { NextRequest, NextResponse } from "next/server";
import { db, ensureDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/messages/edit
 * Edita un mensaje del usuario y trunca la conversacion desde ese punto
 * (estilo ChatGPT: se vuelve a generar la respuesta).
 * Body: { conversationId, originalContent, content }
 * Localiza el mensaje por contenido original (los ids del cliente pueden ser
 * temporales) y elimina todo lo posterior. Devuelve found=true/false para que
 * el cliente decida si reenvia con skipUserMessage.
 */
export async function POST(req: NextRequest) {
  try {
    await ensureDb();
    const body = await req.json().catch(() => null);
    const conversationId: string = body?.conversationId ?? "";
    const originalContent: string = body?.originalContent ?? "";
    const content: string = typeof body?.content === "string" ? body.content.trim() : "";

    if (!conversationId || !originalContent || !content) {
      return NextResponse.json(
        { error: "Faltan conversationId, originalContent o content." },
        { status: 400 }
      );
    }

    const matches = await db.message.findMany({
      where: { conversationId, role: "user", content: originalContent },
      orderBy: { createdAt: "desc" },
      take: 1,
    });

    if (matches.length === 0) {
      /* El mensaje no existe en la base (p. ej. fallo previo de red):
         el cliente lo creara de nuevo en el flujo normal. */
      return NextResponse.json({ found: false });
    }

    const target = matches[0];

    await db.message.update({
      where: { id: target.id },
      data: { content },
    });
    /* Se eliminan todos los mensajes posteriores (user y assistant) */
    await db.message.deleteMany({
      where: { conversationId, createdAt: { gt: target.createdAt } },
    });
    await db.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ found: true });
  } catch {
    return NextResponse.json(
      { error: "No se pudo editar el mensaje." },
      { status: 500 }
    );
  }
}
