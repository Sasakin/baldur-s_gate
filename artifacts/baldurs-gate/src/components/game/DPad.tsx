/**
 * DPad — виртуальный джойстик для мобильного перемещения.
 * Отображается только на мобильных устройствах во время исследования.
 * Стрелки соответствуют движению по изометрической сетке:
 *   ↖ = x-1  |  ↗ = y-1
 *   ↙ = y+1  |  ↘ = x+1
 */
import { useCallback } from "react";

interface Props {
  px: number;
  py: number;
  onMove: (x: number, y: number) => void;
}

interface DBtn {
  label: string;
  dx: number;
  dy: number;
  gridCol: number;
  gridRow: number;
}

const BUTTONS: DBtn[] = [
  { label: "↖", dx: -1, dy:  0, gridCol: 1, gridRow: 1 },
  { label: "↗", dx:  0, dy: -1, gridCol: 3, gridRow: 1 },
  { label: "↙", dx:  0, dy:  1, gridCol: 1, gridRow: 3 },
  { label: "↘", dx:  1, dy:  0, gridCol: 3, gridRow: 3 },
];

export function DPad({ px, py, onMove }: Props) {
  const handlePress = useCallback(
    (dx: number, dy: number) => {
      onMove(px + dx, py + dy);
    },
    [px, py, onMove],
  );

  return (
    <div
      className="absolute bottom-32 left-3 z-25 pointer-events-auto select-none"
      style={{ display: "grid", gridTemplateColumns: "repeat(3, 52px)", gridTemplateRows: "repeat(3, 52px)", gap: "4px" }}
    >
      {BUTTONS.map(btn => (
        <button
          key={btn.label}
          onPointerDown={e => { e.preventDefault(); handlePress(btn.dx, btn.dy); }}
          className="flex items-center justify-center rounded-sm border border-[var(--color-rpg-gold-dim)]/40 bg-black/70 text-[var(--color-rpg-gold-dim)] text-lg font-bold active:bg-[var(--color-rpg-gold-dim)]/20 active:scale-95 transition-all touch-manipulation"
          style={{
            gridColumn: btn.gridCol,
            gridRow:    btn.gridRow,
          }}
        >
          {btn.label}
        </button>
      ))}

      {/* Centre dot */}
      <div
        className="flex items-center justify-center"
        style={{ gridColumn: 2, gridRow: 2 }}
      >
        <div className="w-2 h-2 rounded-full bg-[var(--color-rpg-gold-dim)]/30" />
      </div>
    </div>
  );
}
