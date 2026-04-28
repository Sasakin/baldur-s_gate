export interface Point { x: number; y: number; }

function key(x: number, y: number) { return `${x},${y}`; }

const DIRS = [
  { x: 1, y: 0 }, { x: -1, y: 0 },
  { x: 0, y: 1 }, { x: 0, y: -1 },
];

export function bfsPath(
  grid: number[][],
  from: Point,
  to: Point,
  maxDist = 50
): Point[] {
  if (from.x === to.x && from.y === to.y) return [];

  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  const isWalkable = (x: number, y: number) => {
    if (x < 0 || y < 0 || y >= rows || x >= cols) return false;
    const t = grid[y][x];
    return t !== 0 && t !== 3; // not void, not wall
  };

  if (!isWalkable(to.x, to.y)) return [];

  const visited = new Map<string, Point | null>();
  const queue: Point[] = [from];
  visited.set(key(from.x, from.y), null);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.x === to.x && cur.y === to.y) break;

    if (Math.abs(cur.x - from.x) + Math.abs(cur.y - from.y) > maxDist) continue;

    for (const d of DIRS) {
      const nx = cur.x + d.x;
      const ny = cur.y + d.y;
      const k = key(nx, ny);
      if (!visited.has(k) && isWalkable(nx, ny)) {
        visited.set(k, cur);
        queue.push({ x: nx, y: ny });
      }
    }
  }

  if (!visited.has(key(to.x, to.y))) return [];

  const path: Point[] = [];
  let cur: Point | null = to;
  while (cur && !(cur.x === from.x && cur.y === from.y)) {
    path.unshift(cur);
    cur = visited.get(key(cur.x, cur.y)) ?? null;
  }
  return path;
}

export function tilesInRange(
  grid: number[][],
  from: Point,
  maxDist: number
): Set<string> {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const seen = new Set<string>();
  const queue: Array<{ p: Point; dist: number }> = [{ p: from, dist: 0 }];
  seen.add(key(from.x, from.y));

  while (queue.length > 0) {
    const { p, dist } = queue.shift()!;
    if (dist >= maxDist) continue;
    for (const d of DIRS) {
      const nx = p.x + d.x;
      const ny = p.y + d.y;
      if (nx < 0 || ny < 0 || ny >= rows || nx >= cols) continue;
      const t = grid[ny][nx];
      if (t === 0 || t === 3) continue;
      const k = key(nx, ny);
      if (!seen.has(k)) {
        seen.add(k);
        queue.push({ p: { x: nx, y: ny }, dist: dist + 1 });
      }
    }
  }
  return seen;
}
