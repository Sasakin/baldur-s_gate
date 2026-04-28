import { CharacterStats } from "@workspace/api-client-react";
import {
  CombatEntity, FloatingText,
  StatusEffect, CLASS_SKILLS, XP_THRESHOLDS, HitResult,
} from "./types";

// ─── Utility ────────────────────────────────────────────────────────────────

let _floatId = 0;
export function makeFloat(
  text: string,
  color: string,
  entityId: string,
  size: FloatingText["size"] = "md"
): FloatingText {
  return { id: `f${++_floatId}`, text, color, size, entityId, createdAt: Date.now() };
}

export function d(sides: number, count = 1): number {
  let total = 0;
  for (let i = 0; i < count; i++) total += Math.floor(Math.random() * sides) + 1;
  return total;
}

export function getAC(entity: CombatEntity): number {
  return 10 + Math.floor(entity.dexterity / 3);
}

// ─── Flanking ────────────────────────────────────────────────────────────────

/**
 * Returns flanking bonus (+2) if 2 or more alive party members can attack the enemy.
 * Simplified: if ≥2 party members alive → +2 to hit.
 */
export function getFlankingBonus(alivePartyCount: number): number {
  return alivePartyCount >= 2 ? 2 : 0;
}

// ─── Damage formulas ────────────────────────────────────────────────────────

/** Basic physical attack damage (per single attack) */
export function calcAttackDamage(attacker: CombatEntity): number {
  const base = attacker.isEnemy
    ? Math.floor(attacker.strength * 0.55) + d(8)
    : classDamageDie(attacker) + statBonus(attacker);
  return Math.max(1, base);
}

function classDamageDie(c: CombatEntity): number {
  switch (c.class) {
    case "warrior": return d(6, 2);  // 2d6 — longsword
    case "mage":    return d(4);     // 1d4 — dagger
    case "rogue":   return d(8);     // 1d8 — short sword
    case "cleric":  return d(8);     // 1d8 — mace
    default:        return d(6);
  }
}

export function statBonus(c: CombatEntity): number {
  switch (c.class) {
    case "warrior": return Math.floor((c.strength - 10) / 2);
    case "mage":    return Math.floor((c.intelligence - 10) / 2);
    case "rogue":   return Math.floor((c.dexterity - 10) / 2);
    case "cleric":  return Math.floor((c.wisdom - 10) / 2);
    default: return 0;
  }
}

// ─── D20 hit roll ────────────────────────────────────────────────────────────

/**
 * Roll to hit (D&D-style d20):
 *  - Natural 20 → critical hit (auto-hit, double damage, screen shake)
 *  - Natural 1  → fumble (auto-miss, stumble)
 *  - Otherwise  → hit if roll + attack-bonus + flanking ≥ target AC
 */
export function rollToHit(
  attacker: CombatEntity,
  defender: CombatEntity,
  aliveAllyCount: number = 1
): HitResult {
  const roll = d(20);
  const flankingBonus = attacker.isEnemy ? 0 : getFlankingBonus(aliveAllyCount);

  if (roll === 20) return { hit: true, crit: true, fumble: false, roll, flankingBonus };
  if (roll === 1)  return { hit: false, crit: false, fumble: true, roll, flankingBonus };

  const bonus = statBonus(attacker) + attacker.level + flankingBonus;
  const ac = getAC(defender);
  return { hit: roll + bonus >= ac, crit: false, fumble: false, roll, flankingBonus };
}

// ─── Hit / damage application ────────────────────────────────────────────────

/** Apply damage to a single entity — returns { updatedEntities, didCrit } */
export function applyDamage(
  entities: CombatEntity[],
  targetId: string,
  rawDmg: number,
  crit: boolean,
  floats: FloatingText[],
  logLines: string[]
): { entities: CombatEntity[]; didCrit: boolean } {
  let didCrit = false;

  const result = entities.map(e => {
    if (e.id !== targetId) return e;

    // Dodge
    const dodging = e.statusEffects.some(s => s.type === "dodge");
    if (dodging) {
      floats.push(makeFloat("УКЛОНЕНИЕ!", "#88FFFF", e.id, "lg"));
      logLines.push(`${e.name} уклоняется от удара!`);
      return { ...e, statusEffects: e.statusEffects.filter(s => s.type !== "dodge") };
    }

    // Defend halves damage
    const defending = e.statusEffects.some(s => s.type === "defend");
    const mitigated = defending ? Math.max(1, Math.floor(rawDmg / 2)) : rawDmg;
    const critMult = crit ? 2 : 1;
    const dmg = mitigated * critMult;

    if (crit) {
      didCrit = true;
      floats.push(makeFloat(`💥 КРИТ! ${dmg}`, "#FF6600", e.id, "xl"));
    } else {
      floats.push(makeFloat(`${dmg}`, "#FF4444", e.id, "md"));
    }

    const newHp = Math.max(0, e.hp - dmg);

    // Interrupt mage casting if hit
    const castInterrupted = !!e.castingSkillId && !e.isEnemy;
    if (castInterrupted) {
      floats.push(makeFloat("ПРЕРВАНО!", "#FF88FF", e.id, "lg"));
      logLines.push(`${e.name}'s заклинание прервано!`);
    }

    return {
      ...e,
      hp: newHp,
      alive: newHp > 0,
      statusEffects: e.statusEffects.filter(s => s.type !== "defend"),
      castingSkillId: castInterrupted ? null : e.castingSkillId,
      castingTurnsLeft: castInterrupted ? 0 : e.castingTurnsLeft,
    };
  });

  return { entities: result, didCrit };
}

