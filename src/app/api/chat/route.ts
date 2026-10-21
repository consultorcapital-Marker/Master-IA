import { NextRequest, NextResponse } from "next/server";
import ZAI, { SearchFunctionResultItem } from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";

export const maxDuration = 300;

const SYSTEM_PROMPT =
  "Eres un asistente de IA útil, preciso y amigable, similar a ChatGPT. " +
  "Responde siempre en el idioma en el que te escriba el usuario. " +
  "Estructura tus respuestas con formato Markdown cuando sea apropiado " +
  "(listas, encabezados, bloques de código con el lenguaje indicado). " +
  "Sé claro, directo y aporta ejemplos cuando aporten valor.";

const RESEARCH_PROMPT =
  "Eres un agente de investigación avanzada. Te entregaré resultados de " +
  "búsqueda web (títulos, resúmenes y, cuando estén disponibles, el contenido " +
  "completo de algunas páginas). Redacta un informe profundo, bien estructurado " +
  "(con encabezados, listas y una sección de conclusiones) sobre la petición del " +
  "usuario, citando las fuentes en el texto con el formato [n]. Si los datos son " +
  "insuficientes o contradictorios, indícalo honestamente.";

const AGENTE_SYSTEM_PROMPT =
  'Eres el "Agente Master", el agente de IA más avanzado y completo del mundo, integrado en Zoe Master IA. ' +
  "Tu misión: completar la tarea del usuario de forma autónoma y exhaustiva, combinando búsqueda web, " +
  "lectura de fuentes reales, razonamiento profundo y generación de imágenes cuando sea necesario.\n\n" +
  "Reglas:\n" +
  "- Responde SIEMPRE en español (o en el idioma en el que te escriba el usuario).\n" +
  "- Estructura la respuesta con Markdown: encabezados, listas y conclusiones claras.\n" +
  "- Cita las fuentes web con el formato [n] cuando las uses.\n" +
  "- Si la información es insuficiente o contradictoria, indícalo con honestidad.\n" +
  "- Sé completo pero directo: cada sección debe aportar valor.\n" +
  "- Si generaste una imagen, préséntala brevemente (la imagen ya se muestra encima de tu respuesta).\n" +
  '- Si preguntan quién eres, di que eres el Agente Master, el motor agéntico integrado en Zoe Master IA.';

const AGENTE_PLANNER_PROMPT =
  "Eres el planificador de un agente de IA. Analiza la petición del usuario y devuelve SOLO un JSON válido " +
  "(sin texto adicional y sin bloques de código) con esta forma exacta:\n" +
  '{"search": boolean, "readPages": boolean, "image": boolean, "imagePrompt": string, "searchQuery": string}\n' +
  "- search: true si la tarea necesita información actual o datos de la web.\n" +
  "- readPages: true si conviene leer el contenido completo de las mejores fuentes (informes, análisis, noticias).\n" +
  "- image: true solo si el usuario pide de forma explícita crear o generar una imagen.\n" +
  "- imagePrompt: descripción detallada para el generador de imágenes (cadena vacía si image es false).\n" +
  "- searchQuery: consulta de búsqueda óptima de máximo 10 palabras (cadena vacía si search es false).\n" +
  'Ejemplo: {"search":true,"readPages":true,"image":false,"imagePrompt":"","searchQuery":"precio actual bitcoin análisis mercado"}';

const MAX_HISTORY = 30;
const VALID_MODES = ["chat", "images", "research", "agente"];

