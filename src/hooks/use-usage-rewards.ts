"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";

/* ====== Configuración del ciclo de recompensas ====== */

/** Duración del ciclo de uso: 5 horas en segundos */
export const CYCLE_SECONDS = 5 * 60 * 60;
/** QFS pagados por cada ciclo completado */
export const QFS_PER_CYCLE = 100000;
/** GCRM pagados por cada ciclo completado */
export const GCRM_PER_CYCLE = 0.1;

const REWARDS_KEY = "master-ia-gcr-rewards";
const USAGE_KEY = "master-ia-usage";
const WALLET_KEY = "master-ia-wallet";

export interface RewardState {
  gcrm: number;
  qfs: number;
  cycles: number;
}

export const ZERO_REWARDS: RewardState = { gcrm: 0, qfs: 0, cycles: 0 };

const fmt = (n: number) =>
  n.toLocaleString("es-PE", { maximumFractionDigits: 2 });

const loadRewardStates = (): Record<string, RewardState> => {
  try {
    const raw = localStorage.getItem(REWARDS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, RewardState | number>;
    const out: Record<string, RewardState> = {};
    for (const [key, value] of Object.entries(parsed)) {
      /* Compatibilidad con el formato antiguo (solo número = GCRM) */
      out[key] =
        typeof value === "number"
          ? { gcrm: value, qfs: 0, cycles: 0 }
          : {
              gcrm: value.gcrm ?? 0,
              qfs: value.qfs ?? 0,
              cycles: value.cycles ?? 0,
            };
    }
    return out;
  } catch {
    return {};
  }
};

const persistRewardStates = (states: Record<string, RewardState>) => {
  try {
    localStorage.setItem(REWARDS_KEY, JSON.stringify(states));
  } catch {
    /* almacenamiento no disponible */
  }
};

const loadUsage = (): number => {
  try {
    return Math.max(0, Number(localStorage.getItem(USAGE_KEY)) || 0);
  } catch {
    return 0;
  }
};

const persistUsage = (seconds: number) => {
  try {
    localStorage.setItem(USAGE_KEY, String(Math.floor(seconds)));
  } catch {
    /* almacenamiento no disponible */
  }
};

/**
 * Contador global de tiempo de uso de la app.
 *
 * - Acumula segundos solo mientras la pestaña está visible.
 * - Persiste el contador en localStorage (cada 10 s, al ocultar la pestaña y al cerrar).
 * - Cada vez que se completa un ciclo (5 h) y hay una billetera conectada,
 *   acredita QFS_PER_CYCLE QFS y GCRM_PER_CYCLE GCRM a esa dirección y lo notifica.
 * - Sin billetera conectada el tiempo sigue acumulándose hasta conectar una.
 */
export function useUsageRewards() {
  const { toast } = useToast();
  const [usageSeconds, setUsageSeconds] = useState(0);
  const [wallet, setWallet] = useState<string | null>(null);
  const [rewardStates, setRewardStates] = useState<Record<string, RewardState>>(
    {}
  );

  const usageRef = useRef(0);
  const walletRef = useRef<string | null>(null);
  const statesRef = useRef<Record<string, RewardState>>({});

  /* Carga inicial desde localStorage */
  useEffect(() => {
    usageRef.current = loadUsage();
    statesRef.current = loadRewardStates();
    setUsageSeconds(Math.floor(usageRef.current));
    setRewardStates(statesRef.current);
    try {
      setWallet(localStorage.getItem(WALLET_KEY));
    } catch {
      /* almacenamiento no disponible */
    }

    const flush = () => persistUsage(usageRef.current);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", flush);
      flush();
    };
  }, []);

  useEffect(() => {
    walletRef.current = wallet;
  }, [wallet]);

  useEffect(() => {
    statesRef.current = rewardStates;
  }, [rewardStates]);

  /* Reloj de uso: 1 tick por segundo mientras la pestaña es visible */
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;

      usageRef.current += 1;
      const addr = walletRef.current;

      if (usageRef.current >= CYCLE_SECONDS && addr) {
        usageRef.current -= CYCLE_SECONDS;

        const key = addr.toLowerCase();
        const prev = statesRef.current[key] ?? ZERO_REWARDS;
        const next: RewardState = {
          gcrm: prev.gcrm + GCRM_PER_CYCLE,
          qfs: prev.qfs + QFS_PER_CYCLE,
          cycles: prev.cycles + 1,
        };
        const updated = { ...statesRef.current, [key]: next };
        statesRef.current = updated;
        setRewardStates(updated);
        persistRewardStates(updated);

        toast({
          title: "¡Recompensa por tiempo de uso!",
          description: `+${fmt(QFS_PER_CYCLE)} QFS y +${fmt(
            GCRM_PER_CYCLE
          )} GCRM por completar 5 horas de uso.`,
        });
      }

      if (usageRef.current % 10 === 0) persistUsage(usageRef.current);
      setUsageSeconds(Math.floor(usageRef.current));
    }, 1000);

    return () => clearInterval(id);
  }, [toast]);

  /* El diálogo de activos sincroniza conexiones/desconexiones aquí */
  const syncWallet = useCallback((addr: string | null) => {
    setWallet(addr);
  }, []);

  const rewardState = wallet
    ? (rewardStates[wallet.toLowerCase()] ?? ZERO_REWARDS)
    : null;

  return { usageSeconds, wallet, rewardState, syncWallet };
}
