import { useState, useCallback, useRef, useEffect } from "react";
import {
  LocalGameState, CombatState, CombatEntity,
  ActionType, FloatingText, CLASS_SKILLS, XP_THRESHOLDS,
  getAttackCount, LevelUpRecord, CombatVisualEvent,
} from "../lib/types";
import { MAPS, STARTING_GOLD, INITIAL_COMPANIONS, ENEMY_DB } from "../lib/game-data";
import { CharacterStats, CharacterStatsClass, CharacterStatsRace } from "@workspace/api-client-react";
import { bfsPath, tilesInRange, Point } from "../lib/pathfinding";
import {
  calcAttackDamage, rollToHit, applyDamage, applyHeal,
  tickStatusEffects, resolveSkill, checkLevelUp, decideAIAction, makeFloat,
} from "../lib/combat-rules";

const VISION_RADIUS = 5;

// ─── Initial state ───────────────────────────────────────────────────────────

const getInitialState = (): LocalGameState => ({
  appState: "MAIN_MENU",
  party: [],
  currentMap: "thornwood",
  partyPosition: { x: 10, y: 10 },
  quests: [
    { id: "q1", title: "Проклятие Осквернителя", description: "Найдите и победите Малахара в Тёмном Святилище.", completed: false },
    { id: "q2", title: "Пропавший торговец",     description: "Найдите пропавшего торговца в Склепе.",           completed: false },
  ],
  inventory: [
    { id: "hp_potion", name: "Зелье здоровья", type: "consumable", quantity: 3 },
    { id: "mp_potion", name: "Зелье маны",     type: "consumable", quantity: 1 },
  ],
  playTime: 0,
  logs: ["Добро пожаловать в Хроники Забытого Королевства."],
  exploredTiles: {},
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toCombatEntity(char: CharacterStats, isEnemy: boolean): CombatEntity {
  return {
    ...char,
    isEnemy,
    initiative: char.dexterity + Math.floor(Math.random() * 20),
    statusEffects: [],
    castingSkillId: null,
    castingTurnsLeft: 0,
  };
}

function revealTiles(gs: LocalGameState): LocalGameState {
  const map = MAPS[gs.currentMap];
  if (!map) return gs;
  const visible = tilesInRange(map.grid, gs.partyPosition, VISION_RADIUS);
  const next = { ...gs.exploredTiles };
  visible.forEach(k => { next[`${gs.currentMap}_${k}`] = true; });
  return { ...gs, exploredTiles: next };
}

export interface MoveState {
  path: Point[];
  stepIndex: number;
  walking: boolean;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

function makeVisualEvent(type: 'hit' | 'miss' | 'magic' | 'heal' | 'blood', targetId: string, amount?: number): CombatVisualEvent {
  return { id: Math.random().toString(36).substring(7), type, targetId, amount, createdAt: Date.now() };
}

export function useGameEngine() {
  const [state, setState] = useState<LocalGameState>(getInitialState());
  const stateRef = useRef(state);
  stateRef.current = state;

  const [moveState, setMoveState] = useState<MoveState>({ path: [], stepIndex: 0, walking: false });
  const moveRef = useRef(moveState);
  moveRef.current = moveState;

  // ── Logging ────────────────────────────────────────────────────────────────

  const logMessage = useCallback((msg: string) =>
    setState(s => ({ ...s, logs: [...s.logs.slice(-29), msg] })), []);

  // ── Character creation ─────────────────────────────────────────────────────

  const createHero = useCallback((name: string, cls: CharacterStatsClass, race: CharacterStatsRace) => {
    const hpBase: Record<string, number> = { warrior: 32, cleric: 24, rogue: 22, mage: 16 };
    const mpBase: Record<string, number> = { warrior: 5,  cleric: 22, rogue: 10, mage: 32 };
    const hero: CharacterStats = {
      id: "hero", name, class: cls, race,
      level: 1,
      hp: hpBase[cls], maxHp: hpBase[cls],
      mp: mpBase[cls], maxMp: mpBase[cls],
      strength:     cls === "warrior" ? 16 : cls === "cleric" ? 13 : 10,
      dexterity:    cls === "rogue"   ? 16 : cls === "mage"   ? 11 : 10,
      intelligence: cls === "mage"    ? 16 : cls === "cleric" ? 12 : 9,
      wisdom:       cls === "cleric"  ? 16 : cls === "mage"   ? 12 : 9,
      experience: 0, gold: STARTING_GOLD, alive: true,
    };
    setState(s => revealTiles({
      ...s,
      party: [hero, ...INITIAL_COMPANIONS],
      appState: "EXPLORATION",
      currentMap: "thornwood",
      partyPosition: { x: 10, y: 10 },
      logs: [...s.logs, `${name} присоединяется к отряду. Приключение начинается!`],
    }));
  }, []);

  // ── Spacebar pause ─────────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      setState(s => {
        if (s.appState !== "COMBAT" || !s.combat) return s;
        return { ...s, combat: { ...s.combat, paused: !s.combat.paused } };
      });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Screen shake clear ─────────────────────────────────────────────────────

  useEffect(() => {
    const iv = setInterval(() => {
      setState(s => {
        if (!s.combat?.screenShake) return s;
        return { ...s, combat: { ...s.combat, screenShake: false } };
      });
    }, 600);
    return () => clearInterval(iv);
  }, []);

  // ── Movement ───────────────────────────────────────────────────────────────

  const requestMove = useCallback((targetX: number, targetY: number) => {
    const s = stateRef.current;
    if (s.appState !== "EXPLORATION") return;
    if (moveRef.current.walking) return;
    const map = MAPS[s.currentMap];
    if (!map) return;
    const path = bfsPath(map.grid, s.partyPosition, { x: targetX, y: targetY });
    if (path.length === 0) return;
    setMoveState({ path, stepIndex: 0, walking: true });
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      const mv = moveRef.current;
      if (!mv.walking || mv.stepIndex >= mv.path.length) {
        if (mv.walking) setMoveState({ path: [], stepIndex: 0, walking: false });
        return;
      }
      const nextPos = mv.path[mv.stepIndex];

      setState(s => {
        if (s.appState !== "EXPLORATION") return s;
        const map = MAPS[s.currentMap];
        if (!map) return s;

        let next: LocalGameState = { ...s, partyPosition: nextPos };
        next = revealTiles(next);

        const transition = map.transitions.find(t => t.x === nextPos.x && t.y === nextPos.y);
        if (transition) {
          const name = MAPS[transition.targetMap]?.name ?? transition.targetMap;
          next = revealTiles({
            ...next,
            currentMap: transition.targetMap,
            partyPosition: { x: transition.targetX, y: transition.targetY },
          });
          setMoveState({ path: [], stepIndex: 0, walking: false });
          setTimeout(() => logMessage(`Вошли в ${name}.`), 0);
          return next;
        }

        const enemy = map.enemies.find(e => e.x === nextPos.x && e.y === nextPos.y && !e.defeated);
        if (enemy) {
          setMoveState({ path: [], stepIndex: 0, walking: false });
          return startCombatFromState(next, enemy);
        }

        const item = map.items.find(i => i.x === nextPos.x && i.y === nextPos.y && !i.looted);
        if (item) {
          item.looted = true;
          setTimeout(() => logMessage(`Нашли: ${item.refId.replace(/_/g, " ")}!`), 0);
        }

        return next;
      });

      setMoveState(mv => {
        const ni = mv.stepIndex + 1;
        return ni >= mv.path.length ? { path: [], stepIndex: 0, walking: false } : { ...mv, stepIndex: ni };
      });
    }, 120);
    return () => clearInterval(iv);
  }, [logMessage]);

  // ── Combat: start ──────────────────────────────────────────────────────────

  const spawnEnemy = (refId: string, uid: string): CombatEntity | null => {
    const tpl = ENEMY_DB[refId];
    if (!tpl) return null;
    return {
      ...tpl,
      id: uid,
      isEnemy: true,
      initiative: tpl.dexterity + Math.floor(Math.random() * 20),
      statusEffects: [],
      castingSkillId: null,
      castingTurnsLeft: 0,
      alive: true,
    };
  };

  const startCombatFromState = (s: LocalGameState, mapEnemy: { id: string; refId: string; group?: string[] }): LocalGameState => {
    const leader = spawnEnemy(mapEnemy.refId, `combat_${mapEnemy.id}`);
    if (!leader) return s;

    const extras = (mapEnemy.group ?? []).map((refId, i) =>
      spawnEnemy(refId, `combat_${mapEnemy.id}_g${i}`)
    ).filter((e): e is CombatEntity => e !== null);

    const enemyEntities: CombatEntity[] = [leader, ...extras];

    const partyEntities = s.party.filter(p => p.alive).map(p => toCombatEntity(p, false));
    const all = [...partyEntities, ...enemyEntities].sort((a, b) => b.initiative - a.initiative);

    const names = enemyEntities.map(e => e.name).join(", ");

    const combat: CombatState = {
      enemies: enemyEntities,
      party: partyEntities,
      turnOrder: all.map(c => c.id),
      currentTurnIndex: 0,
      round: 1,
      phase: "PICK_ACTION",
      selectedAction: null,
      log: [`⚔️ ${names} ${enemyEntities.length > 1 ? "появляются" : "появляется"}! Инициатива!`],
      floatingTexts: [],
      pendingLevelUps: [],
      screenShake: false,
      paused: false,
      visualEvents: [],
    };

    const firstId = combat.turnOrder[0];
    if (enemyEntities.some(e => e.id === firstId)) {
      setTimeout(() => triggerEnemyTurn(), 900);
      combat.phase = "ENEMY_TURN";
    }

    return {
      ...s,
      appState: "COMBAT",
      combat,
      logs: [...s.logs, `Встреча: ${names}!`],
    };
  };

  // ── Combat: player actions ─────────────────────────────────────────────────

  const selectCombatAction = useCallback((action: ActionType) => {
    setState(s => {
      if (!s.combat || s.combat.phase !== "PICK_ACTION" || s.combat.paused) return s;
      const c = s.combat;
      const actor = currentActor(c);
      if (!actor) return s;

      if (action === "DEFEND")   return resolveDefend(s);
      if (action === "FLEE")     return resolveFlee(s);
      if (action === "USE_ITEM") return resolveUseItem(s);

      // Check if skill has cast time (mage)
      const skill = getSkillForAction(action, actor);
      if (skill && skill.castTime > 0) {
        // Begin casting — resolve on next turn
        const newParty = c.party.map(p =>
          p.id === actor.id
            ? { ...p, castingSkillId: skill.id, castingTurnsLeft: skill.castTime }
            : p
        );
        const log = [...c.log, `${actor.name} начинает читать ${skill.name}... (${skill.castTime} ход)`];
        const floats: FloatingText[] = [makeFloat(`✨ Чтение: ${skill.name}`, "#AAAAFF", actor.id, "lg")];
        return advanceAfterPlayerAction({
          ...s,
          combat: { ...c, party: newParty, log, floatingTexts: [...c.floatingTexts, ...floats] },
        });
      }

      // Needs target selection?
      const needsTarget = action === "ATTACK" ||
        (skill && (skill.targetType === "single_enemy" || skill.targetType === "single_ally"));

      if (needsTarget) {
        return { ...s, combat: { ...c, selectedAction: action, phase: "PICK_TARGET" } };
      }

      // AoE / self skill — resolve immediately
      if (skill) {
        return resolveSkillAoE(s, skill.id);
      }

      return s;
    });
  }, []);

  const selectTarget = useCallback((targetId: string) => {
    setState(s => {
      if (!s.combat || s.combat.phase !== "PICK_TARGET") return s;
      const action = s.combat.selectedAction;
      if (action === "ATTACK")                       return resolveAttack(s, targetId);
      if (action === "SKILL_1" || action === "SKILL_2") return resolveSkillTargeted(s, targetId);
      return s;
    });
  }, []);

  // ── Resolve actions ────────────────────────────────────────────────────────

  function resolveAttack(s: LocalGameState, targetId: string): LocalGameState {
    if (!s.combat) return s;
    const actor = currentActor(s.combat);
    if (!actor) return s;

    const target = [...s.combat.enemies, ...s.combat.party].find(e => e.id === targetId);
    if (!target || !target.alive) return s;

    const alivePartyCount = s.combat.party.filter(p => p.alive).length;
    const attackCount = getAttackCount(actor); // warrior level 7+ gets 2 attacks

    let enemies = [...s.combat.enemies];
    let party   = [...s.combat.party];
    const floats: FloatingText[] = [];
    const vEvents: CombatVisualEvent[] = [];
    const logLines: string[] = [];
    let anyScreenShake = false;

    for (let i = 0; i < attackCount; i++) {
      const t = [...enemies, ...party].find(e => e.id === targetId);
      if (!t || !t.alive) break;

      const hitResult = rollToHit(actor, t, alivePartyCount);

      // Flanking note in log
      const flankNote = hitResult.flankingBonus > 0 ? ` (фланг +${hitResult.flankingBonus})` : "";

      if (hitResult.fumble) {
        floats.push(makeFloat("💫 ПРОМАХ!", "#AAAAAA", targetId, "lg"));
        vEvents.push(makeVisualEvent('miss', targetId));
        logLines.push(`${actor.name} спотыкается! Критический промах (бросок 1)${flankNote}`);
      } else if (hitResult.hit) {
        const rawDmg = calcAttackDamage(actor);
        vEvents.push(makeVisualEvent('blood', targetId));
        vEvents.push(makeVisualEvent('hit', targetId, -rawDmg));
        if (target.isEnemy) {
          const r = applyDamage(enemies, targetId, rawDmg, hitResult.crit, floats, logLines);
          enemies = r.entities;
          if (r.didCrit) anyScreenShake = true;
        } else {
          const r = applyDamage(party, targetId, rawDmg, hitResult.crit, floats, logLines);
          party = r.entities;
          if (r.didCrit) anyScreenShake = true;
        }
        const atkNum = attackCount > 1 ? ` (атака ${i + 1})` : "";
        logLines.push(`${actor.name} атакует ${t.name} (бросок ${hitResult.roll})${flankNote}${atkNum}.`);
      } else {
        floats.push(makeFloat("МИМО", "#AAAAAA", targetId, "md"));
        vEvents.push(makeVisualEvent('miss', targetId));
        logLines.push(`${actor.name} промахивается по ${t.name} (бросок ${hitResult.roll}${flankNote}).`);
      }
    }

    // Sync party state
    const syncedParty = s.party.map(p => {
      const cp = party.find(c => c.id === p.id);
      return cp ? { ...p, hp: cp.hp, alive: cp.alive } : p;
    });

    return advanceAfterPlayerAction({
      ...s,
      party: syncedParty,
      combat: {
        ...s.combat,
        enemies,
        party,
        floatingTexts: [...s.combat.floatingTexts, ...floats],
        visualEvents: [...s.combat.visualEvents, ...vEvents],
        log: [...s.combat.log, ...logLines],
        screenShake: anyScreenShake,
      },
    });
  }

  function resolveSkillTargeted(s: LocalGameState, targetId: string): LocalGameState {
    if (!s.combat) return s;
    const action = s.combat.selectedAction;
    const actor = currentActor(s.combat);
    if (!actor) return s;
    const skill = getSkillForAction(action!, actor);
    if (!skill) return s;

    if (actor.mp < skill.mpCost) {
      return { ...s, combat: { ...s.combat, phase: "PICK_ACTION", selectedAction: null, log: [...s.combat.log, `${actor.name} не хватает маны!`] } };
    }

    const floats: FloatingText[] = [];
    const logLines: string[] = [];
    const allEntities = [...s.combat.party, ...s.combat.enemies];
    const { entities: resolved, didCrit } = resolveSkill(skill.id, actor, targetId, allEntities, floats, logLines);

    const newParty   = resolved.filter(e => !e.isEnemy);
    const newEnemies = resolved.filter(e =>  e.isEnemy);
    const updatedParty = s.party.map(p => {
      const cp = newParty.find(c => c.id === p.id);
      if (!cp) return p;
      return { ...p, hp: cp.hp, alive: cp.alive, mp: Math.max(0, p.mp - (p.id === actor.id ? skill.mpCost : 0)) };
    });

    return advanceAfterPlayerAction({
      ...s,
      party: updatedParty,
      combat: {
        ...s.combat,
        party: newParty.map(p => p.id === actor.id ? { ...p, mp: Math.max(0, p.mp - skill.mpCost) } : p),
        enemies: newEnemies,
        floatingTexts: [...s.combat.floatingTexts, ...floats],
        log: [...s.combat.log, ...logLines],
        screenShake: didCrit,
      },
    });
  }

  function resolveSkillAoE(s: LocalGameState, skillId: string): LocalGameState {
    if (!s.combat) return s;
    const actor = currentActor(s.combat);
    if (!actor) return s;
    const skill = Object.values(CLASS_SKILLS).flat().find(sk => sk.id === skillId);
    if (!skill || actor.mp < skill.mpCost) return s;

    const floats: FloatingText[] = [];
    const logLines: string[] = [];
    const allEntities = [...s.combat.party, ...s.combat.enemies];
    const { entities: resolved, didCrit } = resolveSkill(skillId, actor, null, allEntities, floats, logLines);

    const newParty   = resolved.filter(e => !e.isEnemy);
    const newEnemies = resolved.filter(e =>  e.isEnemy);
    const updatedParty = s.party.map(p => {
      const cp = newParty.find(c => c.id === p.id);
      return cp ? { ...p, hp: cp.hp, alive: cp.alive, mp: Math.max(0, p.mp - (p.id === actor.id ? skill.mpCost : 0)) } : p;
    });

    return advanceAfterPlayerAction({
      ...s,
      party: updatedParty,
      combat: {
        ...s.combat,
        party: newParty.map(p => p.id === actor.id ? { ...p, mp: Math.max(0, p.mp - skill.mpCost) } : p),
        enemies: newEnemies,
        floatingTexts: [...s.combat.floatingTexts, ...floats],
        log: [...s.combat.log, ...logLines],
        screenShake: didCrit,
      },
    });
  }

  function resolveDefend(s: LocalGameState): LocalGameState {
    if (!s.combat) return s;
    const actor = currentActor(s.combat);
    if (!actor) return s;
    const newParty = s.combat.party.map(p =>
      p.id === actor.id
        ? { ...p, statusEffects: [...p.statusEffects.filter(fx => fx.type !== "defend"), { type: "defend" as const, turnsLeft: 1 }] }
        : p
    );
    const floats = [makeFloat("🛡 ЗАЩИТА", "#4499FF", actor.id, "lg")];
    return advanceAfterPlayerAction({ ...s, combat: { ...s.combat, party: newParty, floatingTexts: [...s.combat.floatingTexts, ...floats], log: [...s.combat.log, `${actor.name} принимает оборонительную стойку.`] } });
  }

  function resolveUseItem(s: LocalGameState): LocalGameState {
    if (!s.combat) return s;
    const actor = currentActor(s.combat);
    if (!actor) return s;
    const potion = s.inventory.find(i => i.id === "hp_potion" && i.quantity > 0);
    if (!potion) return { ...s, combat: { ...s.combat, phase: "PICK_ACTION", log: [...s.combat.log, "Нет зелий!"] } };

    const floats: FloatingText[] = [];
    const logLines: string[] = [];
    const newCombatParty = applyHeal(s.combat.party, actor.id, 30, floats, logLines);
    const newParty = s.party.map(p => p.id === actor.id ? { ...p, hp: Math.min(p.maxHp, p.hp + 30) } : p);
    const newInv = s.inventory.map(i => i.id === "hp_potion" ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0);
    logLines.push(`${actor.name} выпивает зелье здоровья!`);
    return advanceAfterPlayerAction({ ...s, party: newParty, inventory: newInv, combat: { ...s.combat, party: newCombatParty, floatingTexts: [...s.combat.floatingTexts, ...floats], log: [...s.combat.log, ...logLines] } });
  }

  function resolveFlee(s: LocalGameState): LocalGameState {
    if (!s.combat) return s;
    const success = Math.random() < 0.5;
    if (success) return { ...s, appState: "EXPLORATION", combat: undefined, logs: [...s.logs, "Отряд отступает!"] };
    return advanceAfterPlayerAction({ ...s, combat: { ...s.combat, log: [...s.combat.log, "Отступление отрезано! Враг блокирует путь."] } });
  }

  // ── Advance turn ──────────────────────────────────────────────────────────

  function advanceAfterPlayerAction(s: LocalGameState): LocalGameState {
    if (!s.combat) return s;

    const allEnemiesDead = s.combat.enemies.every(e => !e.alive);
    if (allEnemiesDead) return handleVictory(s);

    const { nextIdx, round } = findNextTurnIdx(s.combat, s.combat.currentTurnIndex);
    const nextId = s.combat.turnOrder[nextIdx];
    const isEnemyTurn = s.combat.enemies.some(e => e.id === nextId);

    // Check if next party actor has a spell ready to fire
    if (!isEnemyTurn) {
      const nextActor = s.combat.party.find(p => p.id === nextId);
      if (nextActor?.castingSkillId && (nextActor.castingTurnsLeft ?? 0) <= 0) {
        // Fire the spell
        setTimeout(() => {
          setState(s2 => {
            if (!s2.combat) return s2;
            const actor = s2.combat.party.find(p => p.id === nextId);
            if (!actor?.castingSkillId) return s2;
            const skillId = actor.castingSkillId;
            const cleared = { ...s2, combat: { ...s2.combat, party: s2.combat.party.map(p => p.id === nextId ? { ...p, castingSkillId: null, castingTurnsLeft: 0 } : p) } };
            return resolveSkillAoE(cleared, skillId);
          });
        }, 300);
      }
    }

    // Tick status on next player actor
    let nextParty = [...s.combat.party];
    if (!isEnemyTurn) {
      const nextActor = nextParty.find(p => p.id === nextId);
      if (nextActor) {
        const floats: FloatingText[] = [];
        const logLines: string[] = [];
        const ticked = tickStatusEffects(nextActor, floats, logLines);
        nextParty = nextParty.map(p => p.id === nextActor.id ? ticked : p);

        if (ticked.statusEffects.some(fx => fx.type === "stun")) {
          logLines.push(`${nextActor.name} оглушён и пропускает ход!`);
          const stunS = { ...s, combat: { ...s.combat, party: nextParty, currentTurnIndex: nextIdx, round, phase: "PICK_ACTION" as const, selectedAction: null, floatingTexts: [...s.combat.floatingTexts, ...floats], log: [...s.combat.log, ...logLines] } };
          setTimeout(() => setState(s2 => advanceAfterPlayerAction(s2)), 1000);
          return stunS;
        }
        if (logLines.length > 0) {
          s = { ...s, combat: { ...s.combat, party: nextParty, floatingTexts: [...s.combat.floatingTexts, ...floats], log: [...s.combat.log, ...logLines] } };
        }
      }
    }

    const next: LocalGameState = {
      ...s,
      combat: {
        ...s.combat!,
        party: nextParty,
        currentTurnIndex: nextIdx,
        round,
        phase: isEnemyTurn ? "ENEMY_TURN" : "PICK_ACTION",
        selectedAction: null,
        screenShake: false,
      },
    };

    if (isEnemyTurn) setTimeout(() => triggerEnemyTurn(), 900);
    return next;
  }

  // ── Enemy AI turn ─────────────────────────────────────────────────────────

  const triggerEnemyTurn = useCallback(() => {
    setState(s => {
      if (!s.combat || s.combat.phase !== "ENEMY_TURN") return s;
      if (s.combat.paused) {
        setTimeout(() => triggerEnemyTurn(), 400);
        return s;
      }

      const currentId = s.combat.turnOrder[s.combat.currentTurnIndex];
      const enemy = s.combat.enemies.find(e => e.id === currentId);
      if (!enemy || !enemy.alive) return advanceFromEnemyTurn(s);

      const floats: FloatingText[] = [];
      const logLines: string[] = [];

      const tickedEnemy = tickStatusEffects(enemy, floats, logLines);
      let newEnemies = s.combat.enemies.map(e => e.id === enemy.id ? tickedEnemy : e);

      if (tickedEnemy.statusEffects.some(fx => fx.type === "stun")) {
        logLines.push(`${enemy.name} оглушён — пропуск хода!`);
        return advanceFromEnemyTurn({ ...s, combat: { ...s.combat, enemies: newEnemies, floatingTexts: [...s.combat.floatingTexts, ...floats], log: [...s.combat.log, ...logLines] } });
      }

      const aliveParty = s.combat.party.filter(p => p.alive);
      if (aliveParty.length === 0) return { ...s, appState: "GAME_OVER", logs: [...s.logs, "Отряд уничтожен..."] };

      const aiAction = decideAIAction(tickedEnemy, aliveParty);
      if (!aiAction) return advanceFromEnemyTurn(s);

      let newParty = [...s.combat.party];
      const vEvents: CombatVisualEvent[] = [];

      if (aiAction.type === "attack") {
        const target = aliveParty.find(p => p.id === aiAction.targetId);
        if (target) {
          const hitResult = rollToHit(tickedEnemy, target, 1);
          if (hitResult.fumble) {
            floats.push(makeFloat("💫 ПРОМАХ!", "#AAAAAA", aiAction.targetId, "lg"));
            vEvents.push(makeVisualEvent('miss', aiAction.targetId));
            logLines.push(`${enemy.name} спотыкается! (бросок 1)`);
          } else if (hitResult.hit) {
            const rawDmg = calcAttackDamage(tickedEnemy);
            vEvents.push(makeVisualEvent('blood', aiAction.targetId));
            vEvents.push(makeVisualEvent('hit', aiAction.targetId, -rawDmg));
            const r = applyDamage(newParty, aiAction.targetId, rawDmg, hitResult.crit, floats, logLines);
            newParty = r.entities;
            logLines.push(`${enemy.name} атакует ${target.name} (бросок ${hitResult.roll})${hitResult.crit ? " — КРИТ!" : "."}`);
          } else {
            floats.push(makeFloat("МИМО", "#AAAAAA", aiAction.targetId, "md"));
            vEvents.push(makeVisualEvent('miss', aiAction.targetId));
            logLines.push(`${enemy.name} промахивается по ${target.name}.`);
          }
        }
      } else if (aiAction.type === "skill" && aiAction.skillId === "boss_magic") {
        const dmg = Math.max(5, Math.floor(tickedEnemy.intelligence * 0.8) + 6);
        newParty.filter(p => p.alive).forEach(p => {
          vEvents.push(makeVisualEvent('magic', p.id));
          const r = applyDamage(newParty, p.id, dmg, false, floats, logLines);
          newParty = r.entities;
        });
        floats.push(makeFloat("🌑 ТЁМНАЯ МАГИЯ!", "#AA00FF", aiAction.targetId, "xl"));
        logLines.push(`${enemy.name} высвобождает тёмную магию!`);
      }

      const syncedParty = s.party.map(p => {
        const cp = newParty.find(c => c.id === p.id);
        return cp ? { ...p, hp: cp.hp, alive: cp.alive } : p;
      });

      if (newParty.every(p => !p.alive)) {
        return { ...s, appState: "GAME_OVER", party: syncedParty, logs: [...s.logs, "Отряд пал..."] };
      }

      return advanceFromEnemyTurn({
        ...s,
        party: syncedParty,
        combat: { ...s.combat, enemies: newEnemies, party: newParty, floatingTexts: [...s.combat.floatingTexts, ...floats], visualEvents: [...s.combat.visualEvents, ...vEvents], log: [...s.combat.log, ...logLines] },
      });
    });
  }, []);

  function advanceFromEnemyTurn(s: LocalGameState): LocalGameState {
    if (!s.combat) return s;
    const { nextIdx, round } = findNextTurnIdx(s.combat, s.combat.currentTurnIndex);
    const nextId = s.combat.turnOrder[nextIdx];
    const isEnemyNext = s.combat.enemies.some(e => e.id === nextId);

    const next: LocalGameState = {
      ...s,
      combat: { ...s.combat, currentTurnIndex: nextIdx, round, phase: isEnemyNext ? "ENEMY_TURN" : "PICK_ACTION", selectedAction: null },
    };
    if (isEnemyNext) setTimeout(() => triggerEnemyTurn(), 900);
    return next;
  }

  // ── Victory ────────────────────────────────────────────────────────────────

  function handleVictory(s: LocalGameState): LocalGameState {
    if (!s.combat) return s;
    const xpGained   = s.combat.enemies.reduce((a, e) => a + e.experience, 0);
    const goldGained = s.combat.enemies.reduce((a, e) => a + e.gold, 0);
    const isMalachar = s.combat.enemies.some(e => e.name === "Малахар Осквернитель");

    // Mark map enemies defeated
    const map = MAPS[s.currentMap];
    s.combat.enemies.forEach(ce => {
      const me = map?.enemies.find(me => ce.id.startsWith(`combat_${me.id}`));
      if (me) me.defeated = true;
    });

    // Detect level-ups while applying XP
    const levelUps: LevelUpRecord[] = [];
    const updatedParty = s.party.map(p => {
      if (!p.alive) return p;
      const withXp  = { ...p, experience: p.experience + xpGained, gold: p.gold + (p.id === "hero" ? goldGained : 0) };
      const leveled = checkLevelUp(withXp);
      if (leveled.level > p.level) {
        levelUps.push({ charId: p.id, name: p.name, charClass: p.class, oldLevel: p.level, newLevel: leveled.level });
      }
      return leveled;
    });

    if (isMalachar) {
      return {
        ...s,
        appState: "VICTORY",
        party: updatedParty,
        combat: undefined,
        combatReward: undefined,
        logs: [...s.logs, "Малахар повержен! Королевство спасено!"],
      };
    }

    return {
      ...s,
      appState: "REWARD",
      party: updatedParty,
      combat: undefined,
      combatReward: { xp: xpGained, gold: goldGained, levelUps },
      logs: [...s.logs, `Победа! +${xpGained} XP  +${goldGained} Золото`],
    };
  }

  // ── Reward: dismiss ────────────────────────────────────────────────────────

  const dismissReward = useCallback(() => {
    setState(s => ({ ...s, appState: "EXPLORATION", combatReward: undefined }));
  }, []);

  // ── Floating text cleanup ─────────────────────────────────────────────────

  useEffect(() => {
    const iv = setInterval(() => {
      setState(s => {
        if (!s.combat) return s;
        const now = Date.now();
        const freshFL = s.combat.floatingTexts.filter(f => now - f.createdAt < 2200);
        const freshVE = s.combat.visualEvents.filter(e => now - e.createdAt < 1500);
        
        if (freshFL.length === s.combat.floatingTexts.length && freshVE.length === s.combat.visualEvents.length) return s;
        return { 
          ...s, 
          combat: { 
            ...s.combat, 
            floatingTexts: freshFL,
            visualEvents: freshVE
          } 
        };
      });
    }, 500);
    return () => clearInterval(iv);
  }, []);

  // ── Save / Load ───────────────────────────────────────────────────────────

  const saveGame = useCallback(() => {
    try { localStorage.setItem("cotfr_save", JSON.stringify(stateRef.current)); logMessage("Игра сохранена."); }
    catch { logMessage("Ошибка сохранения."); }
  }, [logMessage]);

  const loadGame = useCallback(() => {
    try {
      const raw = localStorage.getItem("cotfr_save");
      if (!raw) { logMessage("Сохранение не найдено."); return; }
      setState(JSON.parse(raw) as LocalGameState);
      logMessage("Игра загружена.");
    } catch { logMessage("Ошибка загрузки."); }
  }, [logMessage]);

  return {
    state, stateRef, setState,
    moveRef,
    createHero,
    requestMove,
    selectCombatAction,
    selectTarget,
    dismissReward,
    logMessage,
    saveGame,
    loadGame,
  };
}

// ─── Local helpers ────────────────────────────────────────────────────────────

function currentActor(combat: CombatState): CombatEntity | undefined {
  const id = combat.turnOrder[combat.currentTurnIndex];
  return combat.party.find(p => p.id === id);
}

function getSkillForAction(action: ActionType | null, actor: CombatEntity) {
  if (!actor) return null;
  const skills = CLASS_SKILLS[actor.class];
  if (!skills) return null;
  if (action === "SKILL_1") return skills[0];
  if (action === "SKILL_2") return skills[1];
  return null;
}

function findNextTurnIdx(combat: CombatState, currentIdx: number): { nextIdx: number; round: number } {
  const total = combat.turnOrder.length;
  let nextIdx = (currentIdx + 1) % total;
  let round   = combat.round;
  if (nextIdx === 0) round++;

  for (let i = 0; i < total; i++) {
    const id = combat.turnOrder[nextIdx];
    const alive = [...combat.party, ...combat.enemies].find(e => e.id === id)?.alive;
    if (alive) break;
    nextIdx = (nextIdx + 1) % total;
    if (nextIdx === 0) round++;
  }

  return { nextIdx, round };
}
