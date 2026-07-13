import React, { useRef, useEffect, useState } from 'react'
import { CombatEntity, LocalGameState, COMBAT_TILE } from '../../lib/types'
import { tilesInRangeBlocking } from '../../lib/pathfinding'

// ─── Sprite config (mirrors IsometricCanvas) ────────────────────────────────
const SHEET_FRAME_W = 64
const SHEET_FRAME_H = 64
const SPRITE_MAP: Record<string, number> = {
  warrior: 0,
  mage: 1,
  rogue: 2,
  cleric: 3,
  skeleton: 6,
  goblin: 6,
  zombie: 6,
  ghost: 6,
  skeleton_archer: 7,
  goblin_archer: 7,
  wolf: 7,
  skeleton_mage: 8,
  dark_priest: 8,
  lich: 8,
  guardian: 6,
  malachar: 9,
  boss: 9,
}

const BASE = import.meta.env.BASE_URL

function getSpriteIdx(entity: CombatEntity): number {
  // Enemies use their refId (set during spawn); heroes use their class
  if (entity.isEnemy && entity.refId) {
    return SPRITE_MAP[entity.refId] ?? 0
  }
  return SPRITE_MAP[entity.class] ?? 0
}

// ─── Animated sprite component ──────────────────────────────────────────────
function EntitySprite({
  entity,
  sheet,
  frame,
  isHovered,
  isSelected,
}: {
  entity: CombatEntity
  sheet: HTMLImageElement | null
  frame: number
  isHovered?: boolean
  isSelected?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, SHEET_FRAME_W, SHEET_FRAME_H)

    if (sheet && sheet.complete && sheet.naturalWidth > 0) {
      const charIdx = getSpriteIdx(entity)
      const scale = entity.isEnemy ? 1.0 : 1.2

      // Source position in spritesheet
      const charsPerRow = 6
      const framesPerChar = 4
      const charCol = charIdx % charsPerRow
      const charRow = Math.floor(charIdx / charsPerRow)
      const srcX = (charCol * framesPerChar + frame) * SHEET_FRAME_W
      const srcY = charRow * SHEET_FRAME_H

      const drawW = SHEET_FRAME_W * scale
      const drawH = SHEET_FRAME_H * scale
      const drawX = (SHEET_FRAME_W - drawW) / 2
      const drawY = SHEET_FRAME_H - drawH

      ctx.imageSmoothingEnabled = false
      ctx.drawImage(
        sheet,
        srcX,
        srcY,
        SHEET_FRAME_W,
        SHEET_FRAME_H,
        drawX,
        drawY,
        drawW,
        drawH,
      )
    }
  }, [entity, sheet, frame])

  return (
    <canvas
      ref={canvasRef}
      width={SHEET_FRAME_W}
      height={SHEET_FRAME_H}
      className="w-10 h-10"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}

interface CombatGridProps {
  state: LocalGameState
  onSelectMoveTarget: (tx: number, ty: number) => void
}

