import ZAI from "z-ai-web-dev-sdk";

async function main() {
  const zai = await ZAI.create();

  const completion = await zai.chat.completions.create({
    messages: [
      { role: "assistant", content: "Eres un asistente útil." },
      { role: "user", content: "Di hola en una línea" },
    ],
    stream: true,
    thinking: { type: "disabled" },
  });

  let raw = "";
  for await (const chunk of completion) {
    raw += new TextDecoder().decode(chunk as unknown as Uint8Array);
  }
  console.log("RAW (primeros 800 chars):");
  console.log(raw.substring(0, 800));
  console.log("...");
  console.log("RAW (últimos 300 chars):");
  console.log(raw.substring(raw.length - 300));
}

main().catch((e) => {
  console.error("FAILED:", e?.message || e);
  process.exit(1);
});
