import { NextRequest, NextResponse } from "next/server";
import ZAI, { SearchFunctionResultItem } from "z-ai-web-dev-sdk";

export const maxDuration = 120;

const SYSTEM_PROMPT =
  'Eres el "Asistente Master AI", el agente inteligente oficial integrado en Zoe Master IA, ' +
  "una aplicación web de chat con IA 100% gratuita.\n\n" +
  "Tu trabajo: ayudar al usuario a aprovechar Zoe Master IA, resolver dudas y ejecutar tareas " +
  "de forma breve, amable y competente.\n\n" +
  "Tus capacidades como agente (la interfaz cambia de modo; responde según el modo activo):\n" +
  "- Chat: conversación natural con contexto multi-turno.\n" +
  "- Búsqueda web: puedes recibir resultados reales de la web y responder con información " +
  "actual citando las fuentes con el formato [n].\n" +
  "- Creación de imágenes: puedes generar imágenes a partir de una descripción (el backend " +
  "se encarga; no debes incluir la imagen en tu texto).\n" +
  "- Razonamiento: puedes resolver problemas paso a paso con lógica cuidadosa.\n\n" +
  "Funciones de Zoe Master IA que puedes explicar:\n" +
  '- Modos (menú lateral): "Nuevo chat" (conversación con respuestas en streaming), ' +
  '"Imágenes" (genera imágenes a partir de una descripción) e "Investigación avanzada" ' +
  "(busca en la web, lee fuentes reales y redacta un informe con citas).\n" +
  '- Complementos: interruptores "Razonamiento" (thinking paso a paso) y "Búsqueda web" ' +
  "(respuestas con fuentes actuales). Se guardan automáticamente.\n" +
  '- Recompensas GCR (menú "Recompensas · GCR y QFS"): la app es 100% gratis, sin licencias ' +
  "ni suscripciones. Ahí se conecta una billetera de Ethereum (ej. MetaMask) en modo solo " +
  "lectura. Por cada 5 horas de uso acumuladas en la app se acreditan 1.000 QFS (red " +
  "Ethereum) y 0.001 GCRM " +
  "a la billetera conectada. Contratos ERC-20 en Ethereum mainnet: GCR Master (GCRM) " +
  "0x2Ae2d0DFdB1B3b03A771167c43b983A97b65B9B3 y QFS (QFSpay) " +
  "0x7C670A7EBa354E0d22F0ecBBE7A36BF10dCE305E. Desde el diálogo se ve el saldo on-chain de " +
  'cada token y se pueden añadir a MetaMask con el botón "Añadir".\n' +
  "- Historial: las conversaciones se guardan solas; se renombran o eliminan desde el menú " +
  "de cada chat; en Configuración se borra todo y se cambia el tema (claro/oscuro/sistema).\n\n" +
  "Reglas:\n" +
  "- Responde SIEMPRE en español, con tono cercano y profesional.\n" +
  "- No menciones proveedores de IA ni marcas de terceros: si preguntan con qué tecnología funcionas o quién te creó, di que eres el Asistente Master AI de Zoe Master IA.\n" +
  "- Sé breve: máximo unas 120 palabras; usa viñetas o pasos numerados cuando ayude.\n" +
  "- Si preguntan por temas generales (no de la app), respóndelos de igual forma: útil y conciso.\n" +
  "- Si algo no existe en Zoe Master IA, dilo con honestidad y sugiere la alternativa más cercana.";

const SEARCH_PROMPT =
  "\n\nMODO BÚSQUEDA WEB ACTIVO: abajo tienes resultados reales de la web para la " +
  "petición del usuario. Responde con información actual y cita las fuentes usadas con " +
  "el formato [n]. Si los resultados no bastan para responder, dilo con honestidad y " +
  "resume lo que sí se sabe.";

const MAX_HISTORY = 8;
const MAX_CHARS = 2000;
const VALID_MODES = ["chat", "search", "image", "thinking"] as const;
type AgentMode = (typeof VALID_MODES)[number];

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

