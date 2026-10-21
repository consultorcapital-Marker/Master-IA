/**
 * Verificación de ida y vuelta del dictado por voz:
 * 1. Genera un WAV con voz real usando el SDK (TTS).
 * 2. Envía el audio a /api/asr (mismo endpoint que usa el botón de micrófono).
 * 3. Compara el texto transcrito con el original.
 */
import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";

const FRASE = "Hola, esta es una prueba del dictado por voz de Zoe Master IA";

async function main() {
  console.log("[1] Generando audio TTS con la frase:", FRASE);
  const zai = await ZAI.create();
  const tts = await zai.audio.tts.create({
    input: FRASE,
    voice: "tongtong",
  });
  // El SDK devuelve un fetch Response con el audio binario
  let buf;
  if (tts instanceof Response) buf = Buffer.from(await tts.arrayBuffer());
  else if (tts instanceof Blob) buf = Buffer.from(await tts.arrayBuffer());
  else if (tts instanceof ArrayBuffer) buf = Buffer.from(tts);
  else if (tts?.arrayBuffer) buf = Buffer.from(await tts.arrayBuffer());
  else if (tts?.data) buf = Buffer.from(tts.data);
  else buf = Buffer.from(tts);
  console.log("[1] Audio generado:", buf.length, "bytes");

  const tmp = "/tmp/prueba-dictado.wav";
  fs.writeFileSync(tmp, buf);
  console.log("[1] Guardado en", tmp);

  console.log("[2] Enviando a /api/asr (endpoint del botón de micrófono)...");
  const res = await fetch("http://localhost:3000/api/asr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audio: `data:audio/wav;base64,${buf.toString("base64")}`,
    }),
  });
  const json = await res.json();
  console.log("[2] Status:", res.status, "| Respuesta:", JSON.stringify(json));

  const texto = (json.text ?? "").trim().toLowerCase();
  const esperado = FRASE.toLowerCase();
  const coincide =
    texto.length > 0 &&
    (texto.includes("prueba") || texto.includes("dictado") || texto.includes("voz"));

  console.log("[3] RESULTADO:", coincide ? "OK — transcripcion coherente" : "REVISAR — texto no coincide");
  console.log("    Original :", FRASE);
  console.log("    Transcrito:", json.text ?? "(vacio)");
  process.exit(coincide ? 0 : 1);
}

main().catch((e) => {
  console.error("ERROR:", e?.message ?? e);
  process.exit(1);
});