/** Apply healing */
export function applyHeal(
  entities: CombatEntity[],
  targetId: string,
  amount: number,
  floats: FloatingText[],
  logLines: string[]
): CombatEntity[] {
  return entities.map(e => {
    if (e.id !== targetId) return e;
    const gained = Math.min(amount, e.maxHp - e.hp);
    floats.push(makeFloat(`+${gained} HP`, "#44FF88", e.id, "lg"));
    logLines.push(`${e.name} восстанавливает ${gained} HP.`);
    return { ...e, hp: Math.min(e.maxHp, e.hp + amount) };
  });
}

// ─── Status effect tick ──────────────────────────────────────────────────────

export function tickStatusEffects(
  entity: CombatEntity,
  floats: FloatingText[],
  logLines: string[]
): CombatEntity {
  let hp = entity.hp;
  const next: StatusEffect[] = [];

  for (const fx of entity.statusEffects) {
    if (fx.type === "bleed") {
      const dmg = fx.value ?? 3;
      hp = Math.max(0, hp - dmg);
      floats.push(makeFloat(`🩸 ${dmg}`, "#CC2244", entity.id, "sm"));
      logLines.push(`${entity.name} кровоточит: ${dmg} урона.`);
    }
    if (fx.type === "poison") {
      const dmg = fx.value ?? 2;
      hp = Math.max(0, hp - dmg);
      floats.push(makeFloat(`☠ ${dmg}`, "#44CC44", entity.id, "sm"));
      logLines.push(`${entity.name} отравлен: ${dmg} урона.`);
    }
    if (fx.turnsLeft > 1) next.push({ ...fx, turnsLeft: fx.turnsLeft - 1 });
  }

  return { ...entity, hp, alive: hp > 0, statusEffects: next };
}

// ─── Skill resolution ────────────────────────────────────────────────────────