function generateTitle(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 48) return clean || "Nueva conversación";
  return clean.slice(0, 48).trimEnd() + "…";
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function sourcesFooter(sources: SearchFunctionResultItem[]): string {
  const list = sources
    .map((s, i) => `${i + 1}. [${s.name}](${s.url})`)
    .join("\n");
  return `\n\n---\n\n**Fuentes consultadas:**\n\n${list}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message: string =
      typeof body?.message === "string" ? body.message.trim() : "";
    let conversationId: string | null =
      typeof body?.conversationId === "string" ? body.conversationId : null;
    const mode: string = VALID_MODES.includes(body?.mode) ? body.mode : "chat";
    const thinking: boolean = body?.thinking === true;
    const webSearch: boolean = body?.webSearch === true;

    if (!message) {
      return NextResponse.json(
        { error: "El mensaje es obligatorio" },
        { status: 400 }
      );
    }

    // Crear conversación al vuelo si es necesario
    if (!conversationId) {
      const prefix =
        mode === "images" ? "Imagen: " : mode === "agente" ? "Agente: " : "";
      const created = await db.conversation.create({
        data: {
          title: prefix + generateTitle(message),
          mode,
        },
      });
      conversationId = created.id;
    } else {
      const existing = await db.conversation.findUnique({
        where: { id: conversationId },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Conversación no encontrada" },
          { status: 404 }
        );
      }
    }

    // Guardar mensaje del usuario
    await db.message.create({
      data: { role: "user", content: message, conversationId },
    });

    // Título automático en el primer intercambio
    const count = await db.message.count({ where: { conversationId } });
    if (count === 1) {
      const prefix =
        mode === "images" ? "Imagen: " : mode === "agente" ? "Agente: " : "";
      await db.conversation.update({
        where: { id: conversationId },
        data: { title: prefix + generateTitle(message), mode },
      });
    }

    const conversationIdFinal = conversationId;
    const zai = await ZAI.create();

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let full = "";
        const send = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        };
        const safeSend = (event: string, data: unknown) => {
          try {
            send(event, data);
          } catch {
            /* conexión cerrada */
          }
        };

        const saveMessage = async (content: string) => {
          if (!content.trim()) return;
          try {
            await db.message.create({
              data: {
                role: "assistant",
                content,
                conversationId: conversationIdFinal,
              },
            });
            await db.conversation.update({
              where: { id: conversationIdFinal },
              data: { updatedAt: new Date() },
            });
          } catch (e) {
            console.error("Error guardando mensaje:", e);
          }
        };

        safeSend("meta", { conversationId: conversationIdFinal });

        try {
          /* ========== MODO IMÁGENES ========== */
          if (mode === "images") {
            safeSend("status", { text: "Generando tu imagen…" });
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
            full = `![${altText}](data:image/png;base64,${base64})`;
            safeSend("delta", { text: full });
            await saveMessage(full);
            safeSend("done", { conversationId: conversationIdFinal });
            return;
          }

          /* ========== MODO AGENTE MASTER ========== */
          if (mode === "agente") {
            safeSend("status", {
              text: "El Agente Master está analizando tu petición…",
            });

            // 1) Planificación: el agente decide qué herramientas usar
            let plan = {
              search: true,
              readPages: true,
              image: false,
              imagePrompt: "",
              searchQuery: message,
            };
            try {
              const planner = await zai.chat.completions.create({
                messages: [
                  { role: "assistant" as const, content: AGENTE_PLANNER_PROMPT },
                  { role: "user" as const, content: message },
                ],
                thinking: { type: "disabled" },
              });
              const rawPlan =
                planner.choices[0]?.message?.content ?? "";
              const jsonStr = rawPlan.slice(
                rawPlan.indexOf("{"),
                rawPlan.lastIndexOf("}") + 1
              );
              const parsed = JSON.parse(jsonStr);
              plan = {
                search: parsed?.search !== false,
                readPages: parsed?.readPages !== false,
                image: parsed?.image === true,
                imagePrompt:
                  typeof parsed?.imagePrompt === "string"
                    ? parsed.imagePrompt.slice(0, 500)
                    : "",
                searchQuery:
                  typeof parsed?.searchQuery === "string" &&
                  parsed.searchQuery.trim()
                    ? parsed.searchQuery.trim().slice(0, 200)
                    : message,
              };
            } catch (e) {
              console.error("Error en planificación del agente:", e);
              // Se conserva el plan por defecto (búsqueda + lectura)
            }

            // Heurística de respaldo: si pide explícitamente una imagen
            if (
              !plan.image &&
              /(crea|genera|dibuja|haz|dise\u00f1a)[^.]*\bimagen\b/i.test(message)
            ) {
              plan.image = true;
              plan.imagePrompt = plan.imagePrompt || message;
            }

            // 2) Búsqueda web + lectura de fuentes
            const agentSources: SearchFunctionResultItem[] = [];
            let agentContext = "";

            if (plan.search) {
              safeSend("status", {
                text: "El Agente Master está buscando en la web…",
              });
              try {
                const results = await zai.functions.invoke("web_search", {
                  query: plan.searchQuery,
                  num: 8,
                });
                agentSources.push(...(results ?? []));
                agentContext = agentSources
                  .map(
                    (s, i) =>
                      `[${i + 1}] ${s.name}\nURL: ${s.url}\nResumen: ${s.snippet}`
                  )
                  .join("\n\n");

                if (plan.readPages && agentSources.length > 0) {
                  safeSend("status", {
                    text: "El Agente Master está leyendo las mejores fuentes…",
                  });
                  for (const s of agentSources.slice(0, 3)) {
                    try {
                      const page = await zai.functions.invoke("page_reader", {
                        url: s.url,
                      });
                      const text = stripHtml(page?.data?.html ?? "").slice(
                        0,
                        4500
                      );
                      if (text) {
                        agentContext += `\n\nContenido completo de ${s.url} (publicado: ${
                          page?.data?.publishedTime ?? "fecha desconocida"
                        }):\n${text}`;
                      }
                    } catch (e) {
                      console.error("Error leyendo página (agente):", e);
                    }
                  }
                }
              } catch (e) {
                console.error("Error en búsqueda web (agente):", e);
              }
            }

            // 3) Generación de imagen (si la misión lo requiere)
            let imagePrefix = "";
            if (plan.image) {
              safeSend("status", {
                text: "El Agente Master está creando la imagen…",
              });
              try {
                const imgPrompt = (plan.imagePrompt || message).replace(
                  /[[\]()"]/g,
                  ""
                );
                const result = await zai.images.generations.create({
                  prompt: imgPrompt,
                  size: "1024x1024",
                });
                const base64 = result?.data?.[0]?.base64;
                if (base64) {
                  imagePrefix = `![${imgPrompt.slice(0, 80)}](data:image/png;base64,${base64})\n\n`;
                }
              } catch (e) {
                console.error("Error generando imagen (agente):", e);
              }
            }

            // 4) Síntesis final con razonamiento profundo
            safeSend("status", {
              text: "El Agente Master está elaborando la respuesta final…",
            });

            if (imagePrefix) {
              full = imagePrefix;
              safeSend("delta", { text: imagePrefix });
            }

            const history = await db.message.findMany({
              where: { conversationId: conversationIdFinal },
              orderBy: { createdAt: "asc" },
              take: MAX_HISTORY,
            });

            const systemContent =
              AGENTE_SYSTEM_PROMPT +
              (agentContext && agentSources.length > 0
                ? `\n\nResultados de búsqueda web (cita las fuentes usando [n] cuando las uses):\n\n${agentContext}`
                : "\n\nAVISO: no hay resultados web disponibles; responde con tu conocimiento e indícalo con honestidad.");

            const chatMessages = [
              { role: "assistant" as const, content: systemContent },
              ...history.map((m) => ({
                role:
                  m.role === "assistant"
                    ? ("assistant" as const)
                    : ("user" as const),
                content: m.content,
              })),
            ];

            const completion = await zai.chat.completions.create({
              messages: chatMessages,
              stream: true,
              thinking: { type: "enabled" },
            });

            const decoder = new TextDecoder();
            let sseBuffer = "";

            const handleSseLine = (line: string) => {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) return;
              const payload = trimmed.slice(5).trim();
              if (!payload || payload === "[DONE]") return;
              try {
                const parsed = JSON.parse(payload);
                const delta = parsed?.choices?.[0]?.delta?.content;
                if (typeof delta === "string" && delta) {
                  full += delta;
                  safeSend("delta", { text: delta });
                }
              } catch {
                // Línea incompleta o no JSON: ignorar
              }
            };

            for await (const chunk of completion) {
              sseBuffer += decoder.decode(chunk as unknown as Uint8Array, {
                stream: true,
              });
              const lines = sseBuffer.split("\n");
              sseBuffer = lines.pop() ?? "";
              for (const line of lines) handleSseLine(line);
            }
            if (sseBuffer.trim()) handleSseLine(sseBuffer);

            if (agentSources.length > 0) {
              const footer = sourcesFooter(agentSources);
              full += footer;
              safeSend("delta", { text: footer });
            }

            if (!full.trim()) {
              full =
                "El Agente Master no pudo completar la misión en este momento. Inténtalo de nuevo en unos segundos.";
              safeSend("delta", { text: full });
            }

            await saveMessage(full);
            safeSend("done", { conversationId: conversationIdFinal });
            return;
          }

          /* ========== INVESTIGACIÓN AVANZADA / BÚSQUEDA WEB ========== */
          let searchContext = "";
          const sources: SearchFunctionResultItem[] = [];
          const needSearch = mode === "research" || webSearch;

          if (needSearch) {
            safeSend("status", { text: "Buscando fuentes en la web…" });
            try {
              const results = await zai.functions.invoke("web_search", {
                query: message,
                num: mode === "research" ? 8 : 5,
              });
              sources.push(...(results ?? []));
              searchContext = sources
                .map(
                  (s, i) =>
                    `[${i + 1}] ${s.name}\nURL: ${s.url}\nResumen: ${s.snippet}`
                )
                .join("\n\n");
            } catch (e) {
              console.error("Error en búsqueda web:", e);
            }

            // Investigación avanzada: leer el contenido de las mejores páginas
            if (mode === "research" && sources.length > 0) {
              safeSend("status", {
                text: "Analizando las fuentes más relevantes…",
              });
              for (const s of sources.slice(0, 3)) {
                try {
                  const page = await zai.functions.invoke("page_reader", {
                    url: s.url,
                  });
                  const text = stripHtml(page?.data?.html ?? "").slice(0, 4500);
                  if (text) {
                    searchContext += `\n\nContenido completo de ${s.url} (publicado: ${
                      page?.data?.publishedTime ?? "fecha desconocida"
                    }):\n${text}`;
                  }
                } catch (e) {
                  console.error("Error leyendo página:", e);
                }
              }
            }

            if (mode === "research" && sources.length > 0) {
              safeSend("status", {
                text: "Redactando el informe con análisis profundo…",
              });
            }
          }

          /* ========== CHAT / INFORME DE INVESTIGACIÓN ========== */
          const history = await db.message.findMany({
            where: { conversationId: conversationIdFinal },
            orderBy: { createdAt: "asc" },
            take: MAX_HISTORY,
          });

          const basePrompt =
            mode === "research" ? `${SYSTEM_PROMPT}\n\n${RESEARCH_PROMPT}` : SYSTEM_PROMPT;

          const systemContent =
            searchContext && sources.length > 0
              ? `${basePrompt}\n\nResultados de búsqueda web actualizados (cita las fuentes usando [n] cuando las uses):\n\n${searchContext}`
              : basePrompt;

          const chatMessages = [
            { role: "assistant" as const, content: systemContent },
            ...history.map((m) => ({
              role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
              content: m.content,
            })),
          ];

          const completion = await zai.chat.completions.create({
            messages: chatMessages,
            stream: true,
            thinking: {
              type: thinking || mode === "research" ? "enabled" : "disabled",
            },
          });

          // El SDK entrega el stream como bytes crudos con formato SSE
          // "data: {json}" compatible con OpenAI.
          const decoder = new TextDecoder();
          let sseBuffer = "";

          const handleSseLine = (line: string) => {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) return;
            const payload = trimmed.slice(5).trim();
            if (!payload || payload === "[DONE]") return;
            try {
              const parsed = JSON.parse(payload);
              const delta = parsed?.choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta) {
                full += delta;
                safeSend("delta", { text: delta });
              }
            } catch {
              // Línea incompleta o no JSON: ignorar
            }
          };

          for await (const chunk of completion) {
            sseBuffer += decoder.decode(chunk as unknown as Uint8Array, {
              stream: true,
            });
            const lines = sseBuffer.split("\n");
            sseBuffer = lines.pop() ?? "";
            for (const line of lines) handleSseLine(line);
          }
          if (sseBuffer.trim()) handleSseLine(sseBuffer);

          // Pie con fuentes cuando hubo búsqueda web
          if (sources.length > 0) {
            const footer = sourcesFooter(sources);
            full += footer;
            safeSend("delta", { text: footer });
          }

          if (!full.trim()) {
            full =
              mode === "research"
                ? "No he podido completar la investigación en este momento. Inténtalo de nuevo en unos segundos."
                : "Lo siento, no he podido generar una respuesta. Inténtalo de nuevo.";
            safeSend("delta", { text: full });
          }

          await saveMessage(full);
          safeSend("done", { conversationId: conversationIdFinal });
        } catch (err) {
          console.error("Streaming error:", err);
          if (!full.trim()) {
            const fallback =
              mode === "images"
                ? "⚠️ No pude generar la imagen. Prueba con otra descripción."
                : "⚠️ No pude generar la respuesta. Inténtalo de nuevo en unos segundos.";
            full = fallback;
            safeSend("delta", { text: fallback });
          }
          await saveMessage(full);
          safeSend("error", {
            message: "Error durante la generación de la respuesta",
          });
        } finally {
          try {
            controller.close();
          } catch {
            /* ya cerrado */
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
