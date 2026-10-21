"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  Clapperboard,
  CloudRain,
  Code2,
  Film,
  Globe,
  ImagePlus,
  Images,
  Lightbulb,
  Menu,
  Megaphone,
  MonitorPlay,
  Moon,
  Mountain,
  PenLine,
  Play,
  Plus,
  Smartphone,
  Sparkles,
  Sun,
  Waves,
  X,
  Zap,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Sidebar } from "@/components/chat/sidebar";
import { ChatInput } from "@/components/chat/chat-input";
import { MessageItem } from "@/components/chat/message";
import {
  HelpDialog,
  GcrDialog,
  PluginsDialog,
  SettingsDialog,
} from "@/components/chat/dialogs";
import { ZAssistant } from "@/components/chat/z-assistant";
import { Badge } from "@/components/ui/badge";
import { useUsageRewards } from "@/hooks/use-usage-rewards";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type {
  ChatMessage,
  ChatMode,
  ConversationSummary,
  Plugins,
} from "@/lib/types";

const SUGGESTIONS: Record<
  ChatMode,
  {
    icon: typeof Lightbulb;
    title: string;
    text: string;
    gradient?: string;
    action?: "photo";
  }[]
> = {
  chat: [
    {
      icon: Lightbulb,
      title: "Explícame un concepto",
      text: "Explícame la computación cuántica como si tuviera 12 años",
    },
    {
      icon: Code2,
      title: "Ayúdame con código",
      text: "Escribe una función en JavaScript que valide un email con expresión regular",
    },
    {
      icon: PenLine,
      title: "Escribe por mí",
      text: "Redacta un correo profesional para solicitar una reunión con mi equipo",
    },
    {
      icon: Sparkles,
      title: "Dame ideas",
      text: "Dame 5 ideas creativas para un blog de viajes por Sudamérica",
    },
  ],
  images: [
    {
      icon: Images,
      title: "Logo corporativo",
      text: "Un logo corporativo minimalista para una empresa de tecnología, estilo geométrico, fondo blanco",
    },
    {
      icon: Images,
      title: "Fotografía de producto",
      text: "Fotografía de producto de unos auriculares premium sobre fondo oscuro, iluminación de estudio",
    },
    {
      icon: Images,
      title: "Banner publicitario",
      text: "Banner publicitario para el lanzamiento de un producto financiero, estilo moderno y elegante",
    },
    {
      icon: Images,
      title: "Growth empresarial",
      text: "Ilustración corporativa de crecimiento empresarial con gráficos ascendentes, estilo profesional",
    },
  ],
  research: [
    {
      icon: Globe,
      title: "IA en Latinoamérica",
      text: "Estado actual de la inteligencia artificial en Latinoamérica y sus principales proyectos",
    },
    {
      icon: Globe,
      title: "Economía y clima",
      text: "Impacto económico del cambio climático en Perú y las medidas más recomendadas",
    },
    {
      icon: Globe,
      title: "Energías renovables",
      text: "Comparativa de las energías renovables más rentables en 2025",
    },
    {
      icon: Globe,
      title: "Medicina genética",
      text: "Avances recientes en medicina genética y terapias personalizadas",
    },
  ],
  agente: [
    {
      icon: Bot,
      title: "Informe de mercado GCRM",
      text: "Investiga el estado actual del token GCR Master (GCRM) y redacta un informe con fuentes",
    },
    {
      icon: Bot,
      title: "Marca con imagen",
      text: "Crea una imagen promocional de Master IA y explica cómo usarla en redes sociales",
    },
    {
      icon: Bot,
      title: "Tendencias de IA",
      text: "Analiza las tendencias de inteligencia artificial y resume las conclusiones clave",
    },
    {
      icon: Bot,
      title: "Plan de promoción",
      text: "Diseña paso a paso una estrategia para promover los tokens GCRM y QFS",
    },
  ],
  videos: [
    {
      icon: ImagePlus,
      title: "Anima tu foto",
      text: "Sube una foto y dale vida: retrato que sonríe, parpadea y se mueve con la brisa",
      gradient: "from-pink-500 to-rose-700",
      action: "photo",
    },
    {
      icon: MonitorPlay,
      title: "Video largo para YouTube",
      text: "Recorrido aéreo por la costa de Lima al atardecer: acantilados, olas y ciudad dorada, video largo continuo",
      gradient: "from-blue-600 to-indigo-800",
    },
    {
      icon: Smartphone,
      title: "TikTok vertical",
      text: "Skate recorriendo una avenida con neones de noche, plano bajo siguiendo la tabla, formato vertical 9:16",
      gradient: "from-fuchsia-500 to-purple-800",
    },
    {
      icon: Mountain,
      title: "Dron en los Andes",
      text: "Toma aérea con dron sobrevolando los Andes nevados al amanecer, luz dorada, estilo cinematográfico",
      gradient: "from-emerald-500 to-teal-700",
    },
    {
      icon: CloudRain,
      title: "Neón en la lluvia",
      text: "Ciudad de noche lluviosa con luces de neón reflejadas en el asfalto, estilo cinematográfico",
      gradient: "from-violet-500 to-fuchsia-700",
    },
    {
      icon: Waves,
      title: "Olas al atardecer",
      text: "Olas rompiendo suavemente en una playa tropical al atardecer, cámara lenta, luz cálida",
      gradient: "from-orange-400 to-rose-600",
    },
  ],
};

