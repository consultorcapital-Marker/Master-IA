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

export interface ConversationSummary {
  id: string;
  title: string;
  mode: string;
  updatedAt: string;
}
