import React from 'react';
import { CombatEntity } from '../../lib/types';

interface CombatGridProps {
  grid: string[][];
  gridSize: { w: number; h: number };
  entities: CombatEntity[];
  onUnitClick: (entityId: string) => void;
  selectedTargetId: string | null;
}

const CombatGrid: React.FC<CombatGridProps> = ({
  grid,
  gridSize,
  entities,
  onUnitClick,
  selectedTargetId,
}) => {
  // Calculate tile dimensions
  const tileWidth = 80;
  const tileHeight = 40;
  
  // Calculate grid dimensions
  const gridWidth = gridSize.w * tileWidth;
  const gridHeight = gridSize.h * tileHeight;
  
  // Create a map of entity positions for quick lookup
  const entityMap = new Map<string, CombatEntity>();
  entities.forEach(entity => {
    entityMap.set(entity.id, entity);
  });
  
  return (
    <div
      className="relative"
      style={{ width: gridWidth, height: gridHeight }}
    >
      {/* Render grid tiles */}
      {grid.map((row, y) => (
        row.map((cell, x) => {
          const isEven = (x + y) % 2 === 0;
          const bgColor = isEven ? '#2a2a1a' : '#1a1a0a';
          
          // Check if there's an entity at this position
          const entityId = grid[y][x];
          const entity = entityId ? entityMap.get(entityId) : null;
          
          return (
            <div
              key={`
${x}-
${y}`}
              className={`absolute transition-all duration-200 ${entity ? 'cursor-pointer hover:opacity-90' : ''}`}
              style={{ 
                left: x * tileWidth,
                top: y * tileHeight,
                width: tileWidth,
                height: tileHeight,
                clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                backgroundColor: bgColor,
                opacity: entity ? 0.8 : 0.4,
                transform: 'skewX(-30deg)',
                transformOrigin: 'top left',
                border: selectedTargetId === entityId ? '2px solid #ff0000' : 'none',
              }}
              onClick={() => entity && onUnitClick(entity.id)}
            >
              {/* Render entity if present */}
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
                      className="h-full bg-green-500"
                      style={{ width: `${(entity.hp / entity.maxHp) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })
      ))}
    </div>
  );
};

// Tooltip component for unit info
const UnitTooltip: React.FC<{ entity: CombatEntity }> = ({ entity }) => (
  <div className="absolute z-10 p-2 bg-gray-800 text-white rounded shadow-lg">
    <div className="font-bold">{entity.name}</div>
    <div>HP: {entity.hp}/{entity.maxHp}</div>
  </div>
);

export default CombatGrid;