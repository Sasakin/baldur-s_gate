import React, { useRef, useEffect, useState } from 'react'
import { CombatEntity, LocalGameState, COMBAT_TILE } from '../../lib/types'
import { tilesInRangeBlocking } from '../../lib/pathfinding'
import { statBonus, getAC, getFlankingBonus } from '../../lib/combat-rules'

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

// ─── Hit chance calculation ─────────────────────────────────────────────────
function calcHitChance(actor: CombatEntity, target: CombatEntity, allyCount: number): number {
  const flanking = !actor.isEnemy ? getFlankingBonus(allyCount) : 0
  const bonus = statBonus(actor) + actor.level + flanking
  const ac = getAC(target)

  // Minimum d20 roll needed to hit (natural 1 always misses, 20 always hits)
  const minRollRequired = Math.max(2, ac - bonus)

  if (minRollRequired >= 20) return 5   // only natural 20 hits
  if (minRollRequired <= 2) return 95   // only natural 1 misses

  const hittingRolls = 20 - minRollRequired + 1
  return Math.round((hittingRolls / 20) * 100)
}

function getSpriteIdx(entity: CombatEntity): number {
  // Enemies use their refId (set during spawn); heroes use their class
  if (entity.isEnemy && entity.refId) {
    return SPRITE_MAP[entity.refId] ?? 0
  }
  return SPRITE_MAP[entity.class] ?? 0
}

// ─── Health bar with smooth animation ────────────────────────────────────────
function HealthBar({ entity }: { entity: CombatEntity }) {
  const [animatedHp, setAnimatedHp] = useState(entity.hp)
  const prevHpRef = useRef(entity.hp)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    // Skip if HP hasn't changed
    if (entity.hp === prevHpRef.current) return

    // Cancel any in-progress animation
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
    }

    const fromHp = prevHpRef.current
    const toHp = entity.hp
    const isDamage = toHp < fromHp
    const duration = isDamage ? 500 : 300 // slower for damage, faster for heal
    const startTime = performance.now()

    const animate = (now: number) => {
      const elapsed = now - startTime
      const t = Math.min(elapsed / duration, 1)
      // Cubic ease-out for smooth deceleration
      const eased = 1 - Math.pow(1 - t, 3)
      const current = fromHp + (toHp - fromHp) * eased
      setAnimatedHp(current)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }

    rafRef.current = requestAnimationFrame(animate)
    prevHpRef.current = entity.hp

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [entity.hp])

  // Sync animatedHp when entity reference changes but HP is the same (mount)
  useEffect(() => {
    setAnimatedHp(entity.hp)
    prevHpRef.current = entity.hp
  }, [entity.id, entity.hp])

  const pct = Math.max(0, (animatedHp / entity.maxHp) * 100)

  // Color: green > healthy, yellow > wounded, red > critical
  const barColor =
    pct > 60 ? '#22c55e'
      : pct > 30 ? '#eab308'
        : '#ef4444'

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[7px] text-white/90 font-bold leading-none whitespace-nowrap drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
        {entity.name}
      </span>
      <div className="w-10 h-[5px] bg-gray-900/90 rounded-full overflow-hidden border border-gray-700/50">
        <div
          className="h-full rounded-full transition-none"
          style={{
            width: `${pct}%`,
            backgroundColor: barColor,
            boxShadow: '0 0 3px rgba(0,0,0,0.5)',
          }}
        />
      </div>
    </div>
  )
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
  onSelectTarget?: (targetId: string) => void
  hoveredTargetId?: string | null
  onHoverTarget?: (id: string | null) => void
}

