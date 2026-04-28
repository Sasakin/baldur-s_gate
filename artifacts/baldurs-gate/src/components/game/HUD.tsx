import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { LocalGameState } from "../../lib/types";
import { useIsMobile } from "../../hooks/use-mobile";

interface Props {
  state: LocalGameState;
  onSetState: (state: LocalGameState) => void;
}

export function HUD({ state, onSetState }: Props) {
  const [saving, setSaving] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const isMobile = useIsMobile();

  const handleSave = async () => {
    setSaving(true);
    try {
      const { appState, combat, logs, exploredTiles, ...apiState } = state;
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      await fetch(`${base}/api/game/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId: 1, gameState: apiState }),
      });
      localStorage.setItem("cotfr_save", JSON.stringify(state));
    } catch {
      localStorage.setItem("cotfr_save", JSON.stringify(state));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <div className="absolute top-0 inset-x-0 p-2 md:p-4 flex justify-between items-start pointer-events-none z-20">
        <div className="flex gap-1.5 md:gap-2 pointer-events-auto">
          <button
            onClick={() => onSetState({ ...state, appState: "INVENTORY" })}
            className="rpg-button w-10 h-10 md:w-auto md:py-2 md:px-4 flex items-center justify-center text-xs touch-manipulation shadow-lg"
            title="Инвентарь"
          >
            {isMobile ? "🎒" : "Инвентарь"}
          </button>
          <button
            onClick={() => onSetState({ ...state, appState: "QUESTS" })}
            className="rpg-button w-10 h-10 md:w-auto md:py-2 md:px-4 flex items-center justify-center text-xs touch-manipulation shadow-lg"
            title="Задания"
          >
            {isMobile ? "📜" : "Задания"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rpg-button w-10 h-10 md:w-auto md:py-2 md:px-4 flex items-center justify-center text-xs bg-red-900 touch-manipulation shadow-lg"
            title="Сохранить"
          >
            {saving ? "…" : isMobile ? "💾" : "Сохранить"}
          </button>
        </div>

        <div className="parchment-bg gothic-border px-3 py-1 md:px-4 md:py-2 text-right">
          <div className="text-base md:text-xl font-display text-[var(--color-rpg-blood)] font-bold">
            {state.party[0]?.gold || 0} G
          </div>
        </div>
      </div>

      {/* ── Bottom Interface ─────────────────────────────────────────────────── */}
      <div className="absolute bottom-6 left-6 flex flex-col gap-3 pointer-events-none z-20">
        
        {/* Party Status (Vertical stack like Heroes) */}
        {state.party.map((char) => (
          <div
            key={char.id}
            className={`group flex items-center gap-3 transition-all duration-500 pointer-events-auto ${!char.alive ? "grayscale opacity-30" : ""}`}
          >
            {/* Avatar Circle */}
            <div 
              className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/40 backdrop-blur-2xl border border-white/5 flex items-center justify-center text-lg relative overflow-hidden shadow-2xl transition-transform hover:scale-110"
              title={`${char.name} (${char.hp}/${char.maxHp} HP)`}
            >
              <span className="font-display text-[var(--color-rpg-gold-dim)] group-hover:text-[var(--color-rpg-gold)] transition-colors">{char.name[0]}</span>
              
              {/* Circular HP progress (painterly border) */}
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="47" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                <motion.circle 
                  cx="50" cy="50" r="47" fill="none" stroke={char.hp / char.maxHp > 0.4 ? "#10b981" : "#ef4444"} strokeWidth="4" 
                  strokeDasharray="295" 
                  initial={{ strokeDashoffset: 295 }}
                  animate={{ strokeDashoffset: 295 - (295 * (char.hp / char.maxHp)) }}
                  transition={{ duration: 1 }}
                />
              </svg>
            </div>

            {/* Float Tag (visible on hover or focus) */}
            <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-md px-2 py-1 rounded border border-white/10">
              <span className="text-[10px] font-bold text-white tracking-widest uppercase">{char.name.split(' ')[0]}</span>
              <span className="text-[9px] text-white/50 font-mono">{char.hp}<span className="text-white/20">/</span>{char.maxHp} HP</span>
            </div>
          </div>
        ))}
      </div>

      {/* Floating Log Toggle (Bottom Right) */}
      <div className="absolute bottom-6 right-6 pointer-events-auto z-20 flex flex-col items-end">
        <AnimatePresence>
          {logOpen && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="w-64 bg-black/80 backdrop-blur-3xl border border-white/5 rounded p-3 shadow-2xl mb-3 overflow-y-auto max-h-48"
              style={{ scrollbarWidth: "none" }}
            >
              <div className="text-[8px] font-bold text-white/40 mb-2 uppercase tracking-widest border-b border-white/10 pb-1">
                Хроника
              </div>
              {state.logs.slice(-12).map((log, i) => (
                <div key={i} className="text-[10px] text-gray-400 py-1 border-b border-white/5 last:border-0 leading-tight">
                  {log}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={() => setLogOpen(v => !v)}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-sm shadow-2xl hover:bg-black/60 transition-colors"
        >
          {logOpen ? "✕" : "📜"}
        </button>
      </div>

    </>
  );
}
