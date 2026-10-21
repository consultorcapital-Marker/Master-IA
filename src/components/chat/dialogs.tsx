"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Brain,
  Check,
  Coins,
  Copy,
  ExternalLink,
  Gem,
  Gift,
  Globe,
  Info,
  Keyboard,
  Loader2,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "next-themes";
import { useToast } from "@/hooks/use-toast";
import {
  CYCLE_SECONDS,
  GCRM_PER_CYCLE,
  QFS_PER_CYCLE,
  type RewardState,
} from "@/hooks/use-usage-rewards";
import type { Plugins } from "@/lib/types";

/* =================== COMPLEMENTOS =================== */

interface PluginsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plugins: Plugins;
  onChangePlugin: (key: keyof Plugins, value: boolean) => void;
}

export function PluginsDialog({
  open,
  onOpenChange,
  plugins,
  onChangePlugin,
}: PluginsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Complementos
          </DialogTitle>
          <DialogDescription>
            Activa capacidades extra para tus conversaciones normales. En el
            modo Investigación avanzada siempre se usan razonamiento y búsqueda
            web.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <div className="flex items-start justify-between gap-4 rounded-xl border p-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Brain className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Razonamiento profundo
              </div>
              <p className="text-xs text-muted-foreground">
                La IA piensa paso a paso antes de responder. Ideal para
                problemas complejos, aunque la respuesta tarda un poco más.
              </p>
            </div>
            <Switch
              checked={plugins.thinking}
              onCheckedChange={(v) => onChangePlugin("thinking", v)}
              aria-label="Activar razonamiento profundo"
            />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-xl border p-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Globe className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Búsqueda web
              </div>
              <p className="text-xs text-muted-foreground">
                Consulta internet en cada mensaje para dar respuestas
                actualizadas, con las fuentes citadas al final.
              </p>
            </div>
            <Switch
              checked={plugins.webSearch}
              onCheckedChange={(v) => onChangePlugin("webSearch", v)}
              aria-label="Activar búsqueda web"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* =================== ACTIVOS GCR — GRATIS + RECOMPENSA =================== */

const ETHEREUM_CHAIN_ID = "0x1";

const fmtNum = (n: number) =>
  n.toLocaleString("es-PE", { maximumFractionDigits: 4 });

const formatHm = (totalSeconds: number) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
};

interface GcrAsset {
  name: string;
  symbol: string;
  contract: string;
  reward: number;
}

const GCR_ASSETS: GcrAsset[] = [
  {
    name: "GCR Master",
    symbol: "GCRM",
    contract: "0x2Ae2d0DFdB1B3b03A771167c43b983A97b65B9B3",
    reward: GCRM_PER_CYCLE,
  },
  {
    name: "QFS",
    symbol: "QFS",
    contract: "0x7C670A7EBa354E0d22F0ecBBE7A36BF10dCE305E",
    reward: QFS_PER_CYCLE,
  },
];

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

const shortenAddress = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

interface GcrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Segundos de uso acumulados hacia el próximo pago */
  usageSeconds: number;
  /** Recompensas acumuladas de la billetera conectada (null si no hay) */
  rewardState: RewardState | null;
  /** Notifica a la app cada cambio de conexión de la billetera */
  onWalletChange?: (address: string | null) => void;
}

