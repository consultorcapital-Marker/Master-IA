"use client";

import { useState } from "react";
import { Download, Play } from "lucide-react";
import type { ChatMessage } from "@/lib/types";

/** Tarjeta de video estilo "Imagine": reproductor, chips de metadatos y descarga.
 * La proporción (16:9 o 9:16) y los datos (resolución, duración) se leen del
 * propio video al cargar sus metadatos, así funciona con cualquier formato. */
export function VideoCard({
  video,
}: {
  video: NonNullable<ChatMessage["video"]>;
}) {
  const [dims, setDims] = useState<{
    w: number;
    h: number;
    dur: number;
  } | null>(null);
  const ratio = dims ? dims.w / (dims.h || 1) : 16 / 9;
  const isPortrait = ratio < 0.95;

  return (
    <figure className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div
        className={`relative bg-black ${
          isPortrait ? "mx-auto w-full max-w-[300px]" : "w-full"
        }`}
      >
        <video
          src={video.url}
          controls
          playsInline
          preload="metadata"
          className="w-full object-contain"
          style={{
            aspectRatio: `${dims ? dims.w : 16} / ${dims ? dims.h : 9}`,
            maxHeight: isPortrait ? "70vh" : undefined,
          }}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (v.videoWidth && v.videoHeight) {
              setDims({
                w: v.videoWidth,
                h: v.videoHeight,
                dur: Number.isFinite(v.duration) ? v.duration : 0,
              });
            }
          }}
          aria-label={
            video.prompt
              ? `Video generado: ${video.prompt}`
              : "Video generado con IA"
          }
        >
          Tu navegador no soporta la reproducción de video.
        </video>
        <span
          className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[0.65rem] font-medium text-white backdrop-blur"
          aria-hidden="true"
        >
          <Play className="h-3 w-3" />
          Generado con IA
        </span>
      </div>
      <figcaption className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          {video.prompt && (
            <p className="truncate text-xs text-muted-foreground" title={video.prompt}>
              {video.prompt}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border px-2 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
              {dims ? `${dims.w}×${dims.h}` : "1080p · 30 fps"}
            </span>
            <span className="rounded-full border px-2 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
              {dims && dims.dur ? `${Math.round(dims.dur)} s` : "5 s"}
            </span>
            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[0.65rem] font-semibold text-white">
              Gratis
            </span>
          </div>
        </div>
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors hover:bg-muted cursor-pointer"
          aria-label="Descargar o abrir el video"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Descargar
        </a>
      </figcaption>
    </figure>
  );
}
