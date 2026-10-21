"use client";

import { useEffect, useRef, useState } from "react";
import {
  Brain,
  Globe,
  ImagePlus,
  Loader2,
  MessageSquare,
  Send,
  X,
  type LucideIcon,
} from "lucide-react";
import { Markdown } from "./markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AgentMode = "chat" | "search" | "image" | "thinking";

interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
  sources?: { name: string; url: string }[];
}

const MODES: {
  id: AgentMode;
  label: string;
  icon: LucideIcon;
  placeholder: string;
  loading: string;
}[] = [
  {
    id: "chat",
    label: "Chat",
    icon: MessageSquare,
    placeholder: "Pregunta al Asistente Master AI…",
    loading: "Escribiendo…",
  },
  {
    id: "search",
    label: "Web",
    icon: Globe,
    placeholder: "Busca algo actual en la web…",
    loading: "Buscando en la web…",
  },
  {
    id: "image",
    label: "Imagen",
    icon: ImagePlus,
    placeholder: "Describe la imagen que quieres crear…",
    loading: "Creando imagen… (puede tardar hasta 1 min)",
  },
  {
    id: "thinking",
    label: "Razonar",
    icon: Brain,
    placeholder: "Analiza paso a paso una función de Zoe Master IA…",
    loading: "Razonando paso a paso…",
  },
];

const SUGGESTIONS: { text: string; mode: AgentMode }[] = [
  { text: "¿Cómo funcionan las recompensas de 5 horas?", mode: "chat" },
  { text: "Busca las últimas noticias de GCRM y QFS", mode: "search" },
  { text: "Crea una imagen promocional de Zoe Master IA", mode: "image" },
  {
    text: "Si llevo 3 horas de uso, ¿cuánto falta para mis recompensas?",
    mode: "thinking",
  },
];

const WELCOME =
  "¡Hola! Soy el **Asistente Master AI**, tu agente inteligente en Zoe Master IA. Impulsa tu productividad: **información web al instante** con fuentes, **imágenes profesionales** y **análisis con razonamiento experto**. Selecciona un modo para comenzar.";

