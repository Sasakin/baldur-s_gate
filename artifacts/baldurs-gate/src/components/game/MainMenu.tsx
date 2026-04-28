import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { LocalGameState } from "../../lib/types";
import { useAudio } from "../../hooks/useAudio";

const LOCAL_SAVE_KEY = "cotfr_save";

interface Props {
  onNewGame:  () => void;
  onLoadGame: (state: LocalGameState) => void;
}

export function MainMenu({ onNewGame, onLoadGame }: Props) {
  const [hasSave, setHasSave]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState<string | null>(null);
  const { playSFX, resume } = useAudio();

  // Check for a local save on mount (instant, no network needed)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCAL_SAVE_KEY);
      setHasSave(!!raw);
    } catch { /* storage not available */ }
  }, []);

  const handleContinue = async () => {
    setError(null);
    setLoading(true);

    try {
      // ── 1. Try localStorage first (always available, no DB needed) ──────
      const raw = localStorage.getItem(LOCAL_SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as LocalGameState;
        onLoadGame(parsed);
        return;
      }

      // ── 2. Fall back to API cloud save ───────────────────────────────────
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const res  = await fetch(`${base}/api/game/load`, { signal: AbortSignal.timeout(6000) });

      if (res.ok) {
        const data = await res.json();
        if (data?.slots?.length > 0) {
          const apiState = data.slots[0].gameState as LocalGameState;
          onLoadGame({
            ...apiState,
            appState:      "EXPLORATION",
            logs:          ["Игра загружена из облака."],
            exploredTiles: {},
          });
          return;
        }
      }

      setError("Сохранение не найдено.");
    } catch {
      setError("Не удалось загрузить. Начните новую игру.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black">
      {/* Background art — CSS only, no external image needed */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 60% 50% at 50% 80%, rgba(120,30,10,0.45) 0%, transparent 70%),
            radial-gradient(ellipse 80% 60% at 20% 30%, rgba(10,20,60,0.35) 0%, transparent 60%),
            radial-gradient(ellipse 80% 60% at 80% 30%, rgba(60,10,10,0.35) 0%, transparent 60%),
            linear-gradient(180deg, #050508 0%, #100810 50%, #0a0505 100%)
          `,
        }}
      />

      {/* Animated castle silhouette via CSS */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1280 720'%3E%3Crect width='1280' height='720' fill='none'/%3E%3C!-- left tower --%3E%3Crect x='60' y='200' width='120' height='520' fill='%23111'/%3E%3Crect x='50' y='180' width='30' height='80' fill='%23111'/%3E%3Crect x='90' y='160' width='30' height='100' fill='%23111'/%3E%3Crect x='130' y='175' width='30' height='85' fill='%23111'/%3E%3Crect x='85' y='260' width='30' height='40' fill='%23881111' opacity='0.8'/%3E%3C!-- right tower --%3E%3Crect x='1100' y='200' width='120' height='520' fill='%23111'/%3E%3Crect x='1200' y='180' width='30' height='80' fill='%23111'/%3E%3Crect x='1160' y='160' width='30' height='100' fill='%23111'/%3E%3Crect x='1120' y='175' width='30' height='85' fill='%23111'/%3E%3Crect x='1165' y='260' width='30' height='40' fill='%23881111' opacity='0.8'/%3E%3C!-- main gate --%3E%3Crect x='390' y='350' width='500' height='370' fill='%23111'/%3E%3Crect x='350' y='300' width='40' height='420' fill='%23111'/%3E%3Crect x='890' y='300' width='40' height='420' fill='%23111'/%3E%3Cellipse cx='640' cy='430' rx='90' ry='110' fill='%230a0a0a'/%3E%3C/svg%3E")`,
          backgroundSize: "100% 100%",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.5 }}
        className="relative z-10 flex flex-col items-center max-w-lg w-full p-6 md:p-12 gothic-border bg-black/80 backdrop-blur-sm text-center mx-4"
      >
        <h1 className="text-3xl md:text-5xl font-display text-primary-foreground mb-4 drop-shadow-[0_0_10px_rgba(255,215,0,0.5)] leading-tight">
          Chronicles of the<br />
          <span className="text-[var(--color-rpg-gold)]">Forgotten Realm</span>
        </h1>
        <p className="text-sm md:text-base text-muted-foreground italic mb-8 md:mb-12">A tale of darkness, heroes, and destiny.</p>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-4 px-4 py-2 bg-red-900/40 border border-red-700/50 text-red-300 text-sm rounded-sm w-full"
          >
            {error}
          </motion.div>
        )}

        <div className="flex flex-col gap-4 w-full px-8">
          <button onClick={() => { playSFX('click'); onNewGame(); }} className="rpg-button w-full">
            New Game
          </button>

          <button
            onClick={() => { playSFX('click'); handleContinue(); }}
            disabled={loading}
            className="rpg-button w-full"
          >
            {loading ? "Loading…" : hasSave ? "Continue Journey" : "Continue Journey"}
          </button>

          <button
            className="rpg-button w-full opacity-40 cursor-not-allowed"
            disabled
          >
            Settings
          </button>
        </div>

        {hasSave && (
          <p className="mt-4 text-[10px] text-gray-600 uppercase tracking-widest">
            Сохранение найдено
          </p>
        )}
      </motion.div>
    </div>
  );
}
