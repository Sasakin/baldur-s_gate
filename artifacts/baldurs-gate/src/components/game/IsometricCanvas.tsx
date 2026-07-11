import React, { useEffect, useRef, useState, useCallback } from "react";
import { LocalGameState } from "../../lib/types";
import { MAPS } from "../../lib/game-data";
import { bfsPath, Point } from "../../lib/pathfinding";
import { MoveState } from "../../hooks/use-game-engine";

const TILE_W = 72;
const TILE_H = 36;
const WALL_HEIGHT = 28;

// ─── Colour palette ────────────────────────────────────────────────────────
const TILE_COLORS: Record<number, { top: string; left: string; right: string }> = {
  1: { top: "#1a2e0b", left: "#101d07", right: "#142509" }, // dark grass
  2: { top: "#242426", left: "#18181a", right: "#1e1e20" }, // stone
  3: { top: "#121214", left: "#0a0a0c", right: "#0e0e10" }, // deep wall
  4: { top: "#0a1a33", left: "#050d1a", right: "#081426" }, // deep water
  5: { top: "#3d2d14", left: "#261c0c", right: "#32230f" }, // stairs
  6: { top: "#2a1e0f", left: "#1a1309", right: "#22190c" }, // dirt
  7: { top: "#2d241b", left: "#1c1611", right: "#251d16" }, // wood floor
  8: { top: "#5c4a11", left: "#392e0a", right: "#4d3d0e" }, // chest gold
  9: { top: "#0a1c05", left: "#050e02", right: "#081504" }, // tree
};

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function toScreen(tx: number, ty: number, offsetX: number, offsetY: number) {
  return {
    sx: (tx - ty) * (TILE_W / 2) + offsetX,
    sy: (tx + ty) * (TILE_H / 2) + offsetY,
  };
}

function screenToTile(mx: number, my: number, offsetX: number, offsetY: number): Point {
  const adjX = mx - offsetX;
  const adjY = my - offsetY;
  const tileX = (adjX / (TILE_W / 2) + adjY / (TILE_H / 2)) / 2;
  const tileY = (adjY / (TILE_H / 2) - adjX / (TILE_W / 2)) / 2;
  return { x: Math.round(tileX), y: Math.round(tileY) };
}

interface Props {
  stateRef: React.MutableRefObject<LocalGameState>;
  moveRef: React.MutableRefObject<MoveState>;
  onTileClick: (x: number, y: number) => void;
}

// ─── Asset Config ─────────────────────────────────────────────────────────
const ASSETS = {
  // Textures - Using local isometric tiles
  grass: "/images/tiles/Isometric_Tiles_Pixel_Art/Blocks/blocks_1.png",
  stone: "/images/tiles/Isometric_Tiles_Pixel_Art/Blocks/blocks_30.png",
  wood:  "/images/tiles/Isometric_Tiles_Pixel_Art/Blocks/blocks_36.png",
  water: "/images/tiles/Isometric_Tiles_Pixel_Art/Blocks/blocks_2.png",
  wall:  "/images/tiles/Isometric_Tiles_Pixel_Art/Blocks/blocks_69.png",
  dirt:  "/images/tiles/Isometric_Tiles_Pixel_Art/Blocks/blocks_28.png",
  
  // Character sprite sheet (8 characters, 4 dirs, 4 frames)
  heroes: "/images/classic_heroes.png",
};

// Characters in sheet (left to right, top to bottom):
// 0: Classic Hero (warrior)
// 1: Ninja (rogue)
// 2: Knight (mage)
// 3: Viking (skeleton/enemy)
// 4: Musket Guy (cleric)
// 5: Pirate
// 6-11: variants on row 2
const SPRITE_MAP: Record<string, number> = {
  warrior: 0,
  rogue: 1,
  mage: 2,
  cleric: 4,
  skeleton: 3,
};

