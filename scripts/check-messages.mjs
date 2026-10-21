/* Consulta los últimos mensajes para verificar persistencia (Task 17) */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const take = Number(process.argv[2] ?? 4);
const msgs = await prisma.message.findMany({
  orderBy: { createdAt: "desc" },
  take,
});
const convs = await prisma.conversation.findMany({
  orderBy: { updatedAt: "desc" },
  take: 3,
  select: { id: true, title: true, mode: true },
});
console.log("== Conversaciones recientes ==");
for (const c of convs) console.log(`- [${c.mode}] ${c.title}`);
console.log("== Últimos mensajes ==");
for (const m of msgs) {
  const c =
    m.content.length > 150
      ? m.content.slice(0, 150) + `… (${m.content.length} chars)`
      : m.content;
  console.log(`- ${m.role}: ${c.replace(/\n/g, " | ")}`);
}
await prisma.$disconnect();
