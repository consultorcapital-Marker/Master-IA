import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";

/**
 * Wrapper del SDK para entornos serverless (Vercel).
 *
 * El SDK solo lee sus credenciales de disco (.z-ai-config en cwd, HOME o /etc),
 * y en las lambdas de Vercel el filesystem es de solo lectura y el archivo no
 * viaja en el bundle. Solucion:
 *  1. El contenido del .z-ai-config se guarda cifrado como variable de entorno
 *     ZAI_CONFIG_B64 (base64) en Vercel.
 *  2. En runtime se materializa en /tmp/.z-ai-config (escritura permitida).
 *  3. El patch scripts/patch-zai-sdk.js (build) anade /tmp/.z-ai-config a las
 *     rutas que revisa el SDK.
 * En desarrollo local ZAI.create() sigue encontrando ./.z-ai-config como siempre.
 */
export type ZAIInstance = Awaited<ReturnType<typeof ZAI.create>>;

let ready = false;

function materializeConfig(): void {
  if (ready) return;
  const b64 = process.env.ZAI_CONFIG_B64;
  if (b64 && !fs.existsSync("/tmp/.z-ai-config")) {
    try {
      fs.mkdirSync("/tmp", { recursive: true });
      fs.writeFileSync("/tmp/.z-ai-config", Buffer.from(b64, "base64"), {
        mode: 0o600,
      });
    } catch {
      /* si falla, ZAI.create() usara las rutas estandar */
    }
  }
  ready = true;
}

export async function createZai(): Promise<ZAIInstance> {
  materializeConfig();
  return ZAI.create();
}
