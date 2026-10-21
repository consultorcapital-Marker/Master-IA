# Zoe Master IA

Plataforma de inteligencia artificial construida con **Next.js 16**, que integra chat conversacional con streaming, un agente autónomo con búsqueda web, generación de imágenes y videos, junto con un sistema de recompensas **GCRM / QFS**.

Identidad visual: logotipo **"M"** en azul marino **#003366**, asistente principal **Agente Master**.

---

## Características

### Chat IA con streaming
- Conversación en tiempo real con respuestas en streaming (SSE).
- Historial de conversaciones persistente en base de datos (Prisma + SQLite).
- Títulos automáticos para cada conversación.
- Interfaz de chat completa: Markdown, resaltado de código, toasts, diálogos.

### Agente Master (modo agéntico)
- Asistente autónomo que planifica y ejecuta misiones complejas.
- Estados visibles en vivo: *analizando tu petición → buscando en la web → leyendo las mejores fuentes → elaborando la respuesta final*.
- Búsqueda web real integrada (resultados con fuentes citadas).

### Generación de imágenes
- Creación de imágenes a partir de texto (text-to-image).
- Tarjetas de uso rápido: logo corporativo, fotografía de producto, banner publicitario, growth empresarial.

### Sección de video (estilo Grok Imagine, gratis)
- **Texto a video**: genera videos desde un prompt, con selección de formato.
- **Animar fotos (image-to-video)**: sube una imagen y conviértela en video animado.
- **Videos largos para redes**: formatos verticales **9:16 (TikTok)** y horizontales **16:9 (YouTube)**.

### Recompensas GCRM / QFS
- Recompensa automática de **1.000 QFS (red Ethereum) + 0,001 GCRM** cada 5 horas de uso.
- Seguimiento del saldo y del ciclo de recompensas.

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 (App Router) + React 19 |
| Lenguaje | TypeScript |
| Estilos | Tailwind CSS 4 + shadcn/ui + Radix UI |
| Base de datos | Prisma ORM + SQLite |
| IA | z-ai-web-dev-sdk (chat, imágenes, búsqueda web) |
| Runtime | Bun |

---

## Puesta en marcha

```bash
# 1. Instalar dependencias
bun install

# 2. Configurar la base de datos
bun run db:push

# 3. Entorno de desarrollo
bun run dev
```

La aplicación queda disponible en `http://localhost:3000`.

### Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `bun run dev` | Servidor de desarrollo en el puerto 3000 |
| `bun run build` | Compilación de producción (standalone) |
| `bun run start` | Servidor de producción |
| `bun run lint` | Linter ESLint |
| `bun run db:push` | Sincroniza el esquema de Prisma con la base de datos |

---

## Estructura del proyecto

```
src/
├── app/
│   ├── page.tsx              # Interfaz principal (chat, imágenes, video, recompensas)
│   ├── layout.tsx            # Layout raíz
│   ├── globals.css           # Estilos globales (branding navy #003366)
│   └── api/
│       ├── chat/             # Streaming de chat + modo agéntico (SSE)
│       ├── conversations/    # CRUD del historial
│       ├── rewards/          # Recompensas GCRM / QFS
│       └── videos/           # Generación de video (texto / imagen)
├── components/
│   ├── chat/
│   │   ├── sidebar.tsx       # Menú lateral e historial
│   │   ├── chat-input.tsx    # Entrada con modos (Chat / Web / Imagen / Agente)
│   │   ├── message.tsx       # Burbujas de mensaje + Markdown
│   │   ├── video-card.tsx    # Reproductor de videos generados
│   │   ├── z-assistant.tsx   # Panel Asistente Master AI
│   │   └── dialogs.tsx       # Diálogos auxiliares
│   └── ui/                   # Componentes shadcn/ui
└── lib/                      # Utilidades
prisma/schema.prisma          # Modelo de datos (conversaciones, mensajes, recompensas)
```

---

## Notas

- La base de datos SQLite (`db/custom.db`) es parte del runtime y no se incluye en el repositorio; se genera automáticamente con `bun run db:push`.
- El servicio de IA se consume exclusivamente desde el backend (rutas de API), nunca desde el cliente.