export function resolveSkill(
  skillId: string,
  caster: CombatEntity,
  targetId: string | null,
  allEntities: CombatEntity[],
  floats: FloatingText[],
  logLines: string[]
): { entities: CombatEntity[]; didCrit: boolean } {
  let entities = [...allEntities];
  let didCrit = false;

  switch (skillId) {
    case "whirlwind": {
      const dmg = Math.max(1, Math.floor(caster.strength * 0.8) + d(8));
      entities
        .filter(e => e.isEnemy && e.alive)
        .forEach(e => {
          const r = applyDamage(entities, e.id, dmg, false, floats, logLines);
          entities = r.entities;
          if (r.didCrit) didCrit = true;
          logLines.push(`Вихрь ${caster.name} попадает по ${e.name}: ${dmg} урона!`);
        });
      break;
    }

    case "shield_bash": {
      if (!targetId) break;
      const dmg = Math.max(1, Math.floor(caster.strength * 0.4) + d(4));
      const r = applyDamage(entities, targetId, dmg, false, floats, logLines);
      entities = r.entities;
      entities = addStatus(entities, targetId, { type: "stun", turnsLeft: 1 });
      const t = entities.find(e => e.id === targetId);
      if (t) {
        logLines.push(`${caster.name} оглушает ${t.name} щитом!`);
        floats.push(makeFloat("⚡ ОГЛУШЁН!", "#FFFF44", targetId, "lg"));
      }
      break;
    }

    case "fireball": {
      const dmg = Math.max(1, Math.floor(caster.intelligence * 0.9) + d(10));
      entities
        .filter(e => e.isEnemy && e.alive)
        .forEach(e => {
          const r = applyDamage(entities, e.id, dmg, false, floats, logLines);
          entities = r.entities;
          if (r.didCrit) didCrit = true;
          // Apply burn
          entities = addStatus(entities, e.id, { type: "burn", turnsLeft: 2, value: 3 });
          logLines.push(`Огненный шар сжигает ${e.name}: ${dmg} урона!`);
          floats.push(makeFloat("🔥", "#FF8800", e.id, "xl"));
        });
      break;
    }

    case "ice_lance": {
      if (!targetId) break;
      const dmg = Math.max(1, Math.floor(caster.intelligence * 1.6) + d(8));
      const r = applyDamage(entities, targetId, dmg, false, floats, logLines);
      entities = r.entities;
      if (r.didCrit) didCrit = true;
      entities = addStatus(entities, targetId, { type: "stun", turnsLeft: 1 }); // freeze / slow
      const t = entities.find(e => e.id === targetId);
      if (t) {
        logLines.push(`${caster.name} пронзает ${t.name} Ледяной стрелой: ${dmg}! Цель заморожена.`);
        floats.push(makeFloat("❄️ ЗАМОРОЖЕН", "#88CCFF", targetId, "lg"));
      }
      break;
    }

    case "backstab": {
      if (!targetId) break;
      // 3× DEX damage (real backstab)
      const dmg = Math.max(1, Math.floor(caster.dexterity * 2.5) + d(8));
      const r = applyDamage(entities, targetId, dmg, false, floats, logLines);
      entities = r.entities;
      entities = addStatus(entities, targetId, { type: "bleed", turnsLeft: 2, value: 4 });
      const t = entities.find(e => e.id === targetId);
      if (t) {
        logLines.push(`${caster.name} наносит смертельный удар в спину ${t.name}: ${dmg}! 💀`);
        floats.push(makeFloat("💀 УДАР В СПИНУ", "#CC2244", targetId, "xl"));
      }
      break;
    }

    case "smoke_bomb": {
      entities = addStatus(entities, caster.id, { type: "dodge", turnsLeft: 1 });
      const dmg = Math.max(1, Math.floor(caster.dexterity * 0.4) + d(4));
      entities
        .filter(e => e.isEnemy && e.alive)
        .forEach(e => {
          const r = applyDamage(entities, e.id, dmg, false, floats, logLines);
          entities = r.entities;
        });
      floats.push(makeFloat("💨 УКЛОН ГОТОВ", "#88FFFF", caster.id, "lg"));
      logLines.push(`${caster.name} бросает дымовую бомбу! Следующий удар промахнётся.`);
      break;
    }

    case "holy_strike": {
      if (!targetId) break;
      const target = entities.find(e => e.id === targetId);
      const isUndead = target?.class === "warrior" && target.isEnemy; // skeletons/zombies
      const dmg = Math.max(1, (Math.floor(caster.wisdom * 0.9) + Math.floor(caster.strength * 0.5) + d(8)) * (isUndead ? 2 : 1));
      const r = applyDamage(entities, targetId, dmg, false, floats, logLines);
      entities = r.entities;
      if (isUndead) {
        floats.push(makeFloat("✝️ СВЯЩЕННЫЙ УРОН!", "#FFFFAA", targetId, "xl"));
      }
      if (target) logLines.push(`${caster.name} поражает ${target.name} святым ударом: ${dmg}${isUndead ? " (×2 нежить!)" : ""}!`);
      break;
    }

    case "divine_heal": {
      if (!targetId) break;
      const amount = Math.max(5, caster.wisdom * 2 + d(8) + 5);
      entities = applyHeal(entities, targetId, amount, floats, logLines);
      const t = entities.find(e => e.id === targetId);
      if (t) {
        logLines.push(`${caster.name} направляет целительный свет на ${t.name}!`);
        floats.push(makeFloat("✨", "#AAFFAA", targetId, "xl"));
      }
      break;
    }
  }

  return { entities, didCrit };
}

function addStatus(entities: CombatEntity[], id: string, fx: StatusEffect): CombatEntity[] {
  return entities.map(e => {
    if (e.id !== id) return e;
    const others = e.statusEffects.filter(s => s.type !== fx.type);
    return { ...e, statusEffects: [...others, fx] };
  });
}

// ─── Level up ────────────────────────────────────────────────────────────────

export function checkLevelUp(char: CharacterStats): CharacterStats {
  const threshold = XP_THRESHOLDS[char.level + 1];
  if (!threshold || char.experience < threshold) return char;

  const newLevel = char.level + 1;
  const hpGain = char.class === "warrior" ? 10 : char.class === "cleric" ? 7 : char.class === "rogue" ? 7 : 5;
  const mpGain = char.class === "mage" ? 10 : char.class === "cleric" ? 6 : 3;

  return {
    ...char,
    level: newLevel,
    maxHp: char.maxHp + hpGain,
    hp: char.hp + hpGain,
    maxMp: char.maxMp + mpGain,
    mp: char.mp + mpGain,
    strength:     char.class === "warrior" ? char.strength + 2 : char.strength + 1,
    dexterity:    char.class === "rogue"   ? char.dexterity + 2 : char.dexterity + 1,
    intelligence: char.class === "mage"    ? char.intelligence + 2 : char.intelligence + 1,
    wisdom:       char.class === "cleric"  ? char.wisdom + 2 : char.wisdom + 1,
  };
}

// ─── AI decision ────────────────────────────────────────────────────────────

export interface AIAction {
  type: "attack" | "skill";
  skillId?: string;
  targetId: string;
}

export function decideAIAction(
  enemy: CombatEntity,
  aliveParty: CombatEntity[]
): AIAction | null {
  if (aliveParty.length === 0) return null;
  if (enemy.statusEffects.some(s => s.type === "stun")) return null;

  // Prefer lowest-HP target
  const target = [...aliveParty].sort((a, b) => a.hp - b.hp)[0];

  // Boss enemies get AoE skill chance
  if (enemy.level >= 5 && Math.random() < 0.35) {
    return { type: "skill", skillId: "boss_magic", targetId: target.id };
  }

  return { type: "attack", targetId: target.id };
}
