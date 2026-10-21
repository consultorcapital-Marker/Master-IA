"use client";

import { useRef, useState } from "react";
import { Check, Copy, FileText, Loader2, Pencil } from "lucide-react";
import { Markdown } from "./markdown";
import { VideoCard } from "./video-card";
import { parseDocBlock, type ChatMessage } from "@/lib/types";

export function MessageItem({
  message,
  streaming,
  canEdit = false,
  onEditSubmit,
}: {
  message: ChatMessage;
  streaming: boolean;
  /** Editar disponible (se oculta en el modo Videos) */
  canEdit?: boolean;
  /** Envia el nuevo texto de la pregunta (sin el bloque de documento) */
  onEditSubmit?: (message: ChatMessage, newText: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const editAreaRef = useRef<HTMLTextAreaElement>(null);
  const isUser = message.role === "user";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard no disponible */
    }
  };

  const startEdit = () => {
    const { question } = parseDocBlock(message.content);
    setDraft(question);
    setEditing(true);
    requestAnimationFrame(() => {
      const el = editAreaRef.current;
      if (!el) return;
      el.style.height = "0px";
      el.style.height = Math.min(el.scrollHeight, 220) + "px";
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  };

  const submitEdit = () => {
    const text = draft.trim();
    if (!text || saving) return;
    /* Cierra el editor de inmediato (el reenvio y el truncado los hace
       el padre); la respuesta nueva llega en streaming. */
    setSaving(true);
    onEditSubmit?.(message, text);
    setEditing(false);
    setSaving(false);
  };

  if (isUser) {
    const { docName } = parseDocBlock(message.content);

    if (editing) {
      return (
        <div className="flex justify-end" aria-label="Editando mensaje">
          <div className="w-full max-w-[85%] md:max-w-[75%] rounded-3xl border-2 border-[#003366]/60 bg-card p-2.5 shadow-sm">
            <textarea
              ref={editAreaRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                e.target.style.height = "0px";
                e.target.style.height =
                  Math.min(e.target.scrollHeight, 220) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitEdit();
                } else if (e.key === "Escape") {
                  setEditing(false);
                }
              }}
              rows={1}
              aria-label="Editar tu mensaje"
              className="max-h-[220px] min-h-[24px] w-full resize-none bg-transparent px-2 py-1 text-[0.95rem] leading-relaxed outline-none thin-scroll"
            />
            <div className="mt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="cursor-pointer rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitEdit}
                disabled={!draft.trim() || saving}
                className="cursor-pointer rounded-full bg-[#003366] px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-[#004080] disabled:opacity-50"
              >
                {saving ? "Enviando…" : "Enviar"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="group flex justify-end" aria-label="Mensaje del usuario">
        <div className="max-w-[85%] md:max-w-[75%]">
          {message.image && (
            <img
              src={message.image}
              alt="Foto que se va a animar"
              className="mb-1.5 ml-auto max-h-72 rounded-3xl rounded-br-lg object-cover"
            />
          )}
          {message.content && (
            <div className="whitespace-pre-wrap break-words rounded-3xl rounded-br-lg bg-secondary text-secondary-foreground px-4 py-2.5 text-[0.95rem] leading-relaxed">
              {parseDocBlock(message.content).question}
              {docName && (
                <span className="mt-1.5 flex items-center gap-1.5 text-[0.72rem] text-muted-foreground">
                  <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="max-w-[220px] truncate">{docName}</span>
                </span>
              )}
            </div>
          )}
          {/* Acciones estilo ChatGPT: copiar y editar */}
          {!streaming && (
            <div
              className="mt-1 flex items-center justify-end gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-70"
              aria-label="Acciones del mensaje"
            >
              <button
                type="button"
                onClick={handleCopy}
                className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Copiar mensaje"
                title="Copiar"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
              {canEdit && onEditSubmit && (
                <button
                  type="button"
                  onClick={startEdit}
                  className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Editar mensaje"
                  title="Editar y reenviar"
                >
                  <Pencil size={14} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Mensaje del asistente
  const isEmpty = message.content.length === 0;

  return (
    <div className="group flex gap-3 md:gap-4" aria-label="Respuesta del asistente">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#003366] shadow-sm">
        <span className="text-xs font-bold text-white" aria-hidden="true">M</span>
      </div>
      <div className="min-w-0 flex-1 pt-1">
        {isEmpty && streaming ? (
          <div
            className="flex items-center gap-2 text-sm text-muted-foreground"
            aria-label="El asistente está trabajando"
          >
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600 dark:text-emerald-400" />
            {message.status ?? "Escribiendo…"}
          </div>
        ) : (
          <>
            {message.video?.url && (
              <div className="mb-2 max-w-xl">
                <VideoCard video={message.video} />
              </div>
            )}
            {message.content && (
              <div className="text-[0.95rem] leading-relaxed">
                <Markdown content={message.content} />
                {streaming && <span className="stream-cursor" aria-hidden="true" />}
              </div>
            )}
            {!streaming && (
              <div className="mt-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Copiar respuesta"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? "¡Copiado!" : "Copiar"}</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
