/**
 * CombatArena — "Battle Space" scene.
 *
 * Architecture (BattleManager pattern):
 *   • UnitSpawner  — maps CombatState.party + CombatState.enemies to on-screen UnitCard components
 *   • Positioning  — desktop: party LEFT / enemies RIGHT; mobile: enemies TOP / party BOTTOM
 *   • Viewport     — arena div frames ALL units (flex full-screen)
 *   • Data channel — receives CombatState directly from LocalGameState (no re-serialisation needed)
 *   • Sorting      — z-index layering: background → party cards → enemy cards → floats → overlay
 */

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef } from "react";
import { LocalGameState, CombatEntity, FloatingText, StatusEffectType } from "../../lib/types";
import { useIsMobile } from "../../hooks/use-mobile";
import { useAudio } from "../../hooks/useAudio";
import { EffectOverlay, EffectOverlayRef } from "./EffectOverlay";

// ── Constants ──────────────────────────────────────────────────────────────────

const CLASS_ICONS: Record<string, string>  = { 
  warrior: "/images_user_upload/warior.jpg", 
  mage: "/images_user_upload/mag.jpg", 
  rogue: "/images_user_upload/warior.jpg", 
  cleric: "/images_user_upload/warior.jpg" 
};
const CLASS_COLORS: Record<string, string> = { warrior: "#4488FF", mage: "#AA44FF", rogue: "#44DD88", cleric: "#FFCC44" };

const STATUS_ICONS: Record<StatusEffectType, string> = {
  stun: "⚡", bleed: "🩸", dodge: "💨", defend: "🛡",
  burn: "🔥", poison: "☠", bless: "✨", fear: "😱",
};

