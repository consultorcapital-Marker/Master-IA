"use client";

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { ArrowUp, FileText, Loader2, Mic, Paperclip, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  isStreaming: boolean;
  placeholder?: string;
  /** Documento adjunto pendiente de enviar */
  attachment: { name: string; size: number } | null;
  onPickFile: (file: File | null) => void;
  /** Mostrar el botón de adjuntar (modos chat/investigación/agente) */
  showAttach: boolean;
  /** Formato legible del tamaño para el chip */
  formatSize?: (bytes: number) => string;
}

type VoiceState = "idle" | "recording" | "transcribing";

/* Grabacion maxima: 2 minutos (evita audios enormes) */
const MAX_RECORD_MS = 120_000;

export function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming,
  placeholder = "Escribe tu mensaje aquí…",
  attachment,
  onPickFile,
  showAttach,
  formatSize,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceSupported, setVoiceSupported] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Ajuste automático de la altura del textarea */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [value]);

  /* El dictado por voz requiere MediaRecorder + getUserMedia */
  useEffect(() => {
    setVoiceSupported(
      typeof window !== "undefined" &&
        typeof MediaRecorder !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia
    );
    /* Liberar el microfono al desmontar */
    return () => {
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const pickMimeType = (): string | undefined => {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ];
    for (const type of candidates) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return undefined;
  };

  const stopRecording = () => {
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    /* onstop se encarga de transcribir */
    mediaRecorderRef.current?.stop();
  };

  const transcribe = async (blob: Blob) => {
    setVoiceState("transcribing");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read"));
        reader.readAsDataURL(blob);
      });

      const res = await fetch("/api/asr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: dataUrl }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        text?: string;
        error?: string;
      };

      const text = (json.text ?? "").trim();
      if (!res.ok || !text) {
        toast({
          title: "Dictado por voz",
          description:
            json.error ?? "No se escuchó nada. Acércate al micrófono e intenta de nuevo.",
        });
        return;
      }

      /* Añade la transcripcion a lo ya escrito (estilo ChatGPT) */
      onChange(value ? `${value.trimEnd()} ${text}` : text);
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch {
      toast({
        title: "Dictado por voz",
        description: "No se pudo transcribir el audio. Revisa tu conexión e intenta de nuevo.",
      });
    } finally {
      setVoiceState("idle");
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        /* Libera el microfono cuanto antes */
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        if (blob.size > 0) void transcribe(blob);
        else setVoiceState("idle");
      };

      recorder.start();
      setVoiceState("recording");

      /* Corte automatico por seguridad */
      maxTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") stopRecording();
      }, MAX_RECORD_MS);
    } catch {
      setVoiceState("idle");
      toast({
        title: "Micrófono bloqueado",
        description:
          "Permite el acceso al micrófono en tu navegador para dictar por voz.",
      });
    }
  };

  const toggleVoice = () => {
    if (voiceState === "recording") {
      stopRecording();
      setVoiceState("transcribing");
    } else if (voiceState === "idle") {
      void startRecording();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!isStreaming && (value.trim() || attachment)) onSend();
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    onPickFile(e.target.files?.[0] ?? null);
    e.target.value = "";
  };

  const canSend = Boolean(value.trim() || attachment);

  return (
    <div className="rounded-3xl border bg-card shadow-sm p-2.5">
      {attachment && (
        <div
          className="mb-2 flex items-center gap-2 rounded-2xl border bg-muted/50 px-3 py-2"
          aria-label="Documento adjunto"
        >
          <FileText className="h-4 w-4 shrink-0 text-[#003366]" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-[0.8rem] font-medium">
            {attachment.name}
          </span>
          {formatSize && (
            <span className="shrink-0 text-[0.7rem] text-muted-foreground">
              {formatSize(attachment.size)}
            </span>
          )}
          <button
            type="button"
            onClick={() => onPickFile(null)}
            className="cursor-pointer rounded-full p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            aria-label="Quitar documento"
            title="Quitar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={
            voiceState === "recording"
              ? "Escuchando… habla ahora y pulsa el micrófono para terminar"
              : placeholder
          }
          aria-label="Escribe tu mensaje"
          className="max-h-[200px] min-h-[24px] w-full resize-none bg-transparent px-2.5 py-1.5 text-[0.95rem] leading-relaxed outline-none placeholder:text-muted-foreground thin-scroll"
        />
        {showAttach && (
          <Button
            type="button"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming}
            title="Adjuntar documento para análisis"
            className="h-9 w-9 shrink-0 rounded-full bg-muted text-foreground hover:bg-muted/70 disabled:opacity-60"
            aria-label="Adjuntar documento"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
        )}
        {voiceSupported && (
          <Button
            type="button"
            size="icon"
            onClick={toggleVoice}
            disabled={voiceState === "transcribing"}
            title={
              voiceState === "recording"
                ? "Detener y transcribir"
                : "Dictar por voz"
            }
            className={`h-9 w-9 shrink-0 rounded-full disabled:opacity-60 ${
              voiceState === "recording"
                ? "animate-pulse bg-red-600 text-white hover:bg-red-700"
                : "bg-muted text-foreground hover:bg-muted/70"
            }`}
            aria-label={
              voiceState === "recording"
                ? "Detener grabación de voz"
                : "Dictar por voz"
            }
          >
            {voiceState === "transcribing" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
        )}
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
            disabled={!canSend}
            className="h-9 w-9 shrink-0 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
            aria-label="Enviar mensaje"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        )}
      </div>
      {showAttach && (
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md,.csv,.json,.xml,.html,.htm,.log,.yml,.yaml,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
          onChange={handleFileChange}
        />
      )}
    </div>
  );
}