export function ZAssistant() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AgentMode>("chat");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentMode = MODES.find((m) => m.id === mode) ?? MODES[0];

  /* Scroll al fondo cuando cambian los mensajes o al abrir */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading, open]);

  /* Cerrar con Escape */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const send = async (rawText?: string, modeOverride?: AgentMode) => {
    const text = (rawText ?? input).trim();
    const activeMode: AgentMode = modeOverride ?? mode;
    if (!text || loading) return;

    const history = messages.slice(-8);
    setError(null);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: activeMode === "image" ? [] : history,
          mode: activeMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "No pude responder en este momento.");
      }
      const reply: string =
        typeof data?.reply === "string" && data.reply.trim()
          ? data.reply
          : "No recibí respuesta. Inténtalo de nuevo.";
      const sources = Array.isArray(data?.sources)
        ? (data.sources as unknown[])
            .map((s) => {
              const item = s as { name?: unknown; url?: unknown };
              return {
                name:
                  typeof item?.name === "string" && item.name.trim()
                    ? item.name.trim()
                    : typeof item?.url === "string"
                      ? item.url
                      : "",
                url: typeof item?.url === "string" ? item.url : "",
              };
            })
            .filter((s) => Boolean(s.url))
            .slice(0, 6)
        : undefined;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply, sources },
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No pude responder en este momento."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-28 right-4 z-50 flex flex-col items-end gap-3 lg:bottom-6 lg:right-6">
      {open && (
        <div
          role="dialog"
          aria-label="Asistente Master AI"
          className="flex h-[520px] max-h-[76vh] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl"
        >
          {/* Cabecera */}
          <div className="flex items-center gap-2.5 bg-[#003366] px-4 py-3 text-white">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-sm font-bold"
              aria-hidden="true"
            >
              M
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">Asistente Master AI</p>
              <p className="flex items-center gap-1.5 text-[0.7rem] text-white/80">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                  aria-hidden="true"
                />
                En línea · agente de Zoe Master IA
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-white hover:bg-white/15 hover:text-white"
              onClick={() => setOpen(false)}
              aria-label="Cerrar Asistente Master AI"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Mensajes */}
          <div
            ref={scrollRef}
            className="thin-scroll flex-1 space-y-3 overflow-y-auto px-3 py-3"
            aria-live="polite"
          >
            {messages.length === 0 && !loading && (
              <div className="space-y-2.5">
                <div className="flex gap-2">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#003366] text-[0.65rem] font-bold text-white"
                    aria-hidden="true"
                  >
                    M
                  </span>
                  <div className="min-w-0 flex-1 text-sm leading-relaxed">
                    <Markdown content={WELCOME} />
                  </div>
                </div>
                <div className="space-y-1.5 pt-1">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.text}
                      type="button"
                      onClick={() => {
                        setMode(s.mode);
                        send(s.text, s.mode);
                      }}
                      className="w-full cursor-pointer rounded-xl border px-3 py-2 text-left text-xs transition-colors hover:bg-muted"
                    >
                      {s.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end" aria-label="Tu mensaje">
                  <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-secondary px-3 py-2 text-sm text-secondary-foreground">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div
                  key={i}
                  className="flex gap-2"
                  aria-label="Respuesta del Asistente Master AI"
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#003366] text-[0.65rem] font-bold text-white"
                    aria-hidden="true"
                  >
                    M
                  </span>
                  <div className="min-w-0 flex-1 text-sm leading-relaxed">
                    <Markdown content={m.content} />
                    {m.sources && m.sources.length > 0 && (
                      <div className="mt-1.5 rounded-lg border bg-muted/40 px-2.5 py-1.5">
                        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                          Fuentes
                        </p>
                        <ul className="mt-1 space-y-0.5">
                          {m.sources.map((s, si) => (
                            <li
                              key={`${s.url}-${si}`}
                              className="truncate text-[0.7rem] leading-snug"
                            >
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                [{si + 1}] {s.name}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )
            )}

            {loading && (
              <div
                className="flex gap-2"
                aria-label="El Asistente Master AI está trabajando"
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#003366] text-[0.65rem] font-bold text-white"
                  aria-hidden="true"
                >
                  M
                </span>
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {currentMode.loading}
                </span>
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {error}
              </p>
            )}
          </div>

          {/* Selector de modos del agente */}
          <div
            className="flex flex-wrap items-center gap-1.5 px-2 pt-2"
            role="group"
            aria-label="Modo del agente"
          >
            {MODES.map((m) => {
              const Icon = m.icon;
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  aria-pressed={active}
                  className={
                    active
                      ? "flex h-7 cursor-pointer items-center gap-1 rounded-full bg-[#003366] px-2.5 text-[0.7rem] font-medium text-white transition-colors"
                      : "flex h-7 cursor-pointer items-center gap-1 rounded-full border px-2.5 text-[0.7rem] font-medium text-muted-foreground transition-colors hover:bg-muted"
                  }
                >
                  <Icon className="h-3 w-3" aria-hidden="true" />
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* Entrada */}
          <form
            className="flex items-center gap-2 p-2"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={currentMode.placeholder}
              maxLength={2000}
              className="h-9 flex-1 rounded-xl text-sm"
              aria-label={`Mensaje para el Asistente Master AI (modo ${currentMode.label})`}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || loading}
              className="h-9 w-9 shrink-0 rounded-xl bg-[#003366] text-white hover:bg-[#003366]/90"
              aria-label="Enviar al Asistente Master AI"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}

      {/* Botón flotante */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Cerrar Asistente Master AI" : "Abrir Asistente Master AI"}
        aria-expanded={open}
        className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-[#003366] text-lg font-bold text-white shadow-lg transition-transform hover:scale-105 hover:bg-[#003366]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003366] focus-visible:ring-offset-2"
      >
        {open ? <X className="h-5 w-5" aria-hidden="true" /> : "M"}
      </button>
    </div>
  );
}