// ─── Main CombatGrid component ──────────────────────────────────────────────
export const CombatGrid: React.FC<CombatGridProps> = ({
  state,
  onSelectMoveTarget,
  onSelectTarget,
  hoveredTargetId,
  onHoverTarget,
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

  // ── TARGETING phase: compute current actor and hit chance ─────────────────
  const isPickingTarget = phase === 'PICK_TARGET'
  const isEnemyTargeting = isPickingTarget && (combat.selectedAction === 'ATTACK' || combat.selectedAction === 'SKILL_1' || combat.selectedAction === 'SKILL_2')
  const currentActorEntity = isPickingTarget
    ? [...party, ...enemies].find(e => e.id === combat.turnOrder[combat.currentTurnIndex])
    : null
  const alivePartyCount = party.filter(p => p.alive).length

  // Compute hovered target entity for info display
  const hoveredTargetEntity = hoveredTargetId
    ? entityMap.get(hoveredTargetId) ?? null
    : null

  const tileWidth = 80
  const tileHeight = 40
  const gridWidth = gridSize.w * tileWidth
  const gridHeight = gridSize.h * tileHeight

  // Tooltip position for hovered enemy during targeting
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)

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

            // ── Targeting state ──
            const isTargetableEnemy = isEnemyTargeting && !!entity && entity.isEnemy && entity.alive
            const isHoveredTarget = isTargetableEnemy && hoveredTargetId === entityId
            const isClickable = !!(entity || isReachable) || isTargetableEnemy

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

            // Compute hover border/glow for targeted enemy
            const hoverBorder = isHoveredTarget ? '2px solid rgba(255, 215, 0, 0.9)' : undefined
            const hoverShadow = isHoveredTarget ? 'inset 0 0 16px rgba(255, 215, 0, 0.35), 0 0 12px rgba(255, 215, 0, 0.25)' : undefined

            return (
              <div
                key={`${x}-${y}`}
                className={`absolute transition-all duration-150 ${
                  isTargetableEnemy
                    ? 'cursor-crosshair'
                    : isClickable
                      ? 'cursor-pointer'
                      : ''
                } ${isReachable ? 'hover:brightness-125' : ''} ${
                  isCurrentActor ? 'z-10' : ''
                } ${isHoveredTarget ? 'z-20' : ''}`}
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
                  border: hoverBorder
                    ?? (isCurrentActor
                      ? '2px solid rgba(255, 215, 0, 0.7)'
                      : isReachable
                        ? '1px solid rgba(100, 255, 100, 0.3)'
                        : 'none'),
                  boxShadow: hoverShadow
                    ?? (isReachable
                      ? 'inset 0 0 8px rgba(100, 255, 100, 0.15)'
                      : isCurrentActor
                        ? 'inset 0 0 12px rgba(255, 215, 0, 0.2)'
                        : 'none'),
                }}
                onClick={() => {
                  if (isTargetableEnemy) {
                    onSelectTarget?.(entity!.id)
                  } else {
                    onSelectMoveTarget(x, y)
                  }
                }}
                onMouseEnter={() => {
                  if (isTargetableEnemy) {
                    onHoverTarget?.(entity!.id)
                    setTooltipPos({ x: x * tileWidth + tileWidth / 2, y: y * tileHeight - 8 })
                  }
                }}
                onMouseLeave={() => {
                  if (isTargetableEnemy) {
                    onHoverTarget?.(null)
                    setTooltipPos(null)
                  }
                }}
              >
                {/* ── Entity (hero / enemy) with animated sprite + HP ── */}
                {entity && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-px relative">
                      <HealthBar entity={entity} />

                      {/* ── Crosshair icon on hovered target ── */}
                      {isHoveredTarget && (
                        <div className="absolute -top-1 -right-2 text-[14px] z-30 animate-pulse pointer-events-none drop-shadow-[0_0_4px_rgba(255,0,0,0.8)]">
                          🎯
                        </div>
                      )}

                      <EntitySprite
                        entity={entity}
                        sheet={sheet}
                        frame={frame}
                      />
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

        {/* ── Target info tooltip ── */}
        {isEnemyTargeting && hoveredTargetEntity && currentActorEntity && tooltipPos && (
          <TargetTooltip
            actor={currentActorEntity}
            target={hoveredTargetEntity}
            allyCount={alivePartyCount}
            pos={tooltipPos}
          />
        )}
      </div>
    </div>
  )
}

// ─── Target tooltip component ────────────────────────────────────────────────
function TargetTooltip({
  actor,
  target,
  allyCount,
  pos,
}: {
  actor: CombatEntity
  target: CombatEntity
  allyCount: number
  pos: { x: number; y: number }
}) {
  const distance = Math.abs(actor.x - target.x) + Math.abs(actor.y - target.y)
  const hitChance = calcHitChance(actor, target, allyCount)

  const hitColor =
    hitChance >= 75 ? '#22c55e'
      : hitChance >= 45 ? '#eab308'
        : '#ef4444'

  return (
    <div
      className="absolute z-50 pointer-events-none transition-all duration-100"
      style={{
        left: pos.x,
        top: pos.y,
        transform: 'translate(-50%, -100%)',
      }}
    >
      <div
        className="bg-gray-900/95 backdrop-blur-sm border border-yellow-500/40 rounded px-2.5 py-1.5 text-[10px] shadow-2xl shadow-yellow-500/10 whitespace-nowrap"
        style={{ minWidth: 130 }}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-yellow-400 font-bold text-[11px]">🎯</span>
          <span className="text-white/90 font-bold truncate max-w-[100px]">
            {target.name}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[9px]">
          <span className="text-gray-400">
            📏 <span className="text-white/80">{distance}</span> кл.
          </span>
          <span className="text-gray-400">
            🎲 Шанс: <span style={{ color: hitColor, fontWeight: 700 }}>{hitChance}%</span>
          </span>
        </div>
        {distance > 1 && (
          <div className="mt-0.5 text-[8px] text-gray-500 italic">
            Вне зоны ближнего боя
          </div>
        )}
      </div>
    </div>
  )
}

export default CombatGrid