// Sprite sheet configuration
// Frame size: 32x32 px
const SPRITE_CFG = {
  frameW: 32,
  frameH: 32,
  charsPerRow: 6,
  framesPerChar: 4,
};

export function IsometricCanvas({ stateRef, moveRef, onTileClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<Record<string, HTMLImageElement>>({});
  const patternsRef = useRef<Record<string, CanvasPattern>>({});
  const [hoverPath, setHoverPath] = useState<Point[]>([]);
  const hoverRef = useRef<Point[]>([]);
  hoverRef.current = hoverPath;

  // For Interpolation & FX
  const vPos = useRef<Point>({ x: 0, y: 0 });
  const initRef = useRef(false);
  const dustRef = useRef<{x: number, y: number, life: number}[]>([]);

  // Preload Assets
  useEffect(() => {
    Object.entries(ASSETS).forEach(([key, url]) => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        imagesRef.current[key] = img;
      };
    });
  }, []);

  // ── Render loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const render = () => {
      animId = requestAnimationFrame(render);
      const s = stateRef.current;
      const mv = moveRef.current;

      if (!initRef.current) {
        vPos.current = { ...s.partyPosition };
        initRef.current = true;
      }

      // Smooth interpolation
      const lerpSpeed = 0.15;
      const dx = s.partyPosition.x - vPos.current.x;
      const dy = s.partyPosition.y - vPos.current.y;
      vPos.current.x += dx * lerpSpeed;
      vPos.current.y += dy * lerpSpeed;

      const isActuallyMoving = Math.abs(dx) > 0.02 || Math.abs(dy) > 0.02;

      if (s.appState !== "EXPLORATION" && s.appState !== "COMBAT") return;

      // Update patterns if images are loaded
      if (Object.keys(imagesRef.current).length > 0 && Object.keys(patternsRef.current).length === 0) {
        Object.entries(imagesRef.current).forEach(([key, img]) => {
          if (["grass", "stone", "wood", "water", "wall", "dirt"].includes(key)) {
            try {
              patternsRef.current[key] = ctx.createPattern(img, 'repeat')!;
            } catch(e) {
              console.warn('Failed to create pattern for:', key);
            }
          }
        });
      }

      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = "#010204";
      ctx.fillRect(0, 0, W, H);

      const map = MAPS[s.currentMap];
      if (!map) return;

      const px = s.partyPosition.x;
      const py = s.partyPosition.y;
      
      // Interpolated positions for camera and sprite
      const vpx = vPos.current.x;
      const vpy = vPos.current.y;

      // Camera offset: party at screen center (using visual position)
      const offsetX = W / 2 - (vpx - vpy) * (TILE_W / 2);
      const offsetY = H / 2 - (vpx + vpy) * (TILE_H / 2) + H * 0.05;

      // FX: Update Dust
      if (isActuallyMoving && Math.random() > 0.5) {
        const { sx, sy } = toScreen(vpx, vpy, offsetX, offsetY);
        dustRef.current.push({ x: sx, y: sy + 4, life: 1.0 });
      }
      dustRef.current = dustRef.current.filter(d => {
        d.life -= 0.02;
        return d.life > 0;
      });

      const pathSet = new Set(hoverRef.current.map(p => `${p.x},${p.y}`));
      const mvPathSet = mv.walking
        ? new Set(mv.path.slice(mv.stepIndex).map(p => `${p.x},${p.y}`))
        : new Set<string>();

      const rows = map.grid.length;
      const cols = map.grid[0]?.length ?? 0;

      // Draw Fog/Shadow Layer First (Hidden tiles)
      for (let ty = 0; ty < rows; ty++) {
        for (let tx = 0; tx < cols; tx++) {
          const tile = map.grid[ty][tx];
          if (tile === 0) continue;
          
          const tileKey = `${s.currentMap}_${tx}_${ty}`;
          const explored = s.exploredTiles[tileKey];
          const dist = Math.abs(px - tx) + Math.abs(py - ty);
          const visible = dist <= 6;

          if (!explored && !visible) {
             const { sx, sy } = toScreen(tx, ty, offsetX, offsetY);
             drawCloudFog(ctx, sx, sy, Date.now());
             continue;
          }

          const { sx, sy } = toScreen(tx, ty, offsetX, offsetY);
          const col = TILE_COLORS[tile] ?? TILE_COLORS[2];

          // Fog alpha
          const alpha = explored && !visible ? 0.4 : 1.0;
          ctx.globalAlpha = alpha;

          drawTileTop(ctx, sx, sy, tile, col, patternsRef.current);

          // Details
          if (visible || explored) {
            const seed = tx * 1337 + ty * 42 + tile;
            const rand = seededRandom(seed);
            if (tile === 1 && rand > 0.75) drawGrassTuft(ctx, sx, sy, rand);
            if (tile === 4) drawWaterShimmer(ctx, sx, sy, Date.now(), tx, ty);
          }

          if (tile === 3 || tile === 9) {
            drawWallSides(ctx, sx, sy, col, patternsRef.current);
          }

          if (visible || explored) {
            const k = `${tx},${ty}`;
            if (pathSet.has(k)) drawTileHighlight(ctx, sx, sy, "rgba(255,220,80,0.3)");
            if (mvPathSet.has(k)) drawTileHighlight(ctx, sx, sy, "rgba(100,200,255,0.2)");
          }

          ctx.globalAlpha = 1.0;

           // Sprites
           if (visible || explored) {
             const isExit = map.transitions.some(t => t.x === tx && t.y === ty);
             if (isExit) {
               // Draw exit marker
               ctx.fillStyle = "#FFD700";
               ctx.font = "bold 13px serif";
               ctx.textAlign = "center";
               ctx.fillText("▼", sx, sy - 8);
             }

             const item = map.items.find(i => i.x === tx && i.y === ty && !i.looted);
             if (item) {
               // Draw item marker
               ctx.fillStyle = "#FFD700";
               ctx.font = "bold 12px serif";
               ctx.textAlign = "center";
               ctx.fillText("✦", sx, sy - 10);
             }

             const enemy = map.enemies.find(e => e.x === tx && e.y === ty && !e.defeated);
             if (enemy && visible) {
                drawUnit(ctx, sx, sy, "skeleton", imagesRef.current.heroes, false);
             }
           }
        }
      }

      // FX: Draw Dust
      dustRef.current.forEach(d => {
        ctx.fillStyle = `rgba(200, 200, 180, ${d.life * 0.3})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, 4 + (1 - d.life) * 8, 0, Math.PI * 2);
        ctx.fill();
      });

      // Party (using visual position)
      const { sx: psx, sy: psy } = toScreen(vpx, vpy, offsetX, offsetY);
      drawAtmosphere(ctx, psx, psy, W, H);
      
      drawUnit(ctx, psx, psy, s.party[0]?.class || "warrior", imagesRef.current.heroes, isActuallyMoving, true);
      
      drawMiniMap(ctx, s, map, W, H, cols, rows);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  // ── Input handlers ────────────────────────────────────────────────────────
  const getOffset = useCallback((canvas: HTMLCanvasElement) => {
    const s = stateRef.current;
    const px = s.partyPosition.x;
    const py = s.partyPosition.y;
    return {
      offsetX: canvas.width / 2 - (px - py) * (TILE_W / 2),
      offsetY: canvas.height / 2 - (px + py) * (TILE_H / 2) + canvas.height * 0.05,
    };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (s.appState !== "EXPLORATION" || moveRef.current.walking) { setHoverPath([]); return; }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    const { offsetX, offsetY } = getOffset(canvas);
    const t = screenToTile(mx, my, offsetX, offsetY);
    const map = MAPS[s.currentMap];
    if (!map) return;
    const path = bfsPath(map.grid, s.partyPosition, t, 30);
    setHoverPath(path);
  }, [getOffset]);

  const handleMouseLeave = useCallback(() => setHoverPath([]), []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (s.appState !== "EXPLORATION") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    const { offsetX, offsetY } = getOffset(canvas);
    const t = screenToTile(mx, my, offsetX, offsetY);
    setHoverPath([]);
    onTileClick(t.x, t.y);
  }, [getOffset, onTileClick]);

  return (
    <canvas
      ref={canvasRef}
      width={1024}
      height={640}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="w-full h-full"
      style={{ imageRendering: "pixelated", cursor: "crosshair" }}
    />
  );
}

// ─── Draw helpers ──────────────────────────────────────────────────────────

function diamond(ctx: CanvasRenderingContext2D, sx: number, sy: number) {
  ctx.beginPath();
  ctx.moveTo(sx,            sy - TILE_H / 2);
  ctx.lineTo(sx + TILE_W / 2, sy);
  ctx.lineTo(sx,            sy + TILE_H / 2);
  ctx.lineTo(sx - TILE_W / 2, sy);
  ctx.closePath();
}

function drawTileTop(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number,
  tile: number,
  col: { top: string; left: string; right: string },
  patterns?: Record<string, CanvasPattern>
) {
  diamond(ctx, sx, sy);
  
  // 1. Base Gradient
  const g = ctx.createLinearGradient(sx, sy - 16, sx, sy + 16);
  g.addColorStop(0, col.top);
  g.addColorStop(1, col.left);
  ctx.fillStyle = g;
  ctx.fill();

  // 2. Texture Overlay
  const patternKey = tile === 1 ? "grass" : (tile === 2) ? "stone" : (tile === 6) ? "dirt" : (tile === 7) ? "wood" : (tile === 4) ? "water" : null;
  if (patternKey && patterns && patterns[patternKey]) {
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.5;
    ctx.translate(sx - 32, sy - 16); // Local alignment
    ctx.fillStyle = patterns[patternKey]!;
    diamond(ctx, 32, 16);
    ctx.fill();
    ctx.restore();
  }

  // Procedural grain
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.08;
  const hash = Math.abs(sx * 13 + sy * 37);
  if (tile === 1 || tile === 2 || tile === 6) {
    ctx.fillStyle = hash % 2 === 0 ? "#000" : "#fff";
    for(let i=0; i<3; i++) {
        const rx = sx + ((hash + i * 14) % 30 - 15);
        const ry = sy + ((hash * 7 + i * 9) % 16 - 8);
        ctx.fillRect(rx, ry, 2, 2);
    }
  }
  ctx.restore();

  // Edge definition
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx - 32, sy);
  ctx.lineTo(sx, sy - 16);
  ctx.lineTo(sx + 32, sy);
  ctx.stroke();

  if (tile !== 3 && tile !== 9) {
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
}

function drawCloudFog(ctx: CanvasRenderingContext2D, sx: number, sy: number, time: number) {
  const hash = Math.abs(sx * 1.5 + sy * 2.3);
  ctx.save();
  ctx.globalAlpha = 0.6;
  for(let i=0; i<3; i++) {
    const t = (time * 0.0005) + (i * 1.5) + (hash * 0.1);
    const ox = Math.sin(t) * 10;
    const oy = Math.cos(t * 0.7) * 5;
    const r = 20 + Math.sin(t * 1.2) * 5;
    
    const grad = ctx.createRadialGradient(sx + ox, sy + oy, 0, sx + ox, sy + oy, r);
    grad.addColorStop(0, "rgba(20, 20, 30, 0.8)");
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx + ox, sy + oy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawGrassTuft(ctx: CanvasRenderingContext2D, sx: number, sy: number, rand: number) {
  const count = 2 + Math.floor(rand * 3);
  ctx.strokeStyle = "rgba(40, 70, 30, 0.4)";
  ctx.lineWidth = 1;
  for (let i = 0; i < count; i++) {
    const ox = (seededRandom(rand + i) - 0.5) * 20;
    const oy = (seededRandom(rand + i + 1) - 0.5) * 10;
    ctx.beginPath();
    ctx.moveTo(sx + ox, sy + oy);
    ctx.lineTo(sx + ox + (seededRandom(rand + i) - 0.5) * 4, sy + oy - 4 - rand * 4);
    ctx.stroke();
  }
}

function drawStoneDetail(ctx: CanvasRenderingContext2D, sx: number, sy: number, rand: number) {
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  const ox = (seededRandom(rand) - 0.5) * 20;
  const oy = (seededRandom(rand + 1) - 0.5) * 10;
  ctx.beginPath();
  ctx.arc(sx + ox, sy + oy, 1 + rand * 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawWaterShimmer(ctx: CanvasRenderingContext2D, sx: number, sy: number, time: number, tx: number, ty: number) {
  const t = (time / 1500) + (tx + ty) * 0.5;
  const opacity = 0.1 + Math.sin(t) * 0.05;
  ctx.fillStyle = `rgba(180, 220, 255, ${opacity})`;
  ctx.beginPath();
  ctx.ellipse(sx, sy, 15, 6, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawAtmosphere(ctx: CanvasRenderingContext2D, psx: number, psy: number, W: number, H: number) {
  // 1. Dynamic Focus Light (Warmer, sharper falloff)
  const lightRadius = 450;
  const grad = ctx.createRadialGradient(psx, psy, 40, psx, psy, lightRadius);
  grad.addColorStop(0, "rgba(255, 230, 180, 0.15)"); 
  grad.addColorStop(0.25, "rgba(20, 25, 45, 0.08)");
  grad.addColorStop(0.6, "rgba(5, 5, 15, 0.6)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0.96)");

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  
  // 2. Volumetric Dust & Magic Motes
  const time = Date.now() * 0.0001;
  ctx.save();
  for (let i = 0; i < 30; i++) {
    const px = ((Math.sin(time + i * 13) * 0.5 + 0.5) * W * 1.4) - (W * 0.2);
    const py = ((Math.cos(time * 0.7 + i * 21) * 0.5 + 0.5) * H * 1.4) - (H * 0.2);
    const sz = 1.2 + Math.sin(time * 3 + i) * 0.6;
    const alpha = 0.2 + Math.sin(time * 2 + i) * 0.2;
    
    ctx.fillStyle = i % 3 === 0 ? "#ffeb3b" : (i % 3 === 1 ? "#fff" : "#64b5f6");
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(px, py, sz, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 3. Cinematic Vignette (Deep corner shadows)
  const vign = ctx.createRadialGradient(W/2, H/2, W/4, W/2, H/2, W);
  vign.addColorStop(0, "rgba(0,0,0,0)");
  vign.addColorStop(0.8, "rgba(0,0,0,0.3)");
  vign.addColorStop(1, "rgba(0,0,0,0.7)");
  ctx.fillStyle = vign;
  ctx.fillRect(0, 0, W, H);
}

function drawWallSides(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number,
  col: { top: string; left: string; right: string },
  patterns?: Record<string, CanvasPattern>
) {
  // Left face
  ctx.beginPath();
  ctx.moveTo(sx - TILE_W / 2, sy);
  ctx.lineTo(sx,               sy + TILE_H / 2);
  ctx.lineTo(sx,               sy + TILE_H / 2 + WALL_HEIGHT);
  ctx.lineTo(sx - TILE_W / 2, sy + WALL_HEIGHT);
  ctx.closePath();
  ctx.fillStyle = col.left;
  ctx.fill();

  if (patterns && patterns.wall) {
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = patterns.wall;
    ctx.fill();
    ctx.restore();
  }

  // Right face
  ctx.beginPath();
  ctx.moveTo(sx,               sy + TILE_H / 2);
  ctx.lineTo(sx + TILE_W / 2, sy);
  ctx.lineTo(sx + TILE_W / 2, sy + WALL_HEIGHT);
  ctx.lineTo(sx,               sy + TILE_H / 2 + WALL_HEIGHT);
  ctx.closePath();
  ctx.fillStyle = col.right;
  ctx.fill();

  if (patterns && patterns.wall) {
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = patterns.wall;
    ctx.fill();
    ctx.restore();
  }
}

function drawTileHighlight(ctx: CanvasRenderingContext2D, sx: number, sy: number, color: string) {
  diamond(ctx, sx, sy);
  ctx.fillStyle = color;
  ctx.fill();
}



// ─── Sprite Sheet Drawing ────────────────────────────────────────────────
const SHEET_FRAME_W = 32;
const SHEET_FRAME_H = 32;
const SHEET_COLS = 6;  // characters per row
const SHEET_ROWS = 2;  // character rows
const FRAMES_PER_CHAR = 4;  // animation frames per direction
const DIRS_PER_CHAR = 4;   // directions per character

function drawSpriteSheet(
  ctx: CanvasRenderingContext2D,
  sheet: HTMLImageElement,
  charIndex: number,
  frame: number,
  x: number, y: number,
  scale: number = 2
) {
  // Sheet: 6 chars per row, each char = 4 frames horizontally
  const charsPerRow = 6;
  const framesPerChar = 4;
  
  const charCol = charIndex % charsPerRow;
  const charRow = Math.floor(charIndex / charsPerRow);
    
  const srcX = (charCol * framesPerChar + (frame % 4)) * SHEET_FRAME_W;
  const srcY = charRow * SHEET_FRAME_H;
    
  const drawW = SHEET_FRAME_W * scale;
  const drawH = SHEET_FRAME_H * scale;
    
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet, srcX, srcY, SHEET_FRAME_W, SHEET_FRAME_H, x, y, drawW, drawH);
}

function drawUnit(
  ctx: CanvasRenderingContext2D, 
  sx: number, sy: number, 
  id: string, 
  sheet?: HTMLImageElement,
  isMoving = false,
  isHero = false
) {
  const time = Date.now();
  
  // Simple stable frame: changes every 300ms
  const frameDelay = isMoving ? 300 : 500;
  const frame = Math.floor((time % 2000) / frameDelay) % 4;
  
  // Shadow
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${isMoving ? 0.3 : 0.4})`;
  ctx.beginPath();
  ctx.ellipse(sx, sy + 2, 14, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  
  // Draw sprite
  if (sheet && sheet.complete && sheet.naturalWidth > 0) {
    const charIdx = SPRITE_MAP[id] ?? 0;
    const drawScale = isHero ? 2.2 : 1.8;
    const drawW = SHEET_FRAME_W * drawScale;
    const drawH = SHEET_FRAME_H * drawScale;
    
    // Position: sprite bottom at sy
    const drawX = sx - drawW / 2;
    const drawY = sy - drawH + 8;
    
    ctx.imageSmoothingEnabled = false;
    drawSpriteSheet(ctx, sheet, charIdx, frame, drawX, drawY, drawScale);
  } else {
    // Fallback procedural - smaller isometric-friendly size
    const figW = isHero ? 24 : 20;
    const figH = isHero ? 36 : 30;
    const bob = Math.sin(time * 0.002) * 1.5;
    const figY = sy - bob;
    
    ctx.save();
    ctx.translate(sx, figY - figH + 4);
    drawProceduralCharacter(ctx, id, -figW/2, 0, figW, figH, isHero);
    ctx.restore();
  }
  
  // HP bar for enemies
  if (!isHero) {
    const hpH = 3;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(sx - 12, sy - 45, 24, hpH);
    ctx.fillStyle = "#ff3333";
    ctx.fillRect(sx - 12, sy - 45, 18, hpH);
  }
}

function isValidCharacterSprite(img: HTMLImageElement, id: string): boolean {
  const validChars = ["warrior", "mage", "rogue", "cleric"];
  const validEnemies = ["skeleton"];
  return validChars.includes(id) || validEnemies.includes(id);
}

function drawProceduralCharacter(
  ctx: CanvasRenderingContext2D,
  id: string,
  x: number, y: number,
  w: number, h: number,
  isHero: boolean
) {
  const time = Date.now() * 0.003;
  const breathe = Math.sin(time) * 2;
  
  const baseColor = isHero 
    ? (CLASS_COLORS[id] || "#888")
    : "#4a4a4a";
  
  const lighterColor = lighten(baseColor, 0.3);
  const darkerColor = shadeColor(baseColor, -0.3);
  
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.clip();
  
  // Body/Armor base
  const bodyGrad = ctx.createLinearGradient(x, y, x, y + h);
  bodyGrad.addColorStop(0, lighterColor);
  bodyGrad.addColorStop(0.3, baseColor);
  bodyGrad.addColorStop(1, darkerColor);
  ctx.fillStyle = bodyGrad;
  ctx.fillRect(x, y, w, h);
  
  // Armor plates detail
  ctx.fillStyle = shadeColor(baseColor, -0.2);
  ctx.fillRect(x + 4, y + h * 0.3, w - 8, h * 0.15);
  ctx.fillRect(x + 6, y + h * 0.55, w - 12, h * 0.12);
  
  // Cape (for heroes)
  if (isHero) {
    const capeWave = Math.sin(time * 2) * 3;
    ctx.fillStyle = shadeColor(baseColor, -0.4);
    ctx.beginPath();
    ctx.moveTo(x + w * 0.2, y + h * 0.25);
    ctx.lineTo(x - 4 + capeWave, y + h * 0.7);
    ctx.lineTo(x + w * 0.3, y + h * 0.65);
    ctx.closePath();
    ctx.fill();
  }
  
  // Helmet/Head
  const headY = y + h * 0.1 + breathe * 0.5;
  ctx.fillStyle = isHero ? "#666" : "#3a3a3a";
  ctx.beginPath();
  ctx.arc(x + w/2, headY, w * 0.25, 0, Math.PI * 2);
  ctx.fill();
  
  // Helmet visor/face
  ctx.fillStyle = "#222";
  ctx.fillRect(x + w * 0.35, headY - 2, w * 0.3, 6);
  
  // Eyes
  ctx.fillStyle = isHero ? "#aaf" : "#f44";
  ctx.fillRect(x + w * 0.38, headY, 3, 3);
  ctx.fillRect(x + w * 0.55, headY, 3, 3);
  
  // Class-specific details
  if (id === "warrior" || id === "skeleton") {
    ctx.fillStyle = "#888";
    ctx.fillRect(x + w * 0.1, y + h * 0.75, w * 0.2, h * 0.2);
    ctx.fillRect(x + w * 0.7, y + h * 0.75, w * 0.2, h * 0.2);
  } else if (id === "mage") {
    ctx.fillStyle = "#8bf";
    ctx.beginPath();
    ctx.arc(x + w * 0.5, headY - w * 0.15, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === "rogue") {
    ctx.fillStyle = "#4a4";
    ctx.fillRect(x + w * 0.7, y + h * 0.4, w * 0.15, h * 0.05);
  } else if (id === "cleric") {
    ctx.fillStyle = "#fc4";
    ctx.beginPath();
    ctx.arc(x + w * 0.5, y + h * 0.15, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Weapon hint
  if (isHero) {
    const weaponSwing = Math.sin(time * 1.5) * 0.1;
    ctx.save();
    ctx.translate(x + w * 0.85, y + h * 0.4);
    ctx.rotate(weaponSwing - 0.3);
    ctx.fillStyle = "#aaa";
    ctx.fillRect(-2, -15, 4, 20);
    ctx.restore();
  }
  
  // Border
  ctx.strokeStyle = isHero ? "rgba(255,220,100,0.6)" : "rgba(200,50,50,0.6)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  
  ctx.restore();
}

const CLASS_COLORS: Record<string, string> = {
  warrior: "#CC4444",
  mage:    "#4488FF",
  rogue:   "#44CC44",
  cleric:  "#CCAA44",
};

const CLASS_ICONS: Record<string, string> = {
  warrior: "⚔️",
  mage:    "🔮",
  rogue:   "🏹",
  cleric:  "✝",
};

function drawMiniMap(
  ctx: CanvasRenderingContext2D,
  s: LocalGameState,
  map: { grid: number[][]; enemies: any[]; items: any[]; transitions: any[] },
  W: number, H: number,
  cols: number, rows: number
) {
  const MSCALE = 4;
  const MW = cols * MSCALE;
  const MH = rows * MSCALE;
  const MX = W - MW - 12;
  const MY = 12;

  // Background panel
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  roundRect(ctx, MX - 4, MY - 4, MW + 8, MH + 8, 4);
  ctx.fill();

  // Tiles
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const tile = map.grid[ty][tx];
      if (tile === 0) continue;
      const k = `${s.currentMap}_${tx}_${ty}`;
      if (!s.exploredTiles[k]) continue;

      let c = "#333";
      if (tile === 1) c = "#2D5A1B";
      else if (tile === 2) c = "#4A4A55";
      else if (tile === 3 || tile === 9) c = "#111";
      else if (tile === 5) c = "#8B6914";
      else if (tile === 6) c = "#5A3F1A";
      else if (tile === 7) c = "#5A4535";

      ctx.fillStyle = c;
      ctx.fillRect(MX + tx * MSCALE, MY + ty * MSCALE, MSCALE - 0.5, MSCALE - 0.5);
    }
  }

  // Enemies
  map.enemies.filter(e => !e.defeated).forEach(e => {
    const ek = `${s.currentMap}_${e.x}_${e.y}`;
    if (s.exploredTiles[ek]) {
      ctx.fillStyle = "#FF3333";
      ctx.fillRect(MX + e.x * MSCALE, MY + e.y * MSCALE, MSCALE, MSCALE);
    }
  });

  // Exits
  map.transitions.forEach(t => {
    const tk = `${s.currentMap}_${t.x}_${t.y}`;
    if (s.exploredTiles[tk]) {
      ctx.fillStyle = "#FFD700";
      ctx.fillRect(MX + t.x * MSCALE, MY + t.y * MSCALE, MSCALE, MSCALE);
    }
  });

  // Party position
  ctx.fillStyle = "#44AAFF";
  ctx.fillRect(MX + s.partyPosition.x * MSCALE - 1, MY + s.partyPosition.y * MSCALE - 1, MSCALE + 2, MSCALE + 2);

  // Border
  ctx.strokeStyle = "rgba(180,150,80,0.6)";
  ctx.lineWidth = 1;
  roundRect(ctx, MX - 4, MY - 4, MW + 8, MH + 8, 4);
  ctx.stroke();

  // Label
  ctx.fillStyle = "rgba(200,170,90,0.9)";
  ctx.font = "9px serif";
  ctx.textAlign = "center";
  ctx.fillText("КАРТА", MX + MW / 2, MY + MH + 12);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + Math.round(255 * amount));
  const g = Math.min(255, ((n >> 8)  & 0xff) + Math.round(255 * amount));
  const b = Math.min(255, ((n)       & 0xff) + Math.round(255 * amount));
  return `rgb(${r},${g},${b})`;
}

function shadeColor(hex: string, amount: number): string {
  return lighten(hex, amount);
}
