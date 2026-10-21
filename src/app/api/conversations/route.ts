import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const conversations = await db.conversation.findMany({
      orderBy: { updatedAt: "desc" },
      include: { messages: { orderBy: { createdAt: "asc" }, take: 1 } },
    });
    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("Error listing conversations:", error);
    return NextResponse.json(
      { error: "Error al obtener las conversaciones" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const conversation = await db.conversation.create({
      data: { title: "Nueva conversación" },
    });
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    console.error("Error creating conversation:", error);
    return NextResponse.json(
      { error: "Error al crear la conversación" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    // Los mensajes se eliminan en cascada con cada conversación
    await db.conversation.deleteMany({});
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting all conversations:", error);
    return NextResponse.json(
      { error: "Error al eliminar las conversaciones" },
      { status: 500 }
    );
  }
}
