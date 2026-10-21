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

  let count = 0;
  for await (const chunk of completion) {
    count++;
    if (count <= 3) {
      console.log(`--- chunk ${count} ---`);
      console.log(JSON.stringify(chunk, null, 2).substring(0, 600));
    }
  }
  console.log("total chunks:", count);
}

main().catch((e) => {
  console.error("FAILED:", e?.message || e);
  process.exit(1);
});
