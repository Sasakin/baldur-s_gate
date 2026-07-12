import React from 'react'
import { CombatEntity, LocalGameState } from '../../lib/types'

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

  const { grid, gridSize, party, enemies } = combat
  const tileWidth = 80
  const tileHeight = 40
  const gridWidth = gridSize.w * tileWidth
  const gridHeight = gridSize.h * tileHeight
  const allEntities = [...party, ...enemies]
  const entityMap = new Map<string, CombatEntity>()
  allEntities.forEach(entity => {
    entityMap.set(entity.id, entity)
  })

  return (
    <div
      className="relative"
      style={{ width: gridWidth, height: gridHeight }}
    >
      {grid.map((row, y) =>
        row.map((cell, x) => {
          const isEven = (x + y) % 2 === 0
          const bgColor = isEven ? '#2a2a1a' : '#1a1a0a'
          const entityId = grid[y][x]
          const entity = entityId ? entityMap.get(entityId) : null

          return (
            <div
              key={`${x}-${y}`}
              className={`absolute transition-all duration-200 ${entity ? 'cursor-pointer hover:opacity-90' : ''}`}
              style={{
                left: x * tileWidth,
                top: y * tileHeight,
                width: tileWidth,
                height: tileHeight,
                clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                backgroundColor: bgColor,
                opacity: entity ? 0.8 : 0.4,
                border: 'none',
              }}
              onClick={() => onSelectMoveTarget(x, y)}
            >
              {entity && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <img
                    src={`${import.meta.env.BASE_URL}images/game_icons.png`}
                    alt={entity.name}
                    className="w-8 h-8"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800">
                    <div
                      className="h-full bg-green-500"
                      style={{ width: `${(entity.hp / entity.maxHp) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

const UnitTooltip: React.FC<{ entity: CombatEntity }> = ({ entity }) => (
  <div className="absolute z-10 p-2 bg-gray-800 text-white rounded shadow-lg">
    <div className="font-bold">{entity.name}</div>
    <div>HP: {entity.hp}/{entity.maxHp}</div>
  </div>
)

export default CombatGrid