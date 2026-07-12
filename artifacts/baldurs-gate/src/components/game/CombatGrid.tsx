import React from 'react'
import { CombatEntity, LocalGameState, COMBAT_TILE } from '../../lib/types'
import { tilesInRangeBlocking } from '../../lib/pathfinding'

interface CombatGridProps {
  state: LocalGameState
  onSelectMoveTarget: (tx: number, ty: number) => void
}

export const CombatGrid: React.FC<CombatGridProps> = ({
  state,
  onSelectMoveTarget,
}) => {
  const combat = state.combat
  if (!combat) return null

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
        `${actor.x},${actor.y}`
      )
    }
  }

  const tileWidth = 80
  const tileHeight = 40
  const gridWidth = gridSize.w * tileWidth
  const gridHeight = gridSize.h * tileHeight

  return (
    <div
      className="relative"
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
                opacity: isWall ? 0.9 : entity ? 0.85 : isReachable ? 0.75 : 0.4,
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
              {/* ── Entity (hero / enemy) ── */}
              {entity && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <img
                    src={`${import.meta.env.BASE_URL}images/game_icons.png`}
                    alt={entity.name}
                    className="w-8 h-8"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  {/* HP bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800">
                    <div
                      className="h-full bg-green-500 transition-all duration-300"
                      style={{
                        width: `${Math.max(0, (entity.hp / entity.maxHp) * 100)}%`,
                      }}
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
                <div className="absolute inset-0 rounded-sm pointer-events-none"
                  style={{
                    boxShadow: 'inset 0 0 6px rgba(255, 215, 0, 0.5)',
                  }}
                />
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

export default CombatGrid
