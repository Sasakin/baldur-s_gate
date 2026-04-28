/**
 * CombatPanel — overlay HUD atop CombatArena.
 * Responsibility: turn order strip, action buttons, combat log, pause overlay.
 * Enemy cards and party floats live in CombatArena (proper sorting layer).
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LocalGameState, ActionType, CLASS_SKILLS, StatusEffectType,
  getAttackCount,
} from "../../lib/types";
import { useIsMobile } from "../../hooks/use-mobile";
import { useAudio } from "../../hooks/useAudio";

interface Props {
  state:          LocalGameState;
  onSelectAction: (action: ActionType) => void;
  onSelectTarget: (targetId: string) => void;
}

const CLASS_COLORS: Record<string, string> = {
  warrior: "#4488FF",
  mage:    "#AA44FF",
  rogue:   "#44DD88",
  cleric:  "#FFCC44",
};

export function CombatPanel({ state, onSelectAction, onSelectTarget }: Props) {
  const combat    = state.combat;
  const logRef    = useRef<HTMLDivElement>(null);
  const isMobile  = useIsMobile();
  const [logOpen, setLogOpen] = useState(false);
  const { playSFX } = useAudio();

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [combat?.log.length]);

  if (!combat) return null;

  const currentTurnId   = combat.turnOrder[combat.currentTurnIndex];
  const isPlayerPhase   = combat.phase === "PICK_ACTION" || combat.phase === "PICK_TARGET";
  const isPickingTarget = combat.phase === "PICK_TARGET";
  const activeChar      = combat.party.find(p => p.id === currentTurnId);
  const skills          = activeChar ? CLASS_SKILLS[activeChar.class] : null;
  const hasHpPotion     = state.inventory.some(i => i.id === "hp_potion" && i.quantity > 0);
  const aliveCount      = combat.party.filter(p => p.alive).length;
  const isFlanking      = aliveCount >= 2;
  const attackCount     = activeChar ? getAttackCount(activeChar) : 1;

  return (
    <div className="absolute inset-0 pointer-events-none z-30 flex flex-col">

      {/* ── Pause overlay ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {combat.paused && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center pointer-events-auto bg-black/70 backdrop-blur-sm"
          >
            <div className="parchment-bg gothic-border px-12 py-8 text-center">
              <div className="text-4xl font-display text-[var(--color-rpg-gold)] mb-3 tracking-widest">ПАУЗА</div>
              <div className="text-sm text-gray-400">
                {isMobile
                  ? <button onClick={() => {}} className="rpg-button px-4 py-1 text-xs mt-2">Продолжить</button>
                  : <>Нажмите <kbd className="bg-gray-700 px-2 py-0.5 rounded text-white text-xs">Пробел</kbd> для продолжения</>
                }
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TOP: Turn order strip ─────────────────────────────────────────── */}
      <div className="pointer-events-auto flex justify-center items-center pt-2 pb-1 gap-1 px-2 md:px-4 flex-wrap bg-gradient-to-b from-black/60 to-transparent">
        {combat.turnOrder.map((id, idx) => {
          const entity    = [...combat.party, ...combat.enemies].find(e => e.id === id);
          if (!entity) return null;
          const isCurrent = idx === combat.currentTurnIndex;
          const isDead    = !entity.alive;
          const color     = entity.isEnemy ? "#cc3333" : CLASS_COLORS[entity.class] ?? "#4488FF";
          const isCasting = !entity.isEnemy && entity.castingSkillId;

          return (
            <motion.div
              key={id}
              animate={{ scale: isCurrent ? 1.2 : 1, opacity: isDead ? 0.25 : 1 }}
              className="flex flex-col items-center"
            >
              <div
                className={`relative rounded-full border-2 flex items-center justify-center font-bold overflow-hidden
                  ${isMobile ? "w-7 h-7 text-[9px]" : "w-10 h-10 text-xs"}`}
                style={{
                  borderColor:     isCurrent ? "#FFD700" : "rgba(255,255,255,0.2)",
                  backgroundColor: `${color}22`,
                  color,
                  boxShadow: isCurrent ? `0 0 12px ${color}, 0 0 24px ${color}44` : "none",
                }}
              >
                {entity.name.slice(0, 2).toUpperCase()}
                {isCasting && (
                  <div className="absolute inset-0 bg-purple-900/50 flex items-center justify-center text-[7px] animate-pulse">✨</div>
                )}
              </div>
              {isCurrent && <div className="w-1 h-1 rounded-full bg-yellow-400 mt-0.5 animate-pulse" />}
            </motion.div>
          );
        })}

        {/* Round counter */}
        <div className="ml-1 md:ml-2 flex flex-col gap-0.5 self-center">
          <div className="parchment-bg px-1.5 md:px-2 py-0.5 text-[10px] md:text-xs font-bold text-[var(--color-rpg-blood)] gothic-border">
            R{combat.round}
          </div>
          {isFlanking && isPlayerPhase && !isMobile && (
            <div className="text-[9px] text-yellow-400 text-center animate-pulse">⚔ Окружение +2</div>
          )}
        </div>

        {/* Pause hint / button */}
        {isMobile ? (
          <button
            className="ml-1 self-center pointer-events-auto rpg-button w-8 h-8 flex items-center justify-center text-xs touch-manipulation shadow-md"
            onClick={() => {/* pause handled locally if needed, usually global or state-based */}}
          >
            ⏸
          </button>
        ) : (
          <div className="ml-2 self-center text-[9px] text-gray-600">[Пробел = пауза]</div>
        )}
      </div>

      {/* ── MIDDLE: spacer ────────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── BOTTOM: Action area (Minimal Floating Bar) ───────────────────── */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-fit px-4 pointer-events-none z-50">
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="pointer-events-auto bg-black/40 backdrop-blur-3xl border border-white/5 rounded-full px-2 py-2 shadow-2xl flex items-center gap-1"
        >
          {isPlayerPhase && activeChar && !isPickingTarget ? (
            <div className="flex items-center gap-1">
              <div className="flex flex-col items-center mr-1 pr-2 border-r border-white/10">
                 <span className="text-[8px] font-bold text-white/40 uppercase tracking-tighter">{activeChar.name.split(' ')[0]}</span>
              </div>
              
              <ActionBtn
                icon="⚔️" label="" color="#cc4444"
                sub={attackCount > 1 ? `${attackCount}` : ""}
                onClick={() => { playSFX('click'); onSelectAction("ATTACK"); }}
                mobile={isMobile}
              />
              {skills?.[0] && (
                <ActionBtn
                  icon={skills[0].icon} label="" color="#8844cc"
                  sub={skills[0].mpCost > 0 ? `${skills[0].mpCost}` : ""}
                  disabled={(activeChar.mp ?? 0) < skills[0].mpCost}
                  castTime={skills[0].castTime}
                  onClick={() => { playSFX('click'); onSelectAction("SKILL_1"); }}
                  mobile={isMobile}
                />
              )}
              {skills?.[1] && (
                <ActionBtn
                  icon={skills[1].icon} label="" color="#448844"
                  sub={skills[1].mpCost > 0 ? `${skills[1].mpCost}` : ""}
                  disabled={(activeChar.mp ?? 0) < skills[1].mpCost}
                  castTime={skills[1].castTime}
                  onClick={() => { playSFX('click'); onSelectAction("SKILL_2"); }}
                  mobile={isMobile}
                />
              )}
              <ActionBtn
                icon="🧪" label="" color="#225588"
                sub={hasHpPotion ? `${state.inventory.find(i => i.id === "hp_potion")?.quantity}` : ""}
                disabled={!hasHpPotion}
                onClick={() => { playSFX('click'); onSelectAction("USE_ITEM"); }}
                mobile={isMobile}
              />
              <ActionBtn
                icon="🛡️" label="" color="#445577"
                onClick={() => { playSFX('click'); onSelectAction("DEFEND"); }}
                mobile={isMobile}
              />
              <ActionBtn
                icon="💨" label="" color="#445544"
                onClick={() => { playSFX('click'); onSelectAction("FLEE"); }}
                mobile={isMobile}
              />
            </div>
          ) : isPickingTarget ? (
             <div className="px-4 py-1 text-red-500 font-bold text-[9px] animate-pulse tracking-widest uppercase">
               TARGET...
             </div>
          ) : combat.phase === "ENEMY_TURN" ? (
             <div className="px-4 py-1 text-white/30 text-[8px] uppercase font-bold tracking-widest">
               ENEMY...
             </div>
          ) : null}
        </motion.div>
      </div>

      {/* ── Combat log — desktop: fixed right panel | mobile: toggle overlay ── */}
      <div className={`absolute right-3 top-16 pointer-events-auto flex flex-col items-end gap-1 ${isMobile ? "z-40" : ""}`}>
        <button
          onClick={() => { playSFX('click'); setLogOpen(v => !v); }}
          className="rpg-button py-1 px-3 text-[10px] uppercase font-bold tracking-widest shadow-lg bg-black/80"
        >
          {logOpen ? "Закрыть журнал ✕" : "Журнал боя 📋"}
        </button>
        
        <AnimatePresence>
          {logOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              ref={logRef}
              className={`
                bg-black/90 backdrop-blur-md border border-[var(--color-rpg-gold-dim)]/40 rounded-sm p-3 overflow-y-auto shadow-2xl
                ${isMobile ? "w-64 max-h-56" : "w-72 max-h-[400px]"}
              `}
              style={{ scrollbarWidth: "none" }}
            >
              <div className="text-[10px] font-bold text-[var(--color-rpg-gold-dim)] mb-2 uppercase tracking-widest border-b border-white/10 pb-1">
                Хроника сражения
              </div>
              {combat.log.slice(-50).map((line, i) => {
                const isCrit  = line.includes("КРИТ");
                const isMiss  = line.includes("промах") || line.includes("МИМО");
                const isHeal  = line.includes("восстанавл");
                const isDeath = line.includes("побеждён") || line.includes("пал");
                return (
                  <div
                    key={i}
                    className={`text-[11px] py-0.5 border-b border-white/5 leading-tight
                      ${isCrit  ? "text-orange-400 font-bold"  : ""}
                      ${isMiss  ? "text-gray-500 italic"        : ""}
                      ${isHeal  ? "text-green-400"              : ""}
                      ${isDeath ? "text-red-500 font-bold"      : ""}
                      ${!isCrit && !isMiss && !isHeal && !isDeath ? "text-gray-300" : ""}
                    `}
                  >
                    {line}
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Action button ─────────────────────────────────────────────────────────────

function ActionBtn({
  icon, label, color, sub, onClick, disabled, castTime, mobile,
}: {
  icon: string; label: string; color: string; sub?: string;
  onClick: () => void; disabled?: boolean; castTime?: number; mobile?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative flex flex-col items-center gap-0.5 gothic-border transition-all touch-manipulation
        ${mobile ? "px-2 py-2 min-w-[56px]" : "px-3 py-2 min-w-[72px]"}
        ${disabled
          ? "opacity-40 cursor-not-allowed bg-black/40"
          : "bg-[var(--color-rpg-panel)] hover:scale-105 active:scale-95 cursor-pointer hover:brightness-125"
        }
      `}
      style={{ borderColor: disabled ? "#333" : `${color}66` }}
    >
      <span className={`leading-none ${mobile ? "text-lg" : "text-xl"}`}>{icon}</span>
      <span
        className={`font-bold uppercase tracking-wide ${mobile ? "text-[8px]" : "text-[10px]"}`}
        style={{ color }}
      >
        {label}
      </span>
      {sub && (
        <span className={`text-gray-500 ${mobile ? "text-[7px]" : "text-[9px]"}`}>{sub}</span>
      )}
      {castTime && castTime > 0 && (
        <span className="absolute -top-1 -right-1 text-[7px] bg-purple-800 text-purple-200 rounded-full px-1 leading-tight">
          {castTime}х
        </span>
      )}
    </button>
  );
}