const FLOAT_SIZE_CLASS: Record<string, string> = {
  sm: "text-sm",
  md: "text-base font-bold",
  lg: "text-lg font-bold",
  xl: "text-2xl font-extrabold",
};

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  state:           LocalGameState;
  isPickingTarget: boolean;
  selectedAction:  string | null;
  onSelectTarget:  (id: string) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function CombatArena({ state, isPickingTarget, selectedAction, onSelectTarget }: Props) {
  const combat    = state.combat;
  const isMobile  = useIsMobile();
  const { playSFX } = useAudio();
  const effectRef = useRef<EffectOverlayRef>(null);
  const processedEvents = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!combat?.visualEvents) return;

    combat.visualEvents.forEach(event => {
      if (processedEvents.current.has(event.id)) return;
      processedEvents.current.add(event.id);

      // Play sound based on type
      if (event.type === 'hit')   playSFX('hit');
      if (event.type === 'miss')  playSFX('miss');
      if (event.type === 'magic') playSFX('magic');
      if (event.type === 'blood') playSFX('hit'); // blood usually accompanied by hit sound

      // Trigger visual effect
      if (effectRef.current) {
        // Find rough position of the target
        const isEnemy = combat.enemies.some(e => e.id === event.targetId);
        const entityIndex = isEnemy 
          ? combat.enemies.findIndex(e => e.id === event.targetId)
          : combat.party.findIndex(e => e.id === event.targetId);
        
        let x = 50, y = 50;

        if (isMobile) {
          // Enemies TOP, Party BOTTOM
          x = 20 + (entityIndex % 4) * 20;
          y = isEnemy ? 25 : 75;
        } else {
          // Party LEFT, Enemies RIGHT
          x = isEnemy ? 75 : 25;
          y = 30 + (entityIndex % 4) * 15;
        }

        effectRef.current.spawnEffect(x, y, event.type as any, event.amount);
      }
    });

    // Cleanup old events from set
    if (processedEvents.current.size > 50) {
      const now = Date.now();
      const fresh = combat.visualEvents.map(e => e.id);
      processedEvents.current = new Set(fresh);
    }
  }, [combat?.visualEvents, isMobile, playSFX]);

  if (!combat) return null;

  const currentTurnId = combat.turnOrder[combat.currentTurnIndex];
  const isEnemyTurn   = combat.phase === "ENEMY_TURN";

  const canTargetEnemy = isPickingTarget && (selectedAction === "ATTACK" || selectedAction === "SKILL_1" || selectedAction === "SKILL_2");
  const canTargetAlly  = isPickingTarget && selectedAction === "SKILL_2" &&
    combat.party.find(p => p.id === currentTurnId)?.class === "cleric";

  const floatsFor = (id: string) => combat.floatingTexts.filter(f => f.entityId === id);

  return (
    <motion.div
      key="combat-arena"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="absolute inset-0 flex flex-col"
      style={{
        background: `
          radial-gradient(ellipse 120% 60% at 50% 100%, rgba(80,20,0,0.6) 0%, transparent 70%),
          radial-gradient(ellipse 80% 40% at 20% 50%, rgba(0,20,80,0.3) 0%, transparent 60%),
          radial-gradient(ellipse 80% 40% at 80% 50%, rgba(80,0,0,0.3) 0%, transparent 60%),
          linear-gradient(180deg, #0a0a12 0%, #12080c 40%, #0e0e18 100%)
        `,
      }}
    >
      {/* ── Ground plane ──────────────────────────────────────────────────── */}
      <div
        className={`absolute ${isMobile ? "bottom-36" : "bottom-48"} inset-x-0 h-32 pointer-events-none`}
        style={{
          background: "linear-gradient(0deg, rgba(40,25,15,0.7) 0%, transparent 100%)",
          borderTop: "1px solid rgba(180,140,60,0.15)",
        }}
      />

      <EffectOverlay ref={effectRef} />

      {/* ── Torch sconces (hidden on mobile to save space) ────────────────── */}
      {!isMobile && (
        <>
          <TorchSconce side="left"  />
          <TorchSconce side="right" />
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          DESKTOP layout: party LEFT | VS | enemies RIGHT
          MOBILE layout:  enemies TOP | VS | party BOTTOM
         ════════════════════════════════════════════════════════════════════ */}
      {isMobile ? (
        /* ── MOBILE: vertical stack ──────────────────────────────────────── */
        <div className="flex-1 flex flex-col justify-between px-2 pt-14 pb-36 gap-2">

          {/* Enemies — top */}
          <div className="flex flex-col gap-1.5">
            <div className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-rpg-gold-dim)] text-center">
              Противники
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {combat.enemies.map((enemy, idx) => (
                <UnitCard
                  key={enemy.id}
                  entity={enemy}
                  side="enemy"
                  isActive={enemy.id === currentTurnId && isEnemyTurn}
                  isTargetable={canTargetEnemy && enemy.alive}
                  floats={floatsFor(enemy.id)}
                  index={idx}
                  compact={true}
                  onSelect={() => canTargetEnemy && enemy.alive && onSelectTarget(enemy.id)}
                />
              ))}
            </div>
          </div>

          {/* VS divider */}
          <div className="flex items-center justify-center gap-3 shrink-0">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-red-900/50 to-transparent" />
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ repeat: Infinity, duration: 2.5 }}
              className="text-lg font-display font-black tracking-widest"
              style={{ color: "#8B1A1A", textShadow: "0 0 14px rgba(200,30,30,0.7)" }}
            >
              VS
            </motion.div>
            {isEnemyTurn && (
              <div className="text-[10px] text-red-400 font-bold animate-pulse">☠ Враг</div>
            )}
            <div className="flex-1 h-px bg-gradient-to-l from-transparent via-red-900/50 to-transparent" />
          </div>

          {/* Party — bottom */}
          <div className="flex flex-col gap-1.5">
            <div className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-rpg-gold-dim)] text-center">
              Отряд
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {combat.party.map((member, idx) => (
                <UnitCard
                  key={member.id}
                  entity={member}
                  side="party"
                  isActive={member.id === currentTurnId && !isEnemyTurn}
                  isTargetable={!!canTargetAlly && member.alive}
                  floats={floatsFor(member.id)}
                  index={idx}
                  compact={true}
                  onSelect={() => canTargetAlly && member.alive && onSelectTarget(member.id)}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ── DESKTOP: horizontal layout ──────────────────────────────────── */
        <div className="flex-1 flex items-center justify-between px-8 pt-16 pb-52 gap-4">

          {/* LEFT: Party */}
          <div className="flex flex-col justify-center gap-3 w-[38%]">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-rpg-gold-dim)] mb-1 text-center">
              Отряд
            </div>
            {combat.party.map((member, idx) => (
              <UnitCard
                key={member.id}
                entity={member}
                side="party"
                isActive={member.id === currentTurnId && !isEnemyTurn}
                isTargetable={!!canTargetAlly && member.alive}
                floats={floatsFor(member.id)}
                index={idx}
                compact={false}
                onSelect={() => canTargetAlly && member.alive && onSelectTarget(member.id)}
              />
            ))}
          </div>

          {/* CENTER: VS divider */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 2.5 }}
              className="text-3xl font-display font-black tracking-widest"
              style={{ color: "#8B1A1A", textShadow: "0 0 20px rgba(200,30,30,0.7), 0 0 40px rgba(200,30,30,0.3)" }}
            >
              VS
            </motion.div>
            <div className="w-px h-24 bg-gradient-to-b from-transparent via-red-900/60 to-transparent" />
            <AnimatePresence>
              {isEnemyTurn && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="text-xs text-red-400 font-bold text-center animate-pulse"
                >
                  ☠<br/>Враг<br/>действует
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* RIGHT: Enemies */}
          <div className="flex flex-col justify-center gap-3 w-[38%] items-end">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-rpg-gold-dim)] mb-1 text-center w-full">
              Противники
            </div>
            {combat.enemies.map((enemy, idx) => (
              <UnitCard
                key={enemy.id}
                entity={enemy}
                side="enemy"
                isActive={enemy.id === currentTurnId && isEnemyTurn}
                isTargetable={canTargetEnemy && enemy.alive}
                floats={floatsFor(enemy.id)}
                index={idx}
                compact={false}
                onSelect={() => canTargetEnemy && enemy.alive && onSelectTarget(enemy.id)}
              />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── UnitCard ──────────────────────────────────────────────────────────────────

interface UnitCardProps {
  entity:       CombatEntity;
  side:         "party" | "enemy";
  isActive:     boolean;
  isTargetable: boolean;
  floats:       FloatingText[];
  index:        number;
  compact:      boolean;
  onSelect:     () => void;
}

function UnitCard({ entity, side, isActive, isTargetable, floats, index, compact, onSelect }: UnitCardProps) {
  const isParty   = side === "party";
  const isDead    = !entity.alive;
  const isCasting = !!entity.castingSkillId;

  const color = isParty ? (CLASS_COLORS[entity.class] ?? "#4488FF") : "#CC3333";
  const icon  = isParty ? CLASS_ICONS[entity.class] : "/images_user_upload/skeleton.jpg";

  return (
    <motion.div
      key={entity.id}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: isDead ? 0.35 : 1 }}
      transition={{ delay: index * 0.05 }}
      onClick={onSelect}
      className={`
        relative flex flex-col items-center group
        ${isTargetable ? "cursor-crosshair" : "cursor-default"}
        ${isDead ? "grayscale" : ""}
      `}
    >
      {/* Target indicator */}
      <AnimatePresence>
        {isTargetable && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: [1, 1.2, 1], opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ repeat: Infinity, duration: 1 }}
            className="absolute -inset-1 border-2 border-red-500 rounded-full z-10 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Avatar Circle */}
      <div 
        className={`
          relative rounded-full flex items-center justify-center transition-all duration-300
          ${compact ? "w-10 h-10 text-base" : "w-12 h-12 text-lg"}
          ${isActive ? "ring-2 ring-yellow-400 ring-offset-1 ring-offset-black" : "ring-1 ring-white/5"}
          bg-black/40 backdrop-blur-md overflow-hidden group-hover:bg-black/60
        `}
        style={{ 
          boxShadow: isActive ? `0 0 15px ${color}44` : "none",
          border: `1px solid ${color}22`
        }}
      >
        <div className="absolute inset-0 opacity-10" style={{ backgroundColor: color }} />
        {icon.startsWith("/") ? (
          <img src={icon} alt="" className="w-full h-full object-contain" />
        ) : (
          icon
        )}

        {/* HP Arc (SVG) */}
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
           <circle
             cx="50" cy="50" r="48"
             fill="none"
             stroke="rgba(0,0,0,0.2)"
             strokeWidth="4"
           />
           <motion.circle
             cx="50" cy="50" r="48"
             fill="none"
             stroke={entity.hp / entity.maxHp > 0.3 ? "#10b981" : "#ef4444"}
             strokeWidth="4"
             strokeDasharray="301.5"
             animate={{ strokeDashoffset: 301.5 - (301.5 * (entity.hp / entity.maxHp)) }}
             transition={{ duration: 0.5 }}
           />
        </svg>

        {isCasting && (
          <div className="absolute inset-0 bg-purple-900/40 flex items-center justify-center animate-pulse text-[10px]">✨</div>
        )}
      </div>

      {/* Name and Status */}
      <div className="mt-0.5 flex flex-col items-center opacity-40 group-hover:opacity-100 transition-opacity">
        <span className={`font-medium tracking-tighter truncate max-w-[60px] text-center text-[9px] ${isActive ? "text-yellow-400 opacity-100" : "text-white/60"}`}>
          {entity.name.split(' ')[0]}
        </span>
        <div className="flex gap-0.5">
          {entity.statusEffects.map((fx, i) => (
            <span key={i} className="text-[8px] leading-none opacity-60">{STATUS_ICONS[fx.type]}</span>
          ))}
        </div>
      </div>

      {/* Numerical HP overlay for focus */}
      <div className={`absolute -bottom-2 bg-black/60 rounded px-1 text-[7px] font-mono border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity ${isDead ? "hidden" : ""}`}>
        {entity.hp}
      </div>

      {/* Floating texts */}
      <AnimatePresence>
        {floats.map(f => (
          <motion.div
            key={f.id}
            initial={{ y: 0, opacity: 1, scale: 0.8 }}
            animate={{ y: -60, opacity: 0, scale: 1.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className={`absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none text-center whitespace-nowrap z-50 ${FLOAT_SIZE_CLASS[f.size ?? "md"]}`}
            style={{ color: f.color, textShadow: "0 0 10px rgba(0,0,0,1)" }}
          >
            {f.text}
          </motion.div>
        ))}
      </AnimatePresence>

      {isDead && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-2xl filter drop-shadow-lg">
          💀
        </div>
      )}
    </motion.div>
  );
}

// ── Decorative torch ──────────────────────────────────────────────────────────

function TorchSconce({ side }: { side: "left" | "right" }) {
  return (
    <motion.div
      className={`absolute top-24 ${side === "left" ? "left-4" : "right-4"} pointer-events-none`}
      animate={{ opacity: [0.8, 1, 0.8] }}
      transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
    >
      <div className="text-2xl" style={{ filter: "drop-shadow(0 0 8px rgba(255,160,40,0.9))" }}>
        🔦
      </div>
    </motion.div>
  );
}
