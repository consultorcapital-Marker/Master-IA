"use client";

import { useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { Markdown } from "./markdown";
import { VideoCard } from "./video-card";
import type { ChatMessage } from "@/lib/types";

export function MessageItem({
  message,
  streaming,
}: {
  message: ChatMessage;
  streaming: boolean;
}) {
  const [copied, setCopied] = useState(false);
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

  if (isUser) {
    return (
      <div className="flex justify-end" aria-label="Mensaje del usuario">
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
              {message.content}
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
              <button
                type="button"
                onClick={handleCopy}
                className="mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
                aria-label="Copiar respuesta"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? "¡Copiado!" : "Copiar"}</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