interface SourceItem {
  name: string;
  url: string;
}

function sanitizeHistory(raw: unknown): HistoryMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: HistoryMessage[] = [];
  for (const item of raw) {
    const role = item?.role;
    const content =
      typeof item?.content === "string" ? item.content.trim() : "";
    if ((role === "user" || role === "assistant") && content) {
      out.push({ role, content: content.slice(0, MAX_CHARS) });
    }
  }
  return out.slice(-MAX_HISTORY);
}

export async function POST(req: NextRequest) {
  let mode: AgentMode = "chat";
  try {
    const body = await req.json();
    const message: string =
      typeof body?.message === "string"
        ? body.message.trim().slice(0, MAX_CHARS)
        : "";

    if (!message) {
      return NextResponse.json(
        { error: "Escribe una pregunta para el Asistente Master AI." },
        { status: 400 }
      );
    }

    const resolved: AgentMode = VALID_MODES.includes(body?.mode)
      ? body.mode
      : "chat";
    mode = resolved;
    const history = sanitizeHistory(body?.history);

    const zai = await ZAI.create();

    /* ========== MODO IMAGEN ========== */
    if (mode === "image") {
      const result = await zai.images.generations.create({
        prompt: message,
        size: "1024x1024",
      });
      const base64 = result?.data?.[0]?.base64;
      if (!base64) {
        throw new Error(
          "El generador no devolvió ninguna imagen (posible bloqueo de contenido)"
        );
      }
      const altText = message.replace(/[[\]()"]/g, "").slice(0, 80);
      const reply = `![${altText}](data:image/png;base64,${base64})`;
      return NextResponse.json({ reply });
    }

    /* ========== BÚSQUEDA WEB (obtener fuentes reales) ========== */
    let sources: SourceItem[] = [];
    let systemContent = SYSTEM_PROMPT;

    if (mode === "search") {
      try {
        const results: SearchFunctionResultItem[] = await zai.functions.invoke(
          "web_search",
          { query: message, num: 6 }
        );
        sources = (results ?? [])
          .slice(0, 6)
          .map((s) => ({ name: s.name || s.url, url: s.url }))
          .filter((s) => Boolean(s.url));

        if (sources.length > 0) {
          const searchContext = (results ?? [])
            .slice(0, 6)
            .map(
              (s, i) =>
                `[${i + 1}] ${s.name}\nURL: ${s.url}\nResumen: ${s.snippet}`
            )
            .join("\n\n");
          systemContent = `${SYSTEM_PROMPT}${SEARCH_PROMPT}\n\nResultados de búsqueda web:\n\n${searchContext}`;
        }
      } catch (e) {
        console.error("Error en búsqueda web del asistente:", e);
        // Sin fuentes: responder con conocimiento general y avisar
        systemContent = `${SYSTEM_PROMPT}\n\nAVISO: la búsqueda web no está disponible ahora. Si la pregunta requiere información muy reciente, indícalo y responde con tu conocimiento general.`;
      }
    }

    /* ========== CHAT / SEARCH / THINKING ========== */
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant" as const, content: systemContent },
        ...history,
        { role: "user" as const, content: message },
      ],
      thinking: { type: mode === "thinking" ? "enabled" : "disabled" },
    });

    const reply = completion.choices[0]?.message?.content?.trim();
    if (!reply) {
      throw new Error("Respuesta vacía del modelo");
    }

    return NextResponse.json({ reply, sources });
  } catch (err) {
    console.error("Error en /api/assistant:", err);
    return NextResponse.json(
      {
        error:
          mode === "image"
            ? "No pude crear la imagen en este momento. Prueba con otra descripción."
            : "El Asistente Master AI no está disponible en este momento. Inténtalo de nuevo en unos segundos.",
      },
      { status: 500 }
    );
  }
}
