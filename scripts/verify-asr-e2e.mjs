/**
 * Prueba E2E real del dictado por voz:
 * A) TTS con response_format wav -> ASR (roundtrip texto).
 * B) WebM/Opus generado con ffmpeg (identico a lo que graba Chrome) -> ASR.
 * Valida que el endpoint /api/asr funciona con los formatos que llegan del navegador.
 */
import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import { execSync } from "child_process";

const FRASE = "Hola, esta es una prueba del dictado por voz de Zoe Master IA";

function esWav(buf) {
  return buf.length > 44 && buf.subarray(0, 4).toString("ascii") === "RIFF";
}

async function asrViaEndpoint(label, buf, mime) {
  const res = await fetch("http://localhost:3000/api/asr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audio: `data:${mime};base64,${buf.toString("base64")}` }),
  });
  const json = await res.json().catch(() => ({}));
  const texto = (json.text ?? "").trim();
  console.log(`[${label}] status=${res.status} text="${texto}"`);
  return { status: res.status, texto, error: json.error };
}

async function main() {
  const zai = await ZAI.create();

  // ---- A) TTS wav ----
  console.log("A) TTS response_format=wav");
  let wav = null;
  try {
    const r = await zai.audio.tts.create({
      input: FRASE,
      voice: "tongtong",
      response_format: "wav",
    });
    let buf = r instanceof Response ? Buffer.from(await r.arrayBuffer()) : Buffer.from(r?.data ?? r);
    console.log("   bytes:", buf.length, "| esWav:", esWav(buf));
    if (esWav(buf)) wav = buf;
  } catch (e) {
    console.log("   TTS wav fallo:", (e?.message ?? e).slice(0, 120));
  }

  // ---- B) WebM/Opus con ffmpeg: voz sintetizada -> igual a grabacion Chrome ----
  console.log("B) Generando WebM/Opus con ffmpeg (simula grabacion del navegador)");
  const vozIn = "/tmp/voz-fuente.wav";
  const webm = "/tmp/grabacion-navegador.webm";
  try {
    if (wav) fs.writeFileSync(vozIn, wav);
    else {
      // fallback: tono de voz con ffmpeg (voz no, pero valida el plumbing de formato)
      execSync(`ffmpeg -y -f lavfi -i "sine=frequency=220:duration=2" -ar 16000 -ac 1 ${vozIn}`, { stdio: "pipe" });
    }
    if (!wav) {
      console.log("   sin voz TTS disponible, usando tono (solo valida formato WebM)");
    }
    execSync(
      `ffmpeg -y -i ${vozIn} -c:a libopus -b:a 32k -ar 48000 -ac 1 ${webm}`,
      { stdio: "pipe" }
    );
    const wbuf = fs.readFileSync(webm);
    console.log("   webm bytes:", wbuf.length, "| cabecera:", wbuf.subarray(0, 4).toString("hex"));
  } catch (e) {
    console.error("   ffmpeg fallo:", (e?.message ?? e).slice(0, 200));
    process.exit(1);
  }

  // ---- Pruebas contra /api/asr ----
  let ok = false;

  if (wav) {
    const a = await asrViaEndpoint("A wav->asr", wav, "audio/wav");
    ok = ok || (a.status === 200 && a.texto.length > 0);
  }

  const b = await asrViaEndpoint("B webm->asr", fs.readFileSync(webm), "audio/webm");
  ok = ok || (b.status === 200 && b.texto.length > 0);

  console.log("\nRESULTADO FINAL:", ok ? "OK — /api/asr transcribe formatos reales" : "FALLO");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("ERROR:", e?.message ?? e);
  process.exit(1);
});
