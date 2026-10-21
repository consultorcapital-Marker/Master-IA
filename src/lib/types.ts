export type MessageRole = "user" | "assistant";

export type ChatMode = "chat" | "images" | "research" | "agente" | "videos";

export interface Source {
  url: string;
  name: string;
  host_name: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  /** Texto de estado mostrado mientras se procesa (p. ej. "Buscando en la web…") */
  status?: string;
  sources?: Source[];
  /** Video generado (modo Videos) */
  video?: { url: string; prompt?: string };
  /** Foto adjunta del usuario para animar (modo Videos, data URL) */
  image?: string;
}

export interface Plugins {
  thinking: boolean;
  webSearch: boolean;
}

/* ====== Documentos adjuntos para análisis ======
 * El texto extraído del documento viaja dentro del contenido del mensaje,
 * tras un marcador visible. Así el historial del LLM lo incluye sin cambiar
 * el esquema de la base de datos, y la burbuja del usuario muestra solo la
 * pregunta + una etiqueta con el nombre del archivo.
 */
export const DOC_MARKER = "─── Documento:";

export interface DocBlock {
  question: string;
  docName: string | null;
  docText: string | null;
}

/** Separa la pregunta del bloque de documento en el contenido de un mensaje. */
export function parseDocBlock(content: string): DocBlock {
  const idx = content.indexOf(`\n\n${DOC_MARKER} `);
  if (idx < 0) return { question: content, docName: null, docText: null };
  const question = content.slice(0, idx);
  const rest = content.slice(idx + 2 + DOC_MARKER.length + 1); // tras "─── Documento: "
  const endLine = rest.indexOf(" ───\n");
  if (endLine < 0) return { question: content, docName: null, docText: null };
  const docName = rest.slice(0, endLine).trim();
  const docText = rest.slice(endLine + " ───\n".length);
  return { question, docName, docText };
}

/** Compone el contenido completo (pregunta + documento) para enviar al LLM. */
export function composeDocContent(
  question: string,
  docName: string,
  docText: string
): string {
  return `${question}\n\n${DOC_MARKER} ${docName} ───\n${docText}`;
}

export interface ConversationSummary {
  id: string;
  title: string;
  mode: string;
  updatedAt: string;
}
