import * as React from "react";
import { AnimatePresence } from "framer-motion";
import { useGameEngine } from "../hooks/use-game-engine";
import { useIsMobile } from "../hooks/use-mobile";
import { useAudio } from "../hooks/useAudio";
import { MainMenu } from "../components/game/MainMenu";
import { CharacterCreation } from "../components/game/CharacterCreation";
import { IsometricCanvas } from "../components/game/IsometricCanvas";
import { ThreeDGameView } from "../components/game/ThreeDGameView";
import { HUD } from "../components/game/HUD";
import { CombatPanel } from "../components/game/CombatPanel";
import { CombatArena } from "../components/game/CombatArena";
import { RewardScreen } from "../components/game/RewardScreen";
import { InventoryQuestPanel } from "../components/game/InventoryQuestPanel";
import { DPad } from "../components/game/DPad";
import { LocalGameState } from "../lib/types";
import { MAPS } from "../lib/game-data";

const MAP_NAMES: Record<string, string> = {
  thornwood: "Деревня Торнвуд",
  crypt:     "Склеп Забытых",
  sanctum:   "Тёмное Святилище",
};

export function GameRoot() {
  const {
    state, stateRef, setState,
    moveRef,
    createHero, requestMove,
    selectCombatAction, selectTarget,
    dismissReward,
    loadGame, saveGame, logMessage,
  } = useGameEngine();

  const [viewMode, setViewMode] = React.useState<"2D" | "3D">("3D");

  const isMobile = useIsMobile();
  const { playMusic, stopMusic, playSFX } = useAudio();

  // Music management
  React.useEffect(() => {
    switch (state.appState) {
      case "MAIN_MENU": 
        playMusic('menuMusic'); 
        break;
      case "EXPLORATION": 
        playMusic('exploreMusic'); 
        break;
      case "COMBAT": 
        playMusic('combatMusic'); 
        break;
      case "VICTORY":
        playMusic('menuMusic');
        break;
      case "GAME_OVER":
        stopMusic();
        break;
    }
  }, [state.appState, playMusic, stopMusic]);

  const isExploring = state.appState === "EXPLORATION";
  const isInBattle  = state.appState === "COMBAT";
  const isReward    = state.appState === "REWARD";
  const isInGame    = isExploring || isInBattle || isReward ||
                      state.appState === "INVENTORY" || state.appState === "QUESTS";

  const handleLoadGame = (loaded: LocalGameState) => setState(loaded);

  // Screen-shake class on crit
  const screenShake = state.combat?.screenShake;

  // Derived targeting props for CombatArena
  const isPickingTarget = state.combat?.phase === "PICK_TARGET";
  const selectedAction  = state.combat?.selectedAction ?? null;

  return (
    <div
      className={`relative w-screen h-screen bg-black overflow-hidden select-none ${
        screenShake ? "animate-screen-shake crit-flash" : ""
      }`}
    >
      {/* ── EXPLORATION / REWARD: World View ─── */}
      {isInGame && !isInBattle && (
        <div className="absolute inset-0">
          {viewMode === "3D" ? (
            <ThreeDGameView
              state={state}
              onTileClick={isExploring ? requestMove : () => {}}
            />
          ) : (
            <IsometricCanvas
              stateRef={stateRef}
              moveRef={moveRef}
              onTileClick={isExploring ? requestMove : () => {}}
            />
          )}
          
          {/* View Mode Toggle Button */}
          <button 
            onClick={() => setViewMode(v => v === "2D" ? "3D" : "2D")}
            className="absolute top-4 right-4 z-50 p-2 bg-black/60 border border-white/20 rounded-md text-[10px] text-white/60 hover:text-white hover:border-white/40 transition-all uppercase tracking-wider"
          >
            {viewMode === "3D" ? "Классика (2D)" : "Современный (3D)"}
          </button>
        </div>
      )}

      {/* ── COMBAT: Battle Arena (BattleManager / UnitSpawner pattern) ────── */}
      <AnimatePresence>
        {isInBattle && (
          <CombatArena
            state={state}
            isPickingTarget={!!isPickingTarget}
            selectedAction={selectedAction}
            onSelectTarget={selectTarget}
          />
        )}
      </AnimatePresence>

      {/* ── Main Menu ─────────────────────────────────────────────────────── */}
      {state.appState === "MAIN_MENU" && (
        <MainMenu
          onNewGame={() => setState({ ...state, appState: "CHAR_CREATION" })}
          onLoadGame={handleLoadGame}
        />
      )}

      {/* ── Character Creation ────────────────────────────────────────────── */}
      {state.appState === "CHAR_CREATION" && (
        <CharacterCreation onComplete={createHero} />
      )}

      {/* ── REWARD: post-combat screen ────────────────────────────────────── */}
      <AnimatePresence>
        {isReward && state.combatReward && (
          <RewardScreen reward={state.combatReward} onContinue={dismissReward} />
        )}
      </AnimatePresence>

      {/* ── HUD — exploration only (party is shown in CombatArena during battle) ── */}
      {(isExploring || isReward) && <HUD state={state} onSetState={setState} />}

      {/* ── Mobile D-pad — only during exploration on mobile ─────────────── */}
      {isExploring && isMobile && (
        <DPad
          px={state.partyPosition.x}
          py={state.partyPosition.y}
          onMove={requestMove}
        />
      )}

      {/* ── Combat overlay (turn strip + actions + log) ───────────────────── */}
      {isInBattle && (
        <CombatPanel
          state={state}
          onSelectAction={selectCombatAction}
          onSelectTarget={selectTarget}
        />
      )}

      {/* ── Inventory / Quest ─────────────────────────────────────────────── */}
      {(state.appState === "INVENTORY" || state.appState === "QUESTS") && (
        <>
          <HUD state={state} onSetState={setState} />
          <InventoryQuestPanel
            state={state}
            onClose={() => setState({ ...state, appState: "EXPLORATION" })}
          />
        </>
      )}

      {/* ── Zone label ────────────────────────────────────────────────────── */}
      {isExploring && (
        <div className="absolute top-18 left-1/2 -translate-x-1/2 pointer-events-none z-10">
          <div className="text-white/30 font-display text-[10px] tracking-[0.3em] uppercase">
            {MAP_NAMES[state.currentMap] ?? state.currentMap}
          </div>
        </div>
      )}

      {/* ── Game Over / Victory ───────────────────────────────────────────── */}
      {(state.appState === "GAME_OVER" || state.appState === "VICTORY") && (
        <div className="absolute inset-0 bg-black/92 flex flex-col items-center justify-center z-50 p-8 text-center">
          <div
            className={`text-5xl md:text-7xl font-display font-bold mb-6 tracking-widest ${
              state.appState === "VICTORY" ? "text-[var(--color-rpg-gold)]" : "text-red-700"
            }`}
            style={state.appState === "VICTORY"
              ? { textShadow: "0 0 40px #FFD70088, 0 0 80px #FFD70044" }
              : {}}
          >
            {state.appState === "VICTORY" ? "ПОБЕДА" : "ОТРЯД ПРОБИТ"}
          </div>
          <p className="text-base md:text-lg text-gray-300 mb-12 max-w-lg leading-relaxed italic px-4">
            {state.appState === "VICTORY"
              ? "Малахар Осквернитель повержен. Королевство обрело покой... пока."
              : "Тьма поглощает Торнвуд. Ваша история заканчивается здесь, но другая может начаться."}
          </p>
          <button onClick={() => window.location.reload()} className="rpg-button touch-manipulation">
            Вернуться в главное меню
          </button>
        </div>
      )}
    </div>
  );
}
