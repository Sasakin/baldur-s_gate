import type {
  GameState as ApiGameState,
  CharacterStats,
} from "@workspace/api-client-react";

export type AppState =
  | "MAIN_MENU"
  | "CHAR_CREATION"
  | "EXPLORATION"
  | "COMBAT"
  | "REWARD"
  | "LEVEL_UP"
  | "INVENTORY"
  | "QUESTS"
  | "GAME_OVER"
  | "VICTORY";

export type CombatPhase =
  | "PICK_ACTION"
  | "PICK_TARGET"
  | "ANIMATING"
  | "ENEMY_TURN"
  | "ROUND_END";

export type StatusEffectType = "stun" | "bleed" | "dodge" | "defend" | "burn" | "poison" | "bless" | "fear";

export interface StatusEffect {
  type: StatusEffectType;
  turnsLeft: number;
  value?: number;
}

export interface FloatingText {
  id: string;
  text: string;
  color: string;
  size?: "sm" | "md" | "lg" | "xl"; // xl = CRIT
  entityId: string;
  createdAt: number;
}

export interface CombatEntity extends CharacterStats {
  isEnemy: boolean;
  initiative: number;
  statusEffects: StatusEffect[];
  displayHp?: number;
  // Casting system for mage
  castingSkillId?: string | null;
  castingTurnsLeft?: number;
  // Flanking — set at combat resolve time
  isFlanked?: boolean;
}

export type ActionType =
  | "ATTACK"
  | "SKILL_1"
  | "SKILL_2"
  | "USE_ITEM"
  | "DEFEND"
  | "FLEE";

export interface HitResult {
  hit: boolean;
  crit: boolean;
  fumble: boolean; // natural 1
  roll: number;
  flankingBonus: number;
}

export interface CombatState {
  enemies: CombatEntity[];
  party: CombatEntity[];
  turnOrder: string[];
  currentTurnIndex: number;
  round: number;
  phase: CombatPhase;
  selectedAction: ActionType | null;
  log: string[];
  floatingTexts: FloatingText[];
  pendingLevelUps: string[];
  screenShake: boolean;    // triggers on crit
  paused: boolean;         // spacebar pause
  visualEvents: CombatVisualEvent[];
}

export interface CombatVisualEvent {
  id: string;
  type: 'hit' | 'miss' | 'magic' | 'heal' | 'blood';
  targetId: string;
  amount?: number;
  createdAt: number;
}

export interface LocalGameState extends ApiGameState {
  appState: AppState;
  combat?: CombatState;
  combatReward?: CombatReward;
  logs: string[];
  exploredTiles: Record<string, boolean>;
}

export interface MapData {
  id: string;
  name: string;
  grid: number[][];
  enemies: MapEntity[];
  items: MapEntity[];
  transitions: MapTransition[];
}

export interface LevelUpRecord {
  charId: string;
  name: string;
  charClass: string;
  oldLevel: number;
  newLevel: number;
}

export interface CombatReward {
  xp:       number;
  gold:     number;
  levelUps: LevelUpRecord[];
}

export interface MapEntity {
  id: string;
  x: number;
  y: number;
  refId: string;
  group?: string[]; // additional enemy refIds to spawn alongside this one
  defeated?: boolean;
  looted?: boolean;
}

export interface MapTransition {
  x: number;
  y: number;
  targetMap: string;
  targetX: number;
  targetY: number;
}

// ─── Skill definitions ───────────────────────────────────────────────────────

export interface SkillDef {
  id: string;
  name: string;
  description: string;
  mpCost: number;
  targetType: "single_enemy" | "all_enemies" | "single_ally" | "self";
  icon: string;
  castTime: number; // turns to charge (0 = instant, 1 = mage spells, etc.)
}

export const CLASS_SKILLS: Record<string, [SkillDef, SkillDef]> = {
  warrior: [
    {
      id: "whirlwind",
      name: "Whirlwind",
      description: "Hits all enemies for 80% weapon damage.",
      mpCost: 0,
      targetType: "all_enemies",
      icon: "🌀",
      castTime: 0,
    },
    {
      id: "shield_bash",
      name: "Shield Bash",
      description: "Stuns an enemy for 1 turn and deals light damage.",
      mpCost: 0,
      targetType: "single_enemy",
      icon: "🛡️",
      castTime: 0,
    },
  ],
  mage: [
    {
      id: "fireball",
      name: "Fireball",
      description: "Burns all enemies. Casting takes 1 turn — interrupts if hit!",
      mpCost: 8,
      targetType: "all_enemies",
      icon: "🔥",
      castTime: 1,
    },
    {
      id: "ice_lance",
      name: "Ice Lance",
      description: "Deals 2× INT damage to one enemy. 1-turn cast.",
      mpCost: 5,
      targetType: "single_enemy",
      icon: "❄️",
      castTime: 1,
    },
  ],
  rogue: [
    {
      id: "backstab",
      name: "Backstab",
      description: "Deals 3× DEX damage. Applies bleed (4 dmg/turn, 2 turns). 💀",
      mpCost: 0,
      targetType: "single_enemy",
      icon: "🗡️",
      castTime: 0,
    },
    {
      id: "smoke_bomb",
      name: "Smoke Bomb",
      description: "Dodge the next attack. Then deal AoE blind damage.",
      mpCost: 0,
      targetType: "self",
      icon: "💨",
      castTime: 0,
    },
  ],
  cleric: [
    {
      id: "holy_strike",
      name: "Holy Strike",
      description: "Deals WIS+STR damage; 2× vs undead.",
      mpCost: 3,
      targetType: "single_enemy",
      icon: "✝️",
      castTime: 0,
    },
    {
      id: "divine_heal",
      name: "Divine Heal",
      description: "Restores WIS×2+10 HP to a party member.",
      mpCost: 6,
      targetType: "single_ally",
      icon: "💚",
      castTime: 0,
    },
  ],
};

// XP needed to reach each level (index = level)
export const XP_THRESHOLDS = [0, 0, 100, 250, 500, 900, 1500, 2400, 3700, 5500, 8000];

// Warrior gets extra attack per round at level 7+
export function getAttackCount(entity: CombatEntity): number {
  if (entity.class === "warrior" && entity.level >= 7) return 2;
  return 1;
}