// ─── Main CombatGrid component ──────────────────────────────────────────────
export const CombatGrid: React.FC<CombatGridProps> = ({
  state,
  onSelectMoveTarget,
}) => {
  const combat = state.combat
  if (!combat) return null

  // ── Load spritesheet ──────────────────────────────────────────────────────
  const [sheet, setSheet] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    const img = new Image()
    img.src = `${BASE}images/heroes_spritesheet.png`
    img.onload = () => setSheet(img)
  }, [])

  // ── Shared animation frame counter ───────────────────────────────────────
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(f => (f + 1) % 4)
    }, 600)
    return () => clearInterval(interval)
  }, [])

  const { grid, gridSize, party, enemies, phase, encounterGrid } = combat
  const allEntities = [...party, ...enemies]
  const entityMap = new Map<string, CombatEntity>()
  allEntities.forEach(e => entityMap.set(e.id, e))

  // ── MOVING phase: compute reachable tiles via BFS ──────────────────────
  let reachableTiles = new Set<string>()
  let currentActorId: string | null = null

  if (phase === 'MOVING') {
    const currentId = combat.turnOrder[combat.currentTurnIndex]
    const actor = [...party, ...enemies].find(e => e.id === currentId)
    if (actor && !actor.isEnemy) {
      currentActorId = actor.id

      // Build set of occupied cells (skip self)
      const occupied = new Set<string>()
      allEntities.forEach(e => {
        if (e.id !== actor.id) occupied.add(`${e.x},${e.y}`)
      })

      reachableTiles = tilesInRangeBlocking(
        encounterGrid.tiles,
        { x: actor.x, y: actor.y },
        actor.speed,
        occupied,
        `${actor.x},${actor.y}`,
      )
    }
  }

  const tileWidth = 80
  const tileHeight = 40
  const gridWidth = gridSize.w * tileWidth
  const gridHeight = gridSize.h * tileHeight

  return (
    <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
      <div
        className="relative pointer-events-auto"
        style={{ width: gridWidth, height: gridHeight }}
      >
        {encounterGrid.tiles.map((row, y) =>
          row.map((tileVal, x) => {
            const entityId = grid[y][x]
            const entity = entityId ? entityMap.get(entityId) : null
            const isCurrentActor = entityId === currentActorId
            const tileKey = `${x},${y}`
            const isReachable = !entity && reachableTiles.has(tileKey)
            const isEven = (x + y) % 2 === 0
            const isWall = tileVal === COMBAT_TILE.WALL

            // Background colour based on state
            let bgColor: string
            if (isWall) {
              bgColor = '#3a2a1a'
            } else if (isReachable) {
              bgColor = '#2a6a2a'
            } else if (isCurrentActor) {
              bgColor = '#5a5a2a'
            } else {
              bgColor = isEven ? '#2a2a1a' : '#1a1a0a'
            }

            const clickable = !!(entity || isReachable)

            return (
              <div
                key={`${x}-${y}`}
                className={`absolute transition-all duration-150 ${
                  clickable ? 'cursor-pointer' : ''
                } ${isReachable ? 'hover:brightness-125' : ''} ${
                  isCurrentActor ? 'z-10' : ''
                }`}
                style={{
                  left: x * tileWidth,
                  top: y * tileHeight,
                  width: tileWidth,
                  height: tileHeight,
                  clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                  backgroundColor: bgColor,
                  opacity: isWall
                    ? 0.9
                    : entity
                      ? 0.85
                      : isReachable
                        ? 0.75
                        : 0.4,
                  border: isCurrentActor
                    ? '2px solid rgba(255, 215, 0, 0.7)'
                    : isReachable
                      ? '1px solid rgba(100, 255, 100, 0.3)'
                      : 'none',
                  boxShadow: isReachable
                    ? 'inset 0 0 8px rgba(100, 255, 100, 0.15)'
                    : isCurrentActor
                      ? 'inset 0 0 12px rgba(255, 215, 0, 0.2)'
                      : 'none',
                }}
                onClick={() => onSelectMoveTarget(x, y)}
              >
                {/* ── Entity (hero / enemy) with animated sprite ── */}
                {entity && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-px">
                      <EntitySprite
                        entity={entity}
                        sheet={sheet}
                        frame={frame}
                      />
                      {/* HP bar */}
                      <div className="w-10 h-1 bg-gray-800 rounded">
                        <div
                          className="h-full bg-green-500 transition-all duration-300 rounded"
                          style={{
                            width: `${Math.max(
                              0,
                              (entity.hp / entity.maxHp) * 100,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Reachable tile dot indicator ── */}
                {isReachable && !entity && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-3 h-3 bg-green-400/60 rounded-full animate-pulse" />
                  </div>
                )}

                {/* ── Current actor ring ── */}
                {isCurrentActor && (
                  <div
                    className="absolute inset-0 rounded-sm pointer-events-none"
                    style={{
                      boxShadow: 'inset 0 0 6px rgba(255, 215, 0, 0.5)',
                    }}
                  />
                )}
              </div>
            )
          }),
        )}
      </div>
    </div>
  )
}

export default CombatGrid
