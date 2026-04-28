/**
 * RewardScreen — post-combat reward overlay.
 * Shows XP gained, gold, defeated enemies, and any level-up notifications.
 * Displayed as REWARD appState before returning to EXPLORATION.
 */
import { motion, AnimatePresence } from "framer-motion";
import { CombatReward } from "../../lib/types";

interface Props {
  reward: CombatReward;
  onContinue: () => void;
}

const STAT_GAINS: Record<string, string> = {
  warrior: "+3 HP · +1 STR",
  mage:    "+2 HP · +2 INT · +5 MP",
  rogue:   "+2 HP · +1 DEX",
  cleric:  "+2 HP · +1 WIS · +3 MP",
};

export function RewardScreen({ reward, onContinue }: Props) {
  const hasLevelUps = reward.levelUps.length > 0;

  return (
    <motion.div
      key="reward-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="absolute inset-0 z-40 flex items-center justify-center"
      style={{
        background: "radial-gradient(ellipse at center, rgba(10,20,5,0.97) 0%, rgba(0,0,0,0.99) 100%)",
      }}
    >
      {/* Particle sparks (decorative) */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 4, height: 4,
            background: i % 2 === 0 ? "#FFD700" : "#44FF88",
            left: `${15 + i * 10}%`,
            top: "50%",
          }}
          animate={{
            y: [0, -80 - i * 20, 0],
            opacity: [0, 1, 0],
            x: [0, (i % 3 - 1) * 40, 0],
          }}
          transition={{ delay: i * 0.12, duration: 1.8, repeat: Infinity, ease: "easeOut" }}
        />
      ))}

      <div className="parchment-bg gothic-border p-5 md:p-8 max-w-lg w-full mx-4 flex flex-col gap-4 md:gap-5">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-center"
        >
          <div
            className="text-3xl md:text-4xl font-display font-black tracking-widest mb-1"
            style={{
              color: "#FFD700",
              textShadow: "0 0 30px rgba(255,215,0,0.6), 0 0 60px rgba(255,215,0,0.3)",
            }}
          >
            ПОБЕДА!
          </div>
          <div className="text-xs text-gray-500 uppercase tracking-widest">
            Враги повержены
          </div>
        </motion.div>

        {/* ── Rewards row ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
          className="flex justify-center gap-8"
        >
          <RewardBadge icon="⭐" label="Опыт" value={`+${reward.xp} XP`} color="#FFD700" />
          <RewardBadge icon="💰" label="Золото" value={`+${reward.gold}`}  color="#FFA500" />
        </motion.div>

        {/* ── Level-up notifications ──────────────────────────────────────── */}
        <AnimatePresence>
          {hasLevelUps && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="flex flex-col gap-3"
            >
              <div className="text-center text-[10px] uppercase tracking-widest text-[var(--color-rpg-gold-dim)] border-t border-[var(--color-rpg-gold-dim)]/30 pt-3">
                Повышение уровня!
              </div>
              {reward.levelUps.map((lu, i) => (
                <motion.div
                  key={lu.charId}
                  initial={{ x: -30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.55 + i * 0.1 }}
                  className="flex items-center gap-3 bg-yellow-900/20 border border-yellow-600/40 rounded-sm px-4 py-3"
                >
                  <div className="text-2xl">✨</div>
                  <div className="flex-1">
                    <div className="font-bold text-yellow-300 text-sm">{lu.name}</div>
                    <div className="text-xs text-gray-400">
                      Уровень <span className="text-gray-500 line-through">{lu.oldLevel}</span>
                      {" → "}
                      <span className="text-yellow-300 font-bold text-base">{lu.newLevel}</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-500 text-right leading-tight">
                    {STAT_GAINS[lu.charClass] ?? "+2 HP"}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Continue button ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: hasLevelUps ? 0.8 : 0.5 }}
          className="flex justify-center pt-2"
        >
          <motion.button
            onClick={onContinue}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="rpg-button px-10 py-3 text-sm tracking-widest"
            style={{ minWidth: 200 }}
          >
            Продолжить ➤
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function RewardBadge({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-3xl">{icon}</div>
      <div className="text-[9px] uppercase tracking-widest text-gray-500">{label}</div>
      <motion.div
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="text-xl font-black"
        style={{ color }}
      >
        {value}
      </motion.div>
    </div>
  );
}
