"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  CircleHelp,
  Clapperboard,
  Gem,
  Images,
  Megaphone,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Puzzle,
  Settings,
  SquarePen,
  Trash2,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ChatMode, ConversationSummary } from "@/lib/types";

interface SidebarProps {
  conversations: ConversationSummary[];
  activeId: string | null;
  open: boolean;
  mode: ChatMode;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onSelectMode: (mode: ChatMode) => void;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onOpenPlugins: () => void;
  onOpenGcr: () => void;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function groupConversations(convs: ConversationSummary[]) {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const weekAgo = startOfToday - 6 * DAY_MS;

  const groups: { label: string; items: ConversationSummary[] }[] = [
    { label: "Hoy", items: [] },
    { label: "Últimos 7 días", items: [] },
    { label: "Anteriores", items: [] },
  ];

  for (const c of convs) {
    const t = new Date(c.updatedAt).getTime();
    if (t >= startOfToday) groups[0].items.push(c);
    else if (t >= weekAgo) groups[1].items.push(c);
    else groups[2].items.push(c);
  }

  return groups.filter((g) => g.items.length > 0);
}

interface MenuItem {
  icon: typeof SquarePen;
  label: string;
  action: () => void;
  active?: boolean;
  external?: boolean;
}

export function Sidebar({
  conversations,
  activeId,
  open,
  mode,
  onClose,
  onSelect,
  onNewChat,
  onSelectMode,
  onRename,
  onDelete,
  onOpenPlugins,
  onOpenGcr,
  onOpenHelp,
  onOpenSettings,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ConversationSummary | null>(
    null
  );
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);

  const startRename = (conv: ConversationSummary) => {
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const commitRename = async () => {
    if (editingId && editTitle.trim()) {
      await onRename(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  const confirmDelete = async () => {
    if (deleteTarget) {
      await onDelete(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const groups = groupConversations(conversations);

  const menu: { section: MenuItem[] }[] = [
    {
      section: [
        { icon: SquarePen, label: "Nuevo chat", action: onNewChat },
        {
          icon: Images,
          label: "Imágenes",
          action: () => onSelectMode("images"),
          active: mode === "images",
        },
        {
          icon: Clapperboard,
          label: "Videos",
          action: () => onSelectMode("videos"),
          active: mode === "videos",
        },
        { icon: Puzzle, label: "Complementos", action: onOpenPlugins },
        {
          icon: Megaphone,
          label: "Investigación avanzada",
          action: () => onSelectMode("research"),
          active: mode === "research",
        },
        {
          icon: Bot,
          label: "Agente Master",
          action: () => onSelectMode("agente"),
          active: mode === "agente",
        },
      ],
    },
    {
      section: [
        { icon: Gem, label: "Recompensas · GCR y QFS", action: onOpenGcr },
        { icon: CircleHelp, label: "Ayuda", action: onOpenHelp, external: true },
        { icon: Settings, label: "Configuración", action: onOpenSettings },
      ],
    },
  ];

  const renderMenuItem = (item: MenuItem, idx: number) => (
    <button
      key={`${item.label}-${idx}`}
      type="button"
      onClick={item.action}
      aria-current={item.active ? "true" : undefined}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
        item.active
          ? "bg-sidebar-accent font-medium text-emerald-700 dark:text-emerald-300"
          : "hover:bg-sidebar-accent/60"
      }`}
    >
      <item.icon
        className={`h-4 w-4 shrink-0 ${
          item.active ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
        }`}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.active && (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
      )}
    </button>
  );

  return (
    <div className="flex h-full w-72 flex-col bg-sidebar text-sidebar-foreground border-r">
      {/* Cabecera */}
      <div className="flex items-center justify-between p-3 pb-2">
        <div className="flex items-center gap-2 px-1">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#003366] text-sm font-bold text-white"
            aria-hidden="true"
          >
            M
          </span>
          <span className="font-semibold text-sm">Master IA</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 lg:hidden"
          onClick={onClose}
          aria-label="Cerrar menú"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Menú principal */}
      <nav
        className="px-2"
        aria-label="Menú principal"
      >
        {menu.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-1 border-t pt-1" : ""}>
            {group.section.map((item, i) => renderMenuItem(item, i))}
          </div>
        ))}
      </nav>

      {/* Etiqueta de historial */}
      <p className="px-4 pt-4 pb-1 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
        Conversaciones
      </p>

      {/* Lista de conversaciones */}
      <nav className="flex-1 overflow-y-auto thin-scroll px-2 pb-3" aria-label="Historial de conversaciones">
        {groups.length === 0 ? (
          <div className="mt-8 flex flex-col items-center gap-2 px-6 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">
              Aún no tienes conversaciones.
              <br />
              ¡Empieza una nueva!
            </p>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mb-2">
              <p className="px-3 pt-3 pb-1 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((conv) => {
                  const isActive = conv.id === activeId;
                  return (
                    <li key={conv.id} className="relative">
                      {editingId === conv.id ? (
                        <Input
                          ref={editInputRef}
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename();
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="h-9 rounded-lg text-sm"
                          maxLength={120}
                          aria-label="Nuevo título de la conversación"
                        />
                      ) : (
                        <div
                          className={`group/item flex items-center rounded-lg transition-colors ${
                            isActive ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => onSelect(conv.id)}
                            className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-left cursor-pointer"
                            title={conv.title}
                          >
                            {conv.mode === "images" ? (
                              <Images
                                className="h-4 w-4 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                              />
                            ) : conv.mode === "videos" ? (
                              <Clapperboard
                                className="h-4 w-4 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                              />
                            ) : conv.mode === "research" ? (
                              <Megaphone
                                className="h-4 w-4 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                              />
                            ) : conv.mode === "agente" ? (
                              <Bot
                                className="h-4 w-4 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                              />
                            ) : (
                              <MessageSquare
                                className="h-4 w-4 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                              />
                            )}
                            <span className="truncate text-sm">{conv.title}</span>
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 opacity-0 group-hover/item:opacity-100 focus:opacity-100"
                                aria-label={`Opciones para "${conv.title}"`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => startRename(conv)}>
                                <Pencil className="h-4 w-4" />
                                Renombrar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setDeleteTarget(conv)}
                              >
                                <Trash2 className="h-4 w-4" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </nav>

      {/* Pie de la barra lateral */}
      <div className="border-t p-3">
        <p className="px-1 text-[0.7rem] text-muted-foreground">
          Master IA puede cometer errores. Verifica la información importante.
        </p>
      </div>

      {/* Diálogo de confirmación para eliminar */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta conversación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se borrarán todos los mensajes de
              &quot;{deleteTarget?.title}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