const PLACEHOLDERS: Record<ChatMode, string> = {
  chat: "Escribe tu mensaje aquí…",
  images: "Describe la imagen que quieres crear…",
  research: "¿Qué tema quieres investigar a fondo?",
  agente: "Dile al Agente Master qué misión debe cumplir…",
  videos: "Describe el video que quieres crear…",
};

const MODE_BADGES: Record<ChatMode, { label: string; icon: typeof Lightbulb } | null> = {
  chat: null,
  images: { label: "Imágenes", icon: Images },
  research: { label: "Investigación avanzada", icon: Megaphone },
  agente: { label: "Agente Master", icon: Bot },
  videos: { label: "Videos · Gratis", icon: Clapperboard },
};

/* ====== Helpers del modo Videos ====== */

/** Marcador de video listo: [MASTER_VIDEO:{url}|{promptEncoded}|{taskId}] */
const VIDEO_DONE_RE = /\[MASTER_VIDEO:([^\s|\]]+)\|([^\]]*)\|([^\]]*)\]/;
/** Marcador de video en curso: [MASTER_TASK:{taskId}|{promptEncoded}] */
const VIDEO_TASK_RE = /\[MASTER_TASK:([^\s|\]]+)\|([^\]]*)\]/;
/** Marcador de video largo en curso: [MASTER_PIPELINE:{id}|{ideaEncoded}] */
const PIPELINE_RE = /\[MASTER_PIPELINE:([^\s|\]]+)\|([^\]]*)\]/;
/** Marcador de foto adjunta al inicio de un mensaje del usuario */
const PHOTO_RE = /^\[MASTER_PHOTO:(data:[^\]]+)\]/;

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function sleepWithAbort(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true }
    );
  });
}

function videoStatusFor(elapsedMs: number): string {
  const s = elapsedMs / 1000;
  if (s < 15) return "Creando tu video…";
  if (s < 45) return "Diseñando las escenas…";
  if (s < 90) return "Renderizando fotogramas…";
  if (s < 150) return "Puliendo los detalles finales…";
  return "Últimos retoques… casi listo";
}

function longStatusFor(
  stage: string,
  ready: number,
  total: number
): string {
  if (stage === "stitching")
    return `Uniendo las ${total} escenas en un solo video…`;
  if (ready >= total) return "Últimos retoques del video largo…";
  if (ready === 0) return `Generando la escena 1 de ${total}…`;
  return `Escena ${ready} de ${total} lista · generando la escena ${ready + 1}…`;
}