export function GcrDialog({
  open,
  onOpenChange,
  usageSeconds,
  rewardState,
  onWalletChange,
}: GcrDialogProps) {
  const { toast } = useToast();
  const [address, setAddress] = useState<string | null>(null);
  const [chainOk, setChainOk] = useState<boolean | null>(null);
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [connecting, setConnecting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [hasWallet, setHasWallet] = useState(false);

  useEffect(() => {
    setHasWallet(typeof window !== "undefined" && !!window.ethereum);
  }, [open]);

  const loadWalletData = useCallback(
    async (addr: string, eth: Eip1193Provider) => {
      try {
        const chainId = (await eth.request({ method: "eth_chainId" })) as string;
        const onMainnet = chainId === ETHEREUM_CHAIN_ID;
        setChainOk(onMainnet);
        if (!onMainnet) {
          setBalances({});
          return;
        }
        const results: Record<string, string> = {};
        for (const asset of GCR_ASSETS) {
          try {
            let dec = 18;
            try {
              const decHex = (await eth.request({
                method: "eth_call",
                params: [{ to: asset.contract, data: "0x313ce567" }, "latest"],
              })) as string;
              if (decHex && decHex !== "0x") dec = parseInt(decHex, 16) || 18;
            } catch {
              /* el contrato no expone decimals(); se usa 18 */
            }
            const callData =
              "0x70a08231" +
              addr.toLowerCase().replace("0x", "").padStart(64, "0");
            const balHex = (await eth.request({
              method: "eth_call",
              params: [{ to: asset.contract, data: callData }, "latest"],
            })) as string;
            const raw = BigInt(balHex && balHex !== "0x" ? balHex : "0x0");
            const value = Number(raw) / 10 ** dec;
            results[asset.contract] = value.toLocaleString("es-PE", {
              maximumFractionDigits: 4,
            });
          } catch {
            /* activo no leíble en este momento */
          }
        }
        setBalances(results);
      } catch {
        setChainOk(null);
        setBalances({});
      }
    },
    []
  );

  /* Restaurar la conexión silenciosamente al abrir el diálogo */
  useEffect(() => {
    if (!open) return;
    const eth = window.ethereum;
    if (!eth) return;
    (async () => {
      try {
        const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
        const addr = accounts?.[0];
        if (!addr) return;
        setAddress(addr);
        await loadWalletData(addr, eth);
        onWalletChange?.(addr);
      } catch {
        /* sin permiso previo de la billetera */
      }
    })();
  }, [open, loadWalletData]);

  const connectWallet = async () => {
    const eth = window.ethereum;
    if (!eth) return;
    setConnecting(true);
    try {
      const accounts = (await eth.request({
        method: "eth_requestAccounts",
      })) as string[];
      const addr = accounts?.[0];
      if (!addr) throw new Error("sin-cuentas");
      setAddress(addr);
      try {
        localStorage.setItem("master-ia-wallet", addr);
      } catch {
        /* almacenamiento no disponible */
      }
      await loadWalletData(addr, eth);
      onWalletChange?.(addr);
      toast({
        title: "Billetera conectada",
        description: `Gana ${fmtNum(QFS_PER_CYCLE)} QFS y ${fmtNum(
          GCRM_PER_CYCLE
        )} GCRM por cada 5 horas de uso.`,
      });
    } catch {
      toast({
        title: "Conexión cancelada",
        description: "No se pudo conectar la billetera. Inténtalo de nuevo.",
      });
    } finally {
      setConnecting(false);
    }
  };

  const switchToEthereum = async () => {
    const eth = window.ethereum;
    if (!eth) return;
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ETHEREUM_CHAIN_ID }],
      });
      if (address) await loadWalletData(address, eth);
    } catch {
      toast({
        title: "No se pudo cambiar la red",
        description: "Selecciona Ethereum Mainnet manualmente en tu billetera.",
      });
    }
  };

  const addTokenToWallet = async (asset: GcrAsset) => {
    const eth = window.ethereum;
    if (!eth || !chainOk) return;
    let dec = 18;
    try {
      const decHex = (await eth.request({
        method: "eth_call",
        params: [{ to: asset.contract, data: "0x313ce567" }, "latest"],
      })) as string;
      if (decHex && decHex !== "0x") dec = parseInt(decHex, 16) || 18;
    } catch {
      /* el contrato no expone decimals(); se usa 18 */
    }
    try {
      const wasAdded = (await eth.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: { address: asset.contract, symbol: asset.symbol, decimals: dec },
        },
      })) as boolean;
      if (wasAdded) {
        toast({
          title: "Token añadido",
          description: `${asset.symbol} ya aparece en tu billetera.`,
        });
      }
    } catch {
      toast({
        title: "No se pudo añadir",
        description: "Tu billetera rechazó la solicitud del token.",
      });
    }
  };

  const copyContract = async (contract: string) => {
    try {
      await navigator.clipboard.writeText(contract);
      setCopied(contract);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* portapapeles no disponible */
    }
  };

  const disconnectWallet = () => {
    setAddress(null);
    setBalances({});
    setChainOk(null);
    onWalletChange?.(null);
    try {
      localStorage.removeItem("master-ia-wallet");
    } catch {
      /* almacenamiento no disponible */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gem className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Master IA es 100% gratis
          </DialogTitle>
          <DialogDescription>
            Sin pago de licencia ni suscripciones: todas las funciones son
            gratuitas. Conecta tus activos GCR Master y QFS en red Ethereum:
            por cada 5 horas de uso recibes {fmtNum(QFS_PER_CYCLE)} QFS y{" "}
            {fmtNum(GCRM_PER_CYCLE)} GCRM.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tarjetas de los activos */}
          {GCR_ASSETS.map((asset) => (
            <div
              key={asset.contract}
              className="space-y-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-sm font-bold text-white"
                    aria-hidden="true"
                  >
                    {asset.name.charAt(0)}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{asset.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Símbolo {asset.symbol} · Red Ethereum (ERC-20)
                    </p>
                  </div>
                </div>
                {asset.reward > 0 && (
                  <Badge className="shrink-0 gap-1 bg-emerald-600 text-white hover:bg-emerald-600">
                    <Gift className="h-3 w-3" aria-hidden="true" />
                    +{fmtNum(asset.reward)} / 5 h
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-1.5 rounded-xl border bg-background/60 p-2">
                <p className="min-w-0 flex-1 truncate px-1 font-mono text-[0.68rem] text-muted-foreground">
                  {asset.contract}
                </p>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  onClick={() => copyContract(asset.contract)}
                  aria-label={`Copiar dirección del contrato ${asset.symbol}`}
                >
                  {copied === asset.contract ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
                <a
                  href={`https://etherscan.io/address/${asset.contract}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg hover:bg-accent"
                  aria-label={`Ver el contrato ${asset.symbol} en Etherscan`}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

              {address && chainOk && balances[asset.contract] !== undefined && (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">Saldo en tu billetera</span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold">
                      {balances[asset.contract]} {asset.symbol}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 cursor-pointer px-2 text-xs"
                      onClick={() => addTokenToWallet(asset)}
                    >
                      <Coins className="h-3 w-3" aria-hidden="true" />
                      Añadir
                    </Button>
                  </span>
                </div>
              )}
            </div>
          ))}

          {/* Conexión de billetera */}
          {!address ? (
            hasWallet ? (
              <Button
                onClick={connectWallet}
                disabled={connecting}
                className="w-full cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {connecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Wallet className="h-4 w-4" aria-hidden="true" />
                )}
                {connecting ? "Conectando…" : "Conectar billetera Ethereum"}
              </Button>
            ) : (
              <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">
                <Button variant="outline" className="w-full cursor-pointer">
                  <Wallet className="h-4 w-4" aria-hidden="true" />
                  Instala MetaMask para conectar
                </Button>
              </a>
            )
          ) : (
            <div className="space-y-3 rounded-2xl border p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full bg-emerald-500"
                    aria-hidden="true"
                  />
                  <span className="font-mono text-sm">{shortenAddress(address)}</span>
                </div>
                {chainOk ? (
                  <Badge
                    variant="outline"
                    className="border-emerald-500/50 text-emerald-700 dark:text-emerald-300"
                  >
                    Ethereum
                  </Badge>
                ) : (
                  <Badge variant="destructive">Red incorrecta</Badge>
                )}
              </div>

              {/* Progreso hacia la próxima recompensa por tiempo de uso */}
              <div className="space-y-2 rounded-xl border bg-background/60 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Próximo pago por uso
                  </span>
                  <span className="font-medium">
                    {formatHm(usageSeconds)} de 5 h
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-600"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.floor((usageSeconds / CYCLE_SECONDS) * 100)
                      )}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Recompensas acumuladas
                  </span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {fmtNum(rewardState?.qfs ?? 0)} QFS ·{" "}
                    {fmtNum(rewardState?.gcrm ?? 0)} GCRM
                  </span>
                </div>
              </div>

              {!chainOk && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full cursor-pointer"
                  onClick={switchToEthereum}
                >
                  Cambiar a Ethereum Mainnet
                </Button>
              )}

              <Button
                size="sm"
                variant="ghost"
                className="w-full cursor-pointer text-destructive hover:text-destructive"
                onClick={disconnectWallet}
              >
                Desconectar
              </Button>
            </div>
          )}

          <p className="text-center text-[0.7rem] text-muted-foreground">
            Conexión de solo lectura: nunca pedimos tu frase semilla ni firmamos
            transacciones.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* =================== AYUDA =================== */

const FAQS = [
  {
    q: "¿Cómo envío un mensaje?",
    a: "Escribe en el cuadro de texto inferior y pulsa Enter o el botón de enviar. Usa Shift + Enter para añadir un salto de línea.",
  },
  {
    q: "¿Cómo genero imágenes?",
    a: "Selecciona «Imágenes» en el menú lateral, describe lo que quieres ver y pulsa enviar. La imagen aparecerá en la conversación.",
  },
  {
    q: "¿Qué es la investigación avanzada?",
    a: "Es un modo que busca información en la web, analiza las páginas más relevantes y redacta un informe completo con fuentes citadas.",
  },
  {
    q: "¿Dónde se guardan mis conversaciones?",
    a: "Se guardan automáticamente en este dispositivo. Puedes renombrarlas o eliminarlas desde el historial, o borrarlas todas desde Configuración.",
  },
];

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto thin-scroll sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Ayuda
          </DialogTitle>
          <DialogDescription>
            Preguntas frecuentes sobre Master IA.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {FAQS.map((faq) => (
            <div key={faq.q} className="rounded-xl border p-4">
              <p className="mb-1 text-sm font-medium">{faq.q}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {faq.a}
              </p>
            </div>
          ))}

          <div className="rounded-xl border p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Keyboard className="h-4 w-4" />
              Atajos de teclado
            </p>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-center justify-between">
                <span>Enviar mensaje</span>
                <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[0.7rem]">
                  Enter
                </kbd>
              </li>
              <li className="flex items-center justify-between">
                <span>Nueva línea</span>
                <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[0.7rem]">
                  Shift + Enter
                </kbd>
              </li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* =================== CONFIGURACIÓN =================== */

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteAll: () => Promise<void>;
  plugins: Plugins;
  onChangePlugin: (key: keyof Plugins, value: boolean) => void;
}

export function SettingsDialog({
  open,
  onOpenChange,
  onDeleteAll,
  plugins,
  onChangePlugin,
}: SettingsDialogProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      await onDeleteAll();
      setConfirmOpen(false);
      toast({ title: "Se borraron todas las conversaciones" });
      onOpenChange(false);
    } catch {
      toast({
        title: "Error",
        description: "No se pudieron borrar las conversaciones",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Configuración
            </DialogTitle>
            <DialogDescription>
              Personaliza Master IA a tu gusto.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Tema */}
            <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
              <div>
                <p className="text-sm font-medium">Apariencia</p>
                <p className="text-xs text-muted-foreground">
                  Elige el tema de la interfaz
                </p>
              </div>
              <div className="flex gap-1 rounded-lg border p-1">
                {(["light", "dark", "system"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTheme(t)}
                    className={`rounded-md px-2.5 py-1 text-xs transition-colors cursor-pointer ${
                      resolvedTheme === t ||
                      (t === "system" &&
                        !["light", "dark"].includes(resolvedTheme ?? ""))
                        ? "bg-emerald-600 text-white"
                        : "hover:bg-muted"
                    }`}
                  >
                    {t === "light"
                      ? "Claro"
                      : t === "dark"
                      ? "Oscuro"
                      : "Sistema"}
                  </button>
                ))}
              </div>
            </div>

            {/* Complementos rápidos */}
            <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
              <div>
                <p className="text-sm font-medium">Búsqueda web</p>
                <p className="text-xs text-muted-foreground">
                  Respuestas con información actualizada
                </p>
              </div>
              <Switch
                checked={plugins.webSearch}
                onCheckedChange={(v) => onChangePlugin("webSearch", v)}
                aria-label="Activar búsqueda web"
              />
            </div>

            <Separator />

            {/* Zona de peligro */}
            <div className="flex items-center justify-between gap-4 rounded-xl border border-destructive/40 p-4">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <Trash2 className="h-4 w-4" />
                  Borrar todas las conversaciones
                </p>
                <p className="text-xs text-muted-foreground">
                  Esta acción no se puede deshacer
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmOpen(true)}
              >
                Borrar
              </Button>
            </div>

            <p className="text-center text-[0.7rem] text-muted-foreground">
              Master IA v1.0 · Modelo GLM · Hecho con Next.js
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar todas las conversaciones?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán permanentemente todas tus conversaciones y mensajes.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteAll();
              }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Borrando…
                </>
              ) : (
                "Sí, borrar todo"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
