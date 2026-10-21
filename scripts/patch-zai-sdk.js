/**
 * Patch idempotente al SDK z-ai-web-dev-sdk:
 * anade "/tmp/.z-ai-config" a las rutas de configuracion que revisa loadConfig().
 * Necesario en Vercel serverless: /var/task es de solo lectura y el archivo
 * .z-ai-config no viaja en el bundle; en runtime se materializa en /tmp desde
 * la variable de entorno cifrada ZAI_CONFIG_B64 (ver src/lib/zai.ts).
 * Ejecutar en el build ANTES de next build (vercel.json buildCommand).
 */
const fs = require("fs");
const path = require("path");

const sdkDist = path.join(process.cwd(), "node_modules", "z-ai-web-dev-sdk", "dist", "index.js");

try {
  if (!fs.existsSync(sdkDist)) {
    console.error("patch-zai-sdk: SDK no encontrado en", sdkDist, "- se omite el patch");
    process.exit(0);
  }

  let src = fs.readFileSync(sdkDist, "utf8");

  if (src.includes('"/tmp/.z-ai-config"') || src.includes("'/tmp/.z-ai-config'")) {
    console.log("patch-zai-sdk: ya aplicado, nada que hacer");
    process.exit(0);
  }

  const anchor = "'/etc/.z-ai-config'";
  if (!src.includes(anchor)) {
    console.error("patch-zai-sdk: ancla no encontrada (SDK cambio de formato) - se omite");
    process.exit(0);
  }

  src = src.replace(anchor, anchor + ", '/tmp/.z-ai-config'");
  fs.writeFileSync(sdkDist, src);
  console.log("patch-zai-sdk: OK - '/tmp/.z-ai-config' anadido a configPaths");
} catch (e) {
  console.error("patch-zai-sdk error:", e?.message ?? e);
  /* No romper el build si el patch falla */
  process.exit(0);
}
