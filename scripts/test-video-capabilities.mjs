/* Pruebas de capacidades del SDK de video para Master IA
 * Modos:
 *   local           - prueba ffmpeg concat (sin API)
 *   portrait        - video vertical 1080x1920, duration 10, with_audio true
 *   image           - imagen -> video (data URL base64)
 *   imageportrait   - imagen -> video vertical
 * Uso: bun scripts/test-video-capabilities.mjs <modo>
 */
import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const STORAGE = "/home/z/my-project/.storage";
fs.mkdirSync(STORAGE, { recursive: true });
fs.mkdirSync(path.join(STORAGE, "videos"), { recursive: true });

const mode = process.argv[2] ?? "local";

function probe(file) {
  const out = execSync(
    `ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate -show_entries format=duration -of json "${file}"`
  ).toString();
  return JSON.parse(out);
}

function download(url, file) {
  execSync(`curl -sL --max-time 120 -o "${file}" "${url}"`);
  return fs.statSync(file).size;
}

/* Poll hasta que la tarea termine (max ~9 min) */
async function waitForTask(zai, taskId) {
  for (let i = 1; i <= 54; i++) {
    await new Promise((r) => setTimeout(r, 10000));
    try {
      const res = await zai.async.result.query(taskId);
      console.log(`[${new Date().toISOString()}] poll ${i}: ${res.task_status}`);
      if (res.task_status === "SUCCESS") return res;
      if (res.task_status === "FAIL") {
        console.log("FAIL DETALLE:", JSON.stringify(res).slice(0, 500));
        return res;
      }
    } catch (e) {
      console.log(`poll ${i} error:`, e.message?.slice(0, 150));
    }
  }
  return null;
}

if (mode === "local") {
  console.log("=== PRUEBA FFMPEG CONCAT (local) ===");
  const a = path.join(STORAGE, "test-a.mp4");
  const b = path.join(STORAGE, "test-b.mp4");
  const out = path.join(STORAGE, "test-concat.mp4");
  execSync(
    `ffmpeg -y -v error -f lavfi -i testsrc=duration=2:size=640x360:rate=30 -pix_fmt yuv420p "${a}"`
  );
  execSync(
    `ffmpeg -y -v error -f lavfi -i smptebars=duration=2:size=640x360:rate=30 -pix_fmt yuv420p "${b}"`
  );
  const list = path.join(STORAGE, "list.txt");
  fs.writeFileSync(list, `file '${a}'\nfile '${b}'\n`);
  execSync(
    `ffmpeg -y -v error -f concat -safe 0 -i "${list}" -c copy "${out}"`
  );
  const info = probe(out);
  const dur = info.format?.duration;
  console.log(
    `concat OK: ${info.streams?.length} streams, duración ${dur}s (esperado ~4s)`
  );
  if (parseFloat(dur) < 3.5) {
    console.log("ERROR: la duración no cuadra");
    process.exit(1);
  }
  console.log("FFMPEG CONCAT: OK");
  process.exit(0);
}

const zai = await ZAI.create();

if (mode === "portrait") {
  console.log("=== PRUEBA: vertical 1080x1920 + duration 10 + with_audio ===");
  try {
    const task = await zai.video.generations.create({
      prompt:
        "Toma aérea con dron sobrevolando montañas nevadas al amanecer, luz dorada, nubes suaves, estilo cinematográfico",
      quality: "speed",
      with_audio: false,
      size: "1080x1920",
      fps: 30,
      duration: 10,
    });
    console.log("TAREA CREADA:", task.id, task.task_status);
    const res = await waitForTask(zai, task.id);
    if (res?.task_status === "SUCCESS") {
      const url =
        res.video_result?.[0]?.url || res.video_url || res.url || res.video;
      console.log("URL:", url);
      const file = path.join(STORAGE, "test-portrait.mp4");
      const size = download(url, file);
      console.log(`descargado: ${(size / 1024 / 1024).toFixed(2)} MB`);
      console.log("PROBE:", JSON.stringify(probe(file), null, 1));
    } else {
      console.log("RESULTADO:", JSON.stringify(res)?.slice(0, 400));
    }
  } catch (e) {
    console.log("ERROR CREACIÓN:", e.message?.slice(0, 500));
  }
}

if (mode === "image" || mode === "imageportrait") {
  const portrait = mode === "imageportrait";
  console.log(
    `=== PRUEBA: imagen -> video ${portrait ? "vertical 1080x1920" : "horizontal"} ===`
  );
  try {
    // 1) Generar imagen fuente
    const img = await zai.images.generations.create({
      prompt: portrait
        ? "Retrato fotográfico de una joven con chullo andino peruano de colores, sonrisa cálida, fondo de montañas, luz natural"
        : "Paisaje fotográfico de Machu Picchu al amanecer con neblina, luz dorada",
      size: portrait ? "768x1344" : "1344x768",
    });
    const b64 = img?.data?.[0]?.base64;
    if (!b64) throw new Error("sin imagen");
    const srcFile = path.join(STORAGE, portrait ? "test-src-vert.png" : "test-src.png");
    fs.writeFileSync(srcFile, Buffer.from(b64, "base64"));
    console.log(
      `imagen fuente: ${(fs.statSync(srcFile).size / 1024).toFixed(0)} KB`
    );

    // 2) Video desde imagen (data URL)
    const dataUrl = `data:image/png;base64,${b64}`;
    const task = await zai.video.generations.create({
      prompt: portrait
        ? "Anima el retrato: ella sonríe y gira suavemente la cabeza, el cabello se mueve con la brisa, parpadeo natural, movimiento de cámara lento"
        : "Anima la foto: la neblina se desplaza entre las ruinas, las nubes se mueven lentamente, movimiento de cámara suave hacia adelante, estilo cinematográfico",
      image_url: dataUrl,
      quality: "speed",
      with_audio: false,
      fps: 30,
      ...(portrait ? { size: "1080x1920", duration: 5 } : {}),
    });
    console.log("TAREA CREADA:", task.id, task.task_status);
    const res = await waitForTask(zai, task.id);
    if (res?.task_status === "SUCCESS") {
      const url =
        res.video_result?.[0]?.url || res.video_url || res.url || res.video;
      console.log("URL:", url);
      const file = path.join(STORAGE, portrait ? "test-iv-vert.mp4" : "test-iv.mp4");
      const size = download(url, file);
      console.log(`descargado: ${(size / 1024 / 1024).toFixed(2)} MB`);
      console.log("PROBE:", JSON.stringify(probe(file), null, 1));
    } else {
      console.log("RESULTADO:", JSON.stringify(res)?.slice(0, 400));
    }
  } catch (e) {
    console.log("ERROR:", e.message?.slice(0, 600));
  }
}
