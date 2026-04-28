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
  // Textures
  grass: "https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?q=80&w=200&auto=format&fit=crop",
  stone: "https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?q=80&w=200&auto=format&fit=crop",
  wood:  "https://images.unsplash.com/photo-1533090161767-e6ffed986c88?q=80&w=200&auto=format&fit=crop",
  water: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?q=80&w=200&auto=format&fit=crop",
  wall:  "https://images.unsplash.com/photo-1469173479606-abc0360a0f7b?q=80&w=200&auto=format&fit=crop",
  
  // Heroes (Skins)
  warrior: "/images_user_upload/warior.jpg",
  mage:    "/images_user_upload/mag.jpg",
  rogue:   "/images_user_upload/warior.jpg",
  cleric:  "/images_user_upload/warior.jpg",
  
  // Враги
  skeleton: "/images_user_upload/skeleton.jpg",
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
          if (["grass", "stone", "wood", "water", "wall"].includes(key)) {
            patternsRef.current[key] = ctx.createPattern(img, 'repeat')!;
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
            if (isExit) drawSprite(ctx, sx, sy - 8, "#FFD700", "▼", 13);

            const item = map.items.find(i => i.x === tx && i.y === ty && !i.looted);
            if (item) drawSprite(ctx, sx, sy - 10, "#FFD700", "✦", 12);

            const enemy = map.enemies.find(e => e.x === tx && e.y === ty && !e.defeated);
            if (enemy && visible) {
               drawUnit(ctx, sx, sy, "skeleton", imagesRef.current.skeleton, false);
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
      
      drawUnit(ctx, psx, psy, s.party[0]?.class || "warrior", imagesRef.current[s.party[0]?.class || "warrior"], isActuallyMoving, true);
      
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
  const patternKey = tile === 1 ? "grass" : (tile === 2 || tile === 6) ? "stone" : (tile === 7) ? "wood" : (tile === 4) ? "water" : null;
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

function drawSprite(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number,
  bgColor: string, label: string, radius = 16
) {
  const time = Date.now() * 0.004;
  const bob = Math.sin(time) * 3; // Animation bobbing
  
  // 1. Shadow (Bottom)
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(sx, sy + 4, 14, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // 2. Base (Standee support)
  const baseH = 4;
  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.ellipse(sx, sy, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#333";
  ctx.fillRect(sx - 12, sy - baseH, 24, baseH);
  ctx.beginPath();
  ctx.ellipse(sx, sy - baseH, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // 3. Figure Sprite (Standee)
  const figY = sy - baseH + bob - 20;
  const figW = 32;
  const figH = 40;
  
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(sx - figW/2, figY - figH/2, figW, figH, 4);
  ctx.clip();
  
  const grad = ctx.createLinearGradient(sx, figY - figH/2, sx, figY + figH/2);
  grad.addColorStop(0, bgColor);
  grad.addColorStop(1, "#000");
  ctx.fillStyle = grad;
  ctx.fillRect(sx - figW/2, figY - figH/2, figW, figH);
  
  ctx.fillStyle = "#fff";
  ctx.font = `bold 20px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 4;
  ctx.fillText(label, sx, figY);
  ctx.restore();
  
  ctx.strokeStyle = "rgba(255,215,0,0.6)"; 
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(sx - figW/2, figY - figH/2, figW, figH, 4);
  ctx.stroke();
  ctx.restore();
}

function drawUnit(
  ctx: CanvasRenderingContext2D, 
  sx: number, sy: number, 
  id: string, 
  img?: HTMLImageElement,
  isMoving = false,
  isHero = false
) {
  const time = Date.now();
  const speed = isMoving ? 0.012 : 0.005;
  const cycle = time * speed;
  
  // 1. Rhythmic Walking Logic (Double-beat bobbing)
  const stepCycle = isMoving ? Math.abs(Math.sin(cycle * 1.5)) : Math.sin(cycle) * 0.5 + 0.5;
  const bob = isMoving ? stepCycle * 10 : stepCycle * 4;
  
  // 2. Alternating Tilt for Footsteps
  const tiltCycle = Math.sin(cycle * (isMoving ? 0.75 : 0.3));
  const tilt = isMoving ? tiltCycle * 0.15 : tiltCycle * 0.04;
  
  // 3. Dynamic Squash based on bob height
  const squash = 1 + (isMoving ? (10 - bob) * 0.015 : 0);
  
  const figW = isHero ? 36 : 32;
  const figH = isHero ? 48 : 40;
  const figY = sy - 4 - bob;

  // 1. Dynamic Drop Shadow
  ctx.save();
  const shadowScale = 1 - (bob / 40);
  const shadowAlpha = isMoving ? 0.3 * shadowScale : 0.4 * shadowScale;
  ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
  ctx.beginPath();
  ctx.ellipse(sx, sy + 3, 18 * shadowScale, 9 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Ground Ring (Combat feel)
  if (isHero) {
    ctx.strokeStyle = `rgba(255, 220, 100, ${isMoving ? 0.2 : 0.1})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(sx, sy, 20, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // 2. Base Plate
  ctx.save();
  ctx.fillStyle = isHero ? "#111" : "#221";
  ctx.beginPath();
  ctx.ellipse(sx, sy, 14, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 3. Figure Sprite (The "Animated" Standee)
  ctx.save();
  ctx.translate(sx, figY);
  ctx.rotate(tilt);
  ctx.scale(1 / squash, squash);

  if (img) {
    // Drawn Figure Look: No rectangular clip, just the image with a subtle rim glow
    ctx.shadowColor = isHero ? "rgba(255, 230, 100, 0.8)" : "rgba(255, 50, 50, 0.8)";
    ctx.shadowBlur = isMoving ? 12 : 6;
    ctx.drawImage(img, -figW/2, -figH/2, figW, figH);
    ctx.shadowBlur = 0;
  } else {
    // Fallback: Card standee
    ctx.beginPath();
    ctx.roundRect(-figW/2, -figH/2, figW, figH, 5);
    ctx.clip();
    const color = CLASS_COLORS[id] || "#888";
    const grad = ctx.createLinearGradient(0, -figH/2, 0, figH/2);
    grad.addColorStop(0, color);
    grad.addColorStop(1, "#000");
    ctx.fillStyle = grad;
    ctx.fillRect(-figW/2, -figH/2, figW, figH);
  }

  // Interaction rim
  if (isHero) {
    ctx.strokeStyle = `rgba(255, 220, 100, ${isMoving ? 1.0 : 0.4})`;
    ctx.lineWidth = 1.5;
    // We draw a faint box only if moving or for definition, but much more subtle
    ctx.globalAlpha = 0.3;
    ctx.strokeRect(-figW/2, -figH/2, figW, figH);
  }
  
  ctx.restore();

  // HP/Level Indicators for enemies
  if (!isHero) {
     const hpH = 3;
     ctx.fillStyle = "rgba(0,0,0,0.6)";
     ctx.fillRect(sx - 12, sy - 55, 24, hpH);
     ctx.fillStyle = "#ff3333";
     ctx.fillRect(sx - 12, sy - 55, 18, hpH); // Current HP mockup
  }
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