export default function HomePage() {
  const { resolvedTheme, setTheme } = useTheme();
  const { toast } = useToast();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<ChatMode>("chat");
  const [videoQuality, setVideoQuality] = useState<"speed" | "quality">("speed");
  const [videoFormat, setVideoFormat] = useState<"landscape" | "portrait">(
    "landscape"
  );
  const [videoLength, setVideoLength] = useState<"5" | "10" | "long">("5");
  const [photo, setPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [plugins, setPlugins] = useState<Plugins>({
    thinking: false,
    webSearch: false,
  });

  const [pluginsOpen, setPluginsOpen] = useState(false);
  const [gcrOpen, setGcrOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { usageSeconds, rewardState, syncWallet } = useUsageRewards();

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  /* ====== Cargar complementos guardados ====== */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("master-ia-plugins");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.thinking === "boolean" && typeof parsed?.webSearch === "boolean") {
          setPlugins(parsed);
        }
      }
    } catch {
      /* sin plugins guardados */
    }
  }, []);

  const updatePlugin = useCallback((key: keyof Plugins, value: boolean) => {
    setPlugins((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem("master-ia-plugins", JSON.stringify(next));
      } catch {
        /* almacenamiento no disponible */
      }
      return next;
    });
  }, []);

  /* ====== Cargar conversaciones ====== */
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.conversations ?? []);
    } catch {
      /* silencioso: la lista se refrescará más tarde */
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  /* ====== Scroll automático ====== */
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 140;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  /* ====== Consultar el estado de una tarea de video (polling) ====== */
  const pollVideo = useCallback(
    async (opts: {
      taskId: string;
      conversationId: string;
      prompt: string;
      assistantId: string;
      signal?: AbortSignal;
    }) => {
      const { taskId, conversationId, prompt, assistantId, signal } = opts;
      const patchById = (patch: Partial<ChatMessage>) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, ...patch } : m))
        );
      const startedAt = Date.now();
      const maxPolls = 60; // ~10 minutos a 10 s

      for (let i = 1; i <= maxPolls; i++) {
        if (signal?.aborted) return;
        await sleepWithAbort(10000, signal);
        if (signal?.aborted) return;
        try {
          const res = await fetch(
            `/api/videos?taskId=${encodeURIComponent(
              taskId
            )}&conversationId=${encodeURIComponent(
              conversationId
            )}&prompt=${encodeURIComponent(prompt)}`,
            { signal }
          );
          const data = await res.json();
          if (data?.status === "success" && data.videoUrl) {
            patchById({
              status: undefined,
              content: "🎬 **¡Tu video está listo!**",
              video: { url: data.videoUrl, prompt },
            });
            return;
          }
          if (data?.status === "fail") {
            patchById({
              status: undefined,
              content:
                "⚠️ No pude generar el video con esa descripción. Prueba a reformularla (evita contenido sensible) e inténtalo de nuevo.",
            });
            return;
          }
          patchById({ status: videoStatusFor(Date.now() - startedAt) });
        } catch {
          if (signal?.aborted) return;
          patchById({
            status: "Reintentando conexión con el estudio de video…",
          });
        }
      }

      // Tiempo agotado: persistir el marcador de reanudación en la conversación
      try {
        await fetch(
          `/api/videos?taskId=${encodeURIComponent(
            taskId
          )}&conversationId=${encodeURIComponent(
            conversationId
          )}&prompt=${encodeURIComponent(prompt)}&persist=1`
        );
      } catch {
        /* silencioso */
      }
      patchById({
        status: undefined,
        content:
          "⏳ **Tu video sigue generándose.** Se reanudará automáticamente al volver a esta conversación.",
      });
    },
    []
  );

  /* ====== Consultar el progreso de un video largo (pipeline multi-escena) ====== */
  const pollPipeline = useCallback(
    async (opts: {
      pipelineId: string;
      idea: string;
      assistantId: string;
      signal?: AbortSignal;
    }) => {
      const { pipelineId, idea, assistantId, signal } = opts;
      const patchById = (patch: Partial<ChatMessage>) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, ...patch } : m))
        );

      const maxPolls = 160; // ~40 minutos a 15 s por consulta
      for (let i = 1; i <= maxPolls; i++) {
        if (signal?.aborted) return;
        await sleepWithAbort(15000, signal);
        if (signal?.aborted) return;
        try {
          const res = await fetch(
            `/api/videos/long?id=${encodeURIComponent(pipelineId)}`,
            { signal }
          );
          const data = await res.json();
          if (data?.status === "done" && data.finalUrl) {
            patchById({
              status: undefined,
              content: `🎬 **¡Tu video largo está listo!** ${data.total} escenas unidas (~${Math.round(
                data.total * data.clipDuration
              )} s).`,
              video: { url: data.finalUrl, prompt: idea },
            });
            return;
          }
          if (data?.status === "failed") {
            patchById({
              status: undefined,
              content: `⚠️ ${
                data.error ?? "No se pudo completar el video largo."
              } Inténtalo de nuevo.`,
            });
            return;
          }
          patchById({
            status: longStatusFor(
              data?.stage ?? "generating",
              data?.ready ?? 0,
              data?.total ?? 3
            ),
          });
        } catch {
          if (signal?.aborted) return;
          patchById({
            status: "Reintentando conexión con el estudio de video…",
          });
        }
      }
      patchById({
        status: undefined,
        content:
          "⏳ **Tu video largo sigue generándose.** Se reanudará automáticamente al volver a esta conversación.",
      });
    },
    []
  );

  /* ====== Seleccionar conversación ====== */
  const selectConversation = useCallback(
    async (id: string) => {
      setSidebarOpen(false);
      if (id === activeId) return;
      try {
        const res = await fetch(`/api/conversations/${id}`);
        if (!res.ok) throw new Error("No se pudo cargar la conversación");
        const data = await res.json();
        const conv = data.conversation;
        setActiveId(id);
        setMode(
          conv?.mode === "images" ||
          conv?.mode === "research" ||
          conv?.mode === "agente" ||
          conv?.mode === "videos"
            ? conv.mode
            : "chat"
        );
        // Convertir marcadores de video en reproductores y reanudar pendientes
        const pendingTasks: {
          taskId: string;
          prompt: string;
          assistantId: string;
        }[] = [];
        const pendingPipelines: {
          pipelineId: string;
          idea: string;
          assistantId: string;
        }[] = [];
        const mapped = ((conv?.messages ?? []) as {
          id: string;
          role: string;
          content: string;
        }[]).map((m) => {
          const role = m.role === "assistant" ? "assistant" : "user";
          let content = m.content;
          let video: { url: string; prompt?: string } | undefined;
          let image: string | undefined;
          if (role === "user") {
            const photoMatch = content.match(PHOTO_RE);
            if (photoMatch) {
              image = photoMatch[1];
              content = content.replace(PHOTO_RE, "").trim();
            }
          }
          if (role === "assistant") {
            const doneMatch = content.match(VIDEO_DONE_RE);
            if (doneMatch) {
              video = { url: doneMatch[1], prompt: safeDecode(doneMatch[2]) };
              content = content.replace(VIDEO_DONE_RE, "").trim();
            } else {
              const pipeMatch = content.match(PIPELINE_RE);
              if (pipeMatch) {
                content =
                  "🎞️ **Tu video largo sigue generándose…** Se reanudará automáticamente.";
                pendingPipelines.push({
                  pipelineId: pipeMatch[1],
                  idea: safeDecode(pipeMatch[2]),
                  assistantId: m.id,
                });
              } else {
                const taskMatch = content.match(VIDEO_TASK_RE);
                if (taskMatch) {
                  content =
                    "⏳ **Tu video sigue generándose…** Terminará en unos minutos.";
                  pendingTasks.push({
                    taskId: taskMatch[1],
                    prompt: safeDecode(taskMatch[2]),
                    assistantId: m.id,
                  });
                }
              }
            }
          }
          return {
            id: m.id,
            role: role as "user" | "assistant",
            content,
            ...(video ? { video } : {}),
            ...(image ? { image } : {}),
          };
        });
        setMessages(mapped);
        stickToBottomRef.current = true;
        // Reanudar la consulta de videos que quedaron en proceso
        for (const t of pendingTasks) {
          pollVideo({
            taskId: t.taskId,
            conversationId: id,
            prompt: t.prompt,
            assistantId: t.assistantId,
          });
        }
        // Reanudar los videos largos pendientes
        for (const pl of pendingPipelines) {
          pollPipeline({
            pipelineId: pl.pipelineId,
            idea: pl.idea,
            assistantId: pl.assistantId,
          });
        }
      } catch (err) {
        toast({
          title: "Error",
          description:
            err instanceof Error
              ? err.message
              : "No se pudo cargar la conversación",
          variant: "destructive",
        });
      }
    },
    [activeId, pollPipeline, pollVideo, toast]
  );

  /* ====== Nueva conversación ====== */
  const newChat = useCallback((nextMode: ChatMode = "chat") => {
    setSidebarOpen(false);
    setActiveId(null);
    setMessages([]);
    setInput("");
    setMode(nextMode);
  }, []);

  /* ====== Cambiar de modo ====== */
  const selectMode = useCallback(
    (next: ChatMode) => {
      if (next === "chat") return;
      newChat(next);
    },
    [newChat]
  );

  /* ====== Renombrar ====== */
  const renameConversation = useCallback(
    async (id: string, title: string) => {
      try {
        const res = await fetch(`/api/conversations/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
        if (!res.ok) throw new Error();
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, title } : c))
        );
      } catch {
        toast({
          title: "Error",
          description: "No se pudo renombrar la conversación",
          variant: "destructive",
        });
      }
    },
    [toast]
  );

  /* ====== Eliminar ====== */
  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/conversations/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error();
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (id === activeId) {
          setActiveId(null);
          setMessages([]);
        }
        toast({ title: "Conversación eliminada" });
      } catch {
        toast({
          title: "Error",
          description: "No se pudo eliminar la conversación",
          variant: "destructive",
        });
      }
    },
    [activeId, toast]
  );

  /* ====== Borrar todas las conversaciones ====== */
  const deleteAllConversations = useCallback(async () => {
    const res = await fetch("/api/conversations", { method: "DELETE" });
    if (!res.ok) throw new Error("Error al borrar");
    setConversations([]);
    setActiveId(null);
    setMessages([]);
  }, []);

  /* ====== Generar video (modo Videos, estilo Imagine) ====== */
  const sendVideo = useCallback(
    async (text: string) => {
      if (isStreaming) return;
      const hasPhoto = Boolean(photo);
      if (!text && !hasPhoto) return;

      const userMsg: ChatMessage = {
        id: `tmp-u-${Date.now()}`,
        role: "user",
        content: text || "🎞️ Anima esta foto",
        ...(hasPhoto ? { image: photo as string } : {}),
      };
      const assistantId = `tmp-a-${Date.now()}`;
      const currentConvId = activeId;

      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          status: hasPhoto
            ? "Animando tu foto…"
            : "Preparando tu video…",
        },
      ]);
      setInput("");
      setPhoto(null);
      setIsStreaming(true);
      stickToBottomRef.current = true;

      const controller = new AbortController();
      abortRef.current = controller;

      const patchById = (patch: Partial<ChatMessage>) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, ...patch } : m))
        );

      try {
        // El estudio de video gratuito admite pocas tareas a la vez: si está
        // ocupado (429) se reintenta automáticamente hasta 6 veces (~5 min)
        let taskId = "";
        let convId = "";
        for (let attempt = 1; attempt <= 6 && !taskId; attempt++) {
          if (controller.signal.aborted) {
            throw new DOMException("Abortado", "AbortError");
          }
          if (attempt > 1) {
            patchById({
              status: `El estudio está ocupado: esperando turno… (intento ${attempt} de 6)`,
            });
            await sleepWithAbort(55_000, controller.signal);
            if (controller.signal.aborted) {
              throw new DOMException("Abortado", "AbortError");
            }
            patchById({
              status: hasPhoto ? "Animando tu foto…" : "Preparando tu video…",
            });
          }
          const res = await fetch("/api/videos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: text,
              conversationId: currentConvId,
              quality: videoQuality,
              format: videoFormat,
              duration: videoLength === "10" ? 10 : 5,
              ...(hasPhoto ? { image: photo } : {}),
            }),
            signal: controller.signal,
          });
          const data = await res.json();
          if (res.ok && data?.taskId) {
            taskId = data.taskId;
            convId = data.conversationId ?? "";
          } else if (res.status !== 429) {
            throw new Error(data?.error ?? "No se pudo iniciar el video");
          }
        }
        if (!taskId) {
          throw new Error(
            "El estudio de video sigue ocupado. Inténtalo de nuevo en unos minutos."
          );
        }
        if (convId && convId !== currentConvId) setActiveId(convId);
        loadConversations();
        await pollVideo({
          taskId,
          conversationId: convId,
          prompt: text || "Foto animada con IA",
          assistantId,
          signal: controller.signal,
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          patchById({
            status: undefined,
            content: "🎬 Generación de video cancelada.",
          });
        } else {
          patchById({
            status: undefined,
            content:
              "⚠️ No pude crear tu video. Inténtalo de nuevo en unos segundos.",
          });
          toast({
            title: "Error",
            description:
              err instanceof Error
                ? err.message
                : "Ocurrió un error inesperado",
            variant: "destructive",
          });
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [
      activeId,
      isStreaming,
      loadConversations,
      photo,
      pollVideo,
      toast,
      videoFormat,
      videoLength,
      videoQuality,
    ]
  );

  /* ====== Generar video largo (guion multi-escena + unión) ====== */
  const sendVideoLong = useCallback(
    async (text: string) => {
      if (!text || isStreaming) return;

      const userMsg: ChatMessage = {
        id: `tmp-u-${Date.now()}`,
        role: "user",
        content: text,
      };
      const assistantId = `tmp-a-${Date.now()}`;
      const currentConvId = activeId;

      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          status: "Creando el guion de tu video largo…",
        },
      ]);
      setInput("");
      setPhoto(null);
      setIsStreaming(true);
      stickToBottomRef.current = true;

      const controller = new AbortController();
      abortRef.current = controller;

      const patchById = (patch: Partial<ChatMessage>) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, ...patch } : m))
        );

      try {
        const res = await fetch("/api/videos/long", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idea: text,
            conversationId: currentConvId,
            quality: videoQuality,
            format: videoFormat,
            scenes: 3,
            clipDuration: 10,
          }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? "No se pudo iniciar el video largo");
        }
        const convId: string = data.conversationId;
        if (convId && convId !== currentConvId) setActiveId(convId);
        loadConversations();
        await pollPipeline({
          pipelineId: data.pipelineId,
          idea: text,
          assistantId,
          signal: controller.signal,
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          patchById({
            status: undefined,
            content: "🎬 Generación de video cancelada. La tarea continúa en el estudio y podrás verla al volver a esta conversación.",
          });
        } else {
          patchById({
            status: undefined,
            content:
              "⚠️ No pude iniciar tu video largo. Inténtalo de nuevo en unos segundos.",
          });
          toast({
            title: "Error",
            description:
              err instanceof Error
                ? err.message
                : "Ocurrió un error inesperado",
            variant: "destructive",
          });
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [
      activeId,
      isStreaming,
      loadConversations,
      pollPipeline,
      toast,
      videoFormat,
      videoQuality,
    ]
  );

  /* ====== Enviar mensaje (streaming SSE) ====== */
  const send = useCallback(
    async (rawText?: string) => {
      const text = (rawText ?? input).trim();
      if (isStreaming) return;

      /* El modo Videos usa su propio flujo (tarea asíncrona + polling) */
      if (mode === "videos") {
        if (videoLength === "long") {
          await sendVideoLong(text);
        } else {
          await sendVideo(text);
        }
        return;
      }
      if (!text) return;

      const userMsg: ChatMessage = {
        id: `tmp-u-${Date.now()}`,
        role: "user",
        content: text,
      };
      const assistantId = `tmp-a-${Date.now()}`;
      const currentConvId = activeId;
      const currentMode = mode;

      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: assistantId, role: "assistant", content: "" },
      ]);
      setInput("");
      setIsStreaming(true);
      stickToBottomRef.current = true;

      const controller = new AbortController();
      abortRef.current = controller;

      const patchAssistant = (patch: Partial<ChatMessage>) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, ...patch } : m))
        );

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            conversationId: currentConvId,
            mode: currentMode,
            thinking: plugins.thinking,
            webSearch: plugins.webSearch,
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error("No se pudo conectar con el servidor");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let received = "";
        let finalConvId = currentConvId;

        const processEvent = (part: string) => {
          let event = "message";
          let dataStr = "";
          for (const line of part.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
          }
          if (!dataStr) return;
          let data: {
            text?: string;
            status?: string;
            conversationId?: string;
            message?: string;
          };
          try {
            data = JSON.parse(dataStr);
          } catch {
            return;
          }
          if (event === "meta" && data.conversationId) {
            finalConvId = data.conversationId;
          } else if (event === "status" && data.text) {
            patchAssistant({ status: data.text });
          } else if (event === "delta" && data.text) {
            received += data.text;
            patchAssistant({ content: received, status: undefined });
          } else if (event === "done" && data.conversationId) {
            finalConvId = data.conversationId;
          } else if (event === "error") {
            throw new Error(data.message ?? "Error del servidor");
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) processEvent(part);
        }
        if (buffer.trim()) processEvent(buffer);

        if (finalConvId !== currentConvId) setActiveId(finalConvId);
        loadConversations();
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // El usuario detuvo la respuesta: se conserva el texto parcial
        } else {
          const msg =
            err instanceof Error
              ? err.message
              : "Ocurrió un error inesperado";
          patchAssistant({
            status: undefined,
            content:
              "⚠️ No pude completar tu solicitud. Inténtalo de nuevo en unos segundos.",
          });
          toast({
            title: "Error",
            description: msg,
            variant: "destructive",
          });
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [activeId, input, isStreaming, loadConversations, mode, photo, plugins, sendVideo, sendVideoLong, toast, videoLength]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  /* ====== Seleccionar y reducir una foto para animar ====== */
  const handlePhotoFile = useCallback(
    (file: File | undefined | null) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Formato no válido",
          description: "Elige una imagen (JPG, PNG o WebP).",
          variant: "destructive",
        });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const img = document.createElement("img");
        img.onload = () => {
          // Reducir a un máximo de 1280 px para que la petición sea ligera
          const max = 1280;
          const scale = Math.min(
            1,
            max / Math.max(img.width || 1, img.height || 1)
          );
          const w = Math.max(1, Math.round((img.width || max) * scale));
          const h = Math.max(1, Math.round((img.height || max) * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(img, 0, 0, w, h);
          setPhoto(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = () => {
          toast({
            title: "No se pudo leer la imagen",
            variant: "destructive",
          });
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    },
    [toast]
  );

  const activeTitle =
    conversations.find((c) => c.id === activeId)?.title ?? "Master IA";
  const modeBadge = MODE_BADGES[mode];
  const suggestions = SUGGESTIONS[mode];

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      {/* Fondo oscuro para móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Barra lateral */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          open={sidebarOpen}
          mode={mode}
          onClose={() => setSidebarOpen(false)}
          onSelect={selectConversation}
          onNewChat={() => newChat("chat")}
          onSelectMode={selectMode}
          onRename={renameConversation}
          onDelete={deleteConversation}
          onOpenPlugins={() => {
            setSidebarOpen(false);
            setPluginsOpen(true);
          }}
          onOpenGcr={() => {
            setSidebarOpen(false);
            setGcrOpen(true);
          }}
          onOpenHelp={() => {
            setSidebarOpen(false);
            setHelpOpen(true);
          }}
          onOpenSettings={() => {
            setSidebarOpen(false);
            setSettingsOpen(true);
          }}
        />
      </aside>

      {/* Área principal */}
      <main className="flex h-full min-w-0 flex-1 flex-col">
        {/* Cabecera */}
        <header className="flex h-14 shrink-0 items-center gap-1.5 border-b px-3 md:px-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="min-w-0 flex-1 truncate text-sm font-medium">
            {activeTitle}
          </h1>
          {modeBadge && (
            <Badge
              variant="outline"
              className="gap-1.5 border-emerald-500/50 text-emerald-700 dark:text-emerald-300"
            >
              <modeBadge.icon className="h-3 w-3" />
              {modeBadge.label}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Cambiar tema"
          >
            {mounted && resolvedTheme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => newChat("chat")}
            aria-label="Nueva conversación"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </header>

        {/* Mensajes */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto thin-scroll"
        >
          {messages.length === 0 ? (
            <div className="flex min-h-full flex-col items-center justify-center px-4 py-8">
              {mode === "videos" && (
                <Badge className="mb-4 gap-1.5 rounded-full border-0 bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                  <Clapperboard className="h-3.5 w-3.5" aria-hidden="true" />
                  Videos con IA · Gratis
                </Badge>
              )}
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#003366] shadow-lg">
                <span className="text-3xl font-bold text-white" aria-hidden="true">
                  M
                </span>
              </div>
              <h2 className="mb-2 text-center text-2xl font-semibold md:text-3xl">
                {mode === "images"
                  ? "¿Qué imagen quieres crear?"
                  : mode === "research"
                  ? "¿Qué tema quieres investigar a fondo?"
                  : mode === "agente"
                  ? "¿Qué misión le das al Agente Master?"
                  : mode === "videos"
                  ? "¿Qué video quieres crear?"
                  : "¿En qué puedo ayudarte hoy?"}
              </h2>
              <p className="mb-8 max-w-md text-center text-sm text-muted-foreground md:text-base">
                {mode === "images"
                  ? "Describe la imagen que deseas y la generaré al instante."
                  : mode === "research"
                  ? "Buscaré fuentes en la web, las analizaré y te daré un informe completo con citas."
                  : mode === "agente"
                  ? "El agente más potente: analiza tu petición, busca en la web, lee fuentes reales, razona a fondo y crea imágenes. Todo en una sola misión."
                  : mode === "videos"
                  ? "Convierte tus ideas y tus fotos en videos con IA: anima cualquier imagen, elige formato TikTok o YouTube y crea videos largos uniendo varias escenas. Todo gratis."
                  : "Pregúntame lo que quieras: desde conceptos complejos hasta ideas creativas, código o escritos."}
              </p>
              <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
                {suggestions.map((s) => (
                  <button
                    key={s.title}
                    type="button"
                    onClick={() =>
                      s.action === "photo"
                        ? fileInputRef.current?.click()
                        : send(s.text)
                    }
                    disabled={isStreaming}
                    className="group flex flex-col gap-1 rounded-2xl border p-4 text-left transition-colors hover:bg-muted disabled:opacity-50 cursor-pointer"
                  >
                    {s.gradient && (
                      <span
                        className={`relative mb-1 flex h-20 w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br ${s.gradient}`}
                        aria-hidden="true"
                      >
                        <Play className="h-6 w-6 text-white/90 drop-shadow transition-transform group-hover:scale-110" />
                      </span>
                    )}
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <s.icon
                        className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
                        aria-hidden="true"
                      />
                      {s.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {s.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
              {messages.map((m) => (
                <MessageItem
                  key={m.id}
                  message={m}
                  streaming={
                    isStreaming &&
                    m.id === messages[messages.length - 1]?.id &&
                    m.role === "assistant"
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* Entrada de texto */}
        <div className="shrink-0 bg-background">
          <div className="mx-auto max-w-3xl px-4 pb-3 pt-2">
            {mode === "videos" && photo && (
              <div className="mb-2 flex items-center justify-center">
                <div className="relative inline-flex items-center gap-2.5 rounded-2xl border bg-card p-1.5 pr-8 shadow-sm">
                  <img
                    src={photo}
                    alt="Foto lista para animar"
                    className="h-12 w-12 rounded-xl object-cover"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium">Foto lista para animar</p>
                    <p className="text-[0.7rem] text-muted-foreground">
                      Describe el movimiento que quieres lograr
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPhoto(null)}
                    aria-label="Quitar la foto"
                    className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-foreground hover:text-background cursor-pointer"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
            {mode === "videos" && (
              <div
                className="mb-2 flex flex-wrap items-center justify-center gap-1.5"
                role="group"
                aria-label="Opciones del video"
              >
                <button
                  type="button"
                  onClick={() => setVideoQuality("speed")}
                  aria-pressed={videoQuality === "speed"}
                  className={
                    videoQuality === "speed"
                      ? "flex h-7 cursor-pointer items-center gap-1 rounded-full bg-[#003366] px-2.5 text-[0.7rem] font-medium text-white transition-colors"
                      : "flex h-7 cursor-pointer items-center gap-1 rounded-full border px-2.5 text-[0.7rem] font-medium text-muted-foreground transition-colors hover:bg-muted"
                  }
                >
                  <Zap className="h-3 w-3" aria-hidden="true" />
                  Rápido
                </button>
                <button
                  type="button"
                  onClick={() => setVideoQuality("quality")}
                  aria-pressed={videoQuality === "quality"}
                  className={
                    videoQuality === "quality"
                      ? "flex h-7 cursor-pointer items-center gap-1 rounded-full bg-[#003366] px-2.5 text-[0.7rem] font-medium text-white transition-colors"
                      : "flex h-7 cursor-pointer items-center gap-1 rounded-full border px-2.5 text-[0.7rem] font-medium text-muted-foreground transition-colors hover:bg-muted"
                  }
                >
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  Calidad
                </button>
                <span
                  className="mx-0.5 h-5 w-px bg-border"
                  aria-hidden="true"
                />
                <button
                  type="button"
                  onClick={() => setVideoFormat("landscape")}
                  aria-pressed={videoFormat === "landscape"}
                  className={
                    videoFormat === "landscape"
                      ? "flex h-7 cursor-pointer items-center gap-1 rounded-full bg-[#003366] px-2.5 text-[0.7rem] font-medium text-white transition-colors"
                      : "flex h-7 cursor-pointer items-center gap-1 rounded-full border px-2.5 text-[0.7rem] font-medium text-muted-foreground transition-colors hover:bg-muted"
                  }
                >
                  <MonitorPlay className="h-3 w-3" aria-hidden="true" />
                  16:9 YouTube
                </button>
                <button
                  type="button"
                  onClick={() => setVideoFormat("portrait")}
                  aria-pressed={videoFormat === "portrait"}
                  className={
                    videoFormat === "portrait"
                      ? "flex h-7 cursor-pointer items-center gap-1 rounded-full bg-[#003366] px-2.5 text-[0.7rem] font-medium text-white transition-colors"
                      : "flex h-7 cursor-pointer items-center gap-1 rounded-full border px-2.5 text-[0.7rem] font-medium text-muted-foreground transition-colors hover:bg-muted"
                  }
                >
                  <Smartphone className="h-3 w-3" aria-hidden="true" />
                  9:16 TikTok
                </button>
                <span
                  className="mx-0.5 h-5 w-px bg-border"
                  aria-hidden="true"
                />
                <button
                  type="button"
                  onClick={() => setVideoLength("5")}
                  aria-pressed={videoLength === "5"}
                  className={
                    videoLength === "5"
                      ? "flex h-7 cursor-pointer items-center gap-1 rounded-full bg-[#003366] px-2.5 text-[0.7rem] font-medium text-white transition-colors"
                      : "flex h-7 cursor-pointer items-center gap-1 rounded-full border px-2.5 text-[0.7rem] font-medium text-muted-foreground transition-colors hover:bg-muted"
                  }
                >
                  5 s
                </button>
                <button
                  type="button"
                  onClick={() => setVideoLength("10")}
                  aria-pressed={videoLength === "10"}
                  className={
                    videoLength === "10"
                      ? "flex h-7 cursor-pointer items-center gap-1 rounded-full bg-[#003366] px-2.5 text-[0.7rem] font-medium text-white transition-colors"
                      : "flex h-7 cursor-pointer items-center gap-1 rounded-full border px-2.5 text-[0.7rem] font-medium text-muted-foreground transition-colors hover:bg-muted"
                  }
                >
                  10 s
                </button>
                <button
                  type="button"
                  onClick={() => setVideoLength("long")}
                  aria-pressed={videoLength === "long"}
                  className={
                    videoLength === "long"
                      ? "flex h-7 cursor-pointer items-center gap-1 rounded-full bg-[#003366] px-2.5 text-[0.7rem] font-medium text-white transition-colors"
                      : "flex h-7 cursor-pointer items-center gap-1 rounded-full border px-2.5 text-[0.7rem] font-medium text-muted-foreground transition-colors hover:bg-muted"
                  }
                >
                  <Film className="h-3 w-3" aria-hidden="true" />
                  Larga · ~30 s
                </button>
                <span
                  className="mx-0.5 h-5 w-px bg-border"
                  aria-hidden="true"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-pressed={Boolean(photo)}
                  className={
                    photo
                      ? "flex h-7 cursor-pointer items-center gap-1 rounded-full bg-emerald-600 px-2.5 text-[0.7rem] font-medium text-white transition-colors"
                      : "flex h-7 cursor-pointer items-center gap-1 rounded-full border px-2.5 text-[0.7rem] font-medium text-muted-foreground transition-colors hover:bg-muted"
                  }
                >
                  <ImagePlus className="h-3 w-3" aria-hidden="true" />
                  Animar foto
                </button>
                <span className="flex h-7 items-center rounded-full bg-emerald-600 px-2.5 text-[0.7rem] font-semibold text-white">
                  Gratis
                </span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
              onChange={(e) => {
                handlePhotoFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <ChatInput
              value={input}
              onChange={setInput}
              onSend={() => send()}
              onStop={stopStreaming}
              isStreaming={isStreaming}
              placeholder={
                mode === "videos" && photo
                  ? "Describe cómo animar tu foto (opcional)…"
                  : PLACEHOLDERS[mode]
              }
            />
            <p className="mt-2 text-center text-[0.7rem] text-muted-foreground">
              Master IA puede cometer errores. Verifica la información
              importante.
            </p>
          </div>
        </div>
      </main>

      {/* Diálogos */}
      <PluginsDialog
        open={pluginsOpen}
        onOpenChange={setPluginsOpen}
        plugins={plugins}
        onChangePlugin={updatePlugin}
      />
      <GcrDialog
        open={gcrOpen}
        onOpenChange={setGcrOpen}
        usageSeconds={usageSeconds}
        rewardState={rewardState}
        onWalletChange={syncWallet}
      />
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onDeleteAll={deleteAllConversations}
        plugins={plugins}
        onChangePlugin={updatePlugin}
      />

      {/* Asistente Master AI (agente flotante: chat, búsqueda web, imágenes y razonamiento) */}
      <ZAssistant />
    </div>
  );
}
