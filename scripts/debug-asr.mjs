/** Prueba directa del SDK ASR (sin pasar por /api/asr) para ver el error real. */
import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";

const archivo = process.argv[2] ?? "/tmp/prueba-dictado.wav";

async function main() {
  const buf = fs.readFileSync(archivo);
  console.log("Archivo:", archivo, "-", buf.length, "bytes");
  const head = buf.subarray(0, 12).toString("hex");
  console.log("Cabecera:", head);

  const zai = await ZAI.create();
  try {
    const r = await zai.audio.asr.create({ file_base64: buf.toString("base64") });
    console.log("ASR OK:", JSON.stringify(r).slice(0, 500));
  } catch (e) {
    console.error("ASR con base64 FALLA:", e?.message ?? e);
  }
  try {
    const r2 = await zai.audio.asr.create({ file: archivo });
    console.log("ASR con file path OK:", JSON.stringify(r2).slice(0, 500));
  } catch (e) {
    console.error("ASR con file FALLA:", e?.message ?? e);
  }
}

main().catch((e) => {
  console.error("ERROR:", e?.message ?? e);
  process.exit(1);
});
