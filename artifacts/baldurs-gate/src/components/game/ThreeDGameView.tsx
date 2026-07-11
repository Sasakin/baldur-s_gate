import React, { useRef, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Stars, Float, SoftShadows, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { LocalGameState } from "../../lib/types";
import { MAPS } from "../../lib/game-data";
import { Point } from "../../lib/pathfinding";

interface Props {
  state: LocalGameState;
  onTileClick: (x: number, y: number) => void;
}

// Sprite sheet config (matches IsometricCanvas.tsx)
const SPRITE_SHEET_PATH = `${import.meta.env.BASE_URL}images/heroes_spritesheet.png`
const SPRITE_FRAME_W = 64
const SPRITE_FRAME_H = 64
const SPRITE_COLS = 6
const SPRITE_FRAMES = 4

// Sprite index mapping (matches IsometricCanvas.tsx)
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

const TILE_SIZE = 1;
const TILE_H = 0.4;

function Tile({ x, y, type, explored, visible, onClick }: { 
  x: number; y: number; type: number; explored: boolean; visible: boolean;
  onClick: () => void 
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const tileColor = type === 1 ? "#345e35" : // Grass
                type === 2 ? "#555555" : // Stone
                type === 3 ? "#332211" : // Wall
                type === 4 ? "#113355" : // Water
                type === 9 ? "#222222" : // Dark Wall
                "#444444";

  const color = !explored && !visible ? "#050505" : tileColor;
  const height = (type === 3 || type === 9) ? 1.5 : 0.2;
  const opacity = visible ? 1.0 : (explored ? 0.4 : 0.1);

  return (
    <mesh 
      position={[x * TILE_SIZE, height / 2, y * TILE_SIZE]} 
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      receiveShadow
      castShadow={type === 3 || type === 9}
    >
      <boxGeometry args={[TILE_SIZE * 0.95, height, TILE_SIZE * 0.95]} />
      <meshStandardMaterial 
        color={color} 
        transparent={!visible} 
        opacity={opacity}
        roughness={0.8}
      />
    </mesh>
  );
}

const CLASS_COLORS: Record<string, string> = {
  warrior: "#CC4444",
  mage:    "#4488FF",
  rogue:   "#44CC44",
  cleric:  "#CCAA44",
}

// Cache for loaded textures (shared across units of same class)
const textureCache = new Map<string, THREE.Texture>()

function Unit3D({ x, y, isHero, cls = "warrior" }: { x: number, y: number, isHero?: boolean, cls?: string }) {
  const group = useRef<THREE.Group>(null)
  const targetPos = useRef(new THREE.Vector3(x, 0, y))
  const classColor = CLASS_COLORS[cls] || "#888"
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const cacheKey = `${SPRITE_SHEET_PATH}@${cls}`

  // Load sprite texture with class-specific offset
  useEffect(() => {
    if (textureCache.has(cacheKey)) {
      setTexture(textureCache.get(cacheKey)!)
      return
    }

    const loader = new THREE.TextureLoader()
    const charIdx = SPRITE_MAP[cls] ?? (isHero ? 0 : 6)
    const charCol = charIdx % SPRITE_COLS
    const charRow = Math.floor(charIdx / SPRITE_COLS)
    
    loader.load(
      SPRITE_SHEET_PATH,
      (tex) => {
        tex.minFilter = THREE.NearestFilter
        tex.magFilter = THREE.NearestFilter
        tex.colorSpace = THREE.SRGBColorSpace
        
        // Set UV offset to show just this character's first frame
        const texFramesW = SPRITE_COLS * SPRITE_FRAMES
        const texFramesH = 2
        tex.offset.x = (charCol * SPRITE_FRAMES) / texFramesW
        tex.offset.y = (texFramesH - 1 - charRow) / texFramesH // Flip Y
        tex.repeat.x = SPRITE_FRAMES / texFramesW
        tex.repeat.y = 1 / texFramesH
        
        textureCache.set(cacheKey, tex)
        setTexture(tex)
      },
      undefined,
      () => {
        // Fallback: no texture
        setTexture(null)
      }
    )

    return () => {
      // Note: we keep the cache, don't dispose on unmount
    }
  }, [cacheKey, isHero, cls])

  useFrame((state, delta) => {
    if (group.current) {
      group.current.position.lerp(targetPos.current, 0.15)
      
      const isMoving = group.current.position.distanceTo(targetPos.current) > 0.05
      const time = state.clock.getElapsedTime()
      
      if (isMoving) {
        group.current.position.y = Math.abs(Math.sin(time * 12)) * 0.25 + 0.5
        const dx = targetPos.current.x - group.current.position.x
        const dz = targetPos.current.z - group.current.position.z
        if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
          const angle = Math.atan2(dx, dz)
          group.current.rotation.y = angle
        }
        group.current.rotation.z = Math.sin(time * 12) * 0.1
      } else {
        group.current.position.y = Math.sin(time * 2) * 0.05 + 0.5
        group.current.rotation.z = 0
      }
    }
  })

  return (
    <group ref={group} position={[x, 0.5, y]}>
      {/* Always keep the base box as shadow receiver */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.45, 0.75, 0.1]} />
        <meshStandardMaterial color={classColor} roughness={0.4} metalness={0.6} />
      </mesh>

      {/* Sprite plane with class texture */}
      {texture && (
        <sprite position={[0, 0.4, 0]} scale={[0.75, 0.75, 1]}>
          <spriteMaterial
            map={texture}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      )}

      {/* Pedestal Base */}
      <mesh position={[0, -0.45, 0]} receiveShadow>
        <cylinderGeometry args={[0.35, 0.4, 0.1, 24]} />
        <meshStandardMaterial color="#222" />
      </mesh>

      {isHero && (
        <mesh position={[0, -0.48, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.45, 0.5, 32]} />
          <meshBasicMaterial color={classColor} transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  )
}

function GameScene({ state, onTileClick }: Props) {
  const map = MAPS[state.currentMap];
  const rows = map.grid.length;
  const cols = map.grid[0]?.length ?? 0;

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[state.partyPosition.x, 2, state.partyPosition.y]} intensity={2} distance={10} color="#ffaa55" />
      <directionalLight 
        position={[20, 30, 20]} 
        intensity={1.2} 
        castShadow 
        shadow-mapSize={[2048, 2048]}
      />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      
      <group>
        {map.grid.map((row, y) => 
          row.map((type, x) => {
            const tileKey = `${state.currentMap}_${x}_${y}`;
            const explored = state.exploredTiles[tileKey];
            const dist = Math.abs(state.partyPosition.x - x) + Math.abs(state.partyPosition.y - y);
            const visible = dist <= 8; // Consistent vision distance
            
            return (
              <Tile 
                key={`${x}-${y}`} 
                x={x} y={y} 
                type={type} 
                explored={explored} 
                visible={visible}
                onClick={() => onTileClick(x, y)}
              />
            );
          })
        )}
      </group>

      {/* Infinite Ground Plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cols/2, -0.1, rows/2]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#020205" roughness={1} metalness={0} />
      </mesh>

      <Unit3D 
        x={state.partyPosition.x} 
        y={state.partyPosition.y} 
        isHero 
        cls={state.party[0]?.class}
      />

      {map.enemies.filter(e => !e.defeated).map((e, idx) => {
         const tileKey = `${state.currentMap}_${e.x}_${e.y}`;
         const dist = Math.abs(state.partyPosition.x - e.x) + Math.abs(state.partyPosition.y - e.y);
         const visible = dist <= 8;
         if (!visible) return null;
         
         return (
           <Unit3D key={`enemy-${idx}`} x={e.x} y={e.y} cls={e.refId} />
         );
      })}

      <ContactShadows 
         position={[cols/2, 0.01, rows/2]} 
         opacity={0.4} 
         scale={30} 
         blur={2} 
         far={4} 
      />
    </>
  );
}

export function ThreeDGameView({ state, onTileClick }: Props) {
  return (
    <div className="w-full h-full bg-[#050510]">
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[10, 12, 10]} fov={45} />
        <OrbitControls 
          enablePan={true}
          maxPolarAngle={Math.PI / 2.5}
          minDistance={5}
          maxDistance={25}
          target={[state.partyPosition.x, 0, state.partyPosition.y]}
        />
        <GameScene state={state} onTileClick={onTileClick} />
      </Canvas>
      
      {/* UI Overlay for 3D controls info */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 pointer-events-none text-center">
        <p className="text-[10px] text-white/40 uppercase tracking-[0.3em] mb-1">Режим Исследования</p>
        <p className="text-[9px] text-white/20 uppercase tracking-[0.1em]">
          ЛКМ — Вращение • ПКМ — Панорама • Колесо — Масштаб
        </p>
      </div>
    </div>
  );
}
