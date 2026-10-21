"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { ArrowUp, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  isStreaming: boolean;
  placeholder?: string;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming,
  placeholder = "Escribe tu mensaje aquí…",
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Ajuste automático de la altura del textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!isStreaming && value.trim()) onSend();
    }
  };

  return (
    <div className="rounded-3xl border bg-card shadow-sm p-2.5">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={placeholder}
          aria-label="Escribe tu mensaje"
          className="max-h-[200px] min-h-[24px] w-full resize-none bg-transparent px-2.5 py-1.5 text-[0.95rem] leading-relaxed outline-none placeholder:text-muted-foreground thin-scroll"
        />
        {isStreaming ? (
          <Button
            type="button"
            size="icon"
            onClick={onStop}
            className="h-9 w-9 shrink-0 rounded-full bg-foreground text-background hover:bg-foreground/85"
            aria-label="Detener respuesta"
          >
            <Square className="h-4 w-4 fill-current" />
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            onClick={onSend}
            disabled={!value.trim()}
            className="h-9 w-9 shrink-0 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
            aria-label="Enviar mensaje"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
