import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const conversation = await db.conversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversación no encontrada" },
        { status: 404 }
      );
    }
    return NextResponse.json({ conversation });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    return NextResponse.json(
      { error: "Error al obtener la conversación" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const title: string | undefined =
      typeof body?.title === "string" ? body.title.trim() : undefined;
    if (!title) {
      return NextResponse.json(
        { error: "El título es obligatorio" },
        { status: 400 }
      );
    }
    const conversation = await db.conversation.update({
      where: { id },
      data: { title: title.slice(0, 120) },
    });
    return NextResponse.json({ conversation });
  } catch (error) {
    console.error("Error updating conversation:", error);
    return NextResponse.json(
      { error: "Error al actualizar la conversación" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    await db.conversation.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    return NextResponse.json(
      { error: "Error al eliminar la conversación" },
      { status: 500 }
    );
  }
}
