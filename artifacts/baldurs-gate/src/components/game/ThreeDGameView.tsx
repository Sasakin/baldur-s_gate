import React, { useRef, useMemo, useEffect } from "react";
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

function Unit3D({ x, y, isHero, cls = "warrior", color = "gold" }: { x: number, y: number, isHero?: boolean, cls?: string, color?: string }) {
  const group = useRef<THREE.Group>(null);
  const targetPos = useRef(new THREE.Vector3(x, 0, y));

  // Используем загруженные скины
  const skinUrl = isHero 
    ? (cls === "mage" ? "/images_user_upload/mag.jpg" : "/images_user_upload/warior.jpg")
    : "/images_user_upload/skeleton.jpg"; // Скелет для врагов

  const texture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    return loader.load(skinUrl);
  }, [skinUrl]);

  useEffect(() => {
    targetPos.current.set(x, 0, y);
  }, [x, y]);

  useFrame((state, delta) => {
    if (group.current) {
      group.current.position.lerp(targetPos.current, 0.15);
      
      const isMoving = group.current.position.distanceTo(targetPos.current) > 0.05;
      const time = state.clock.getElapsedTime();
      
      if (isMoving) {
        group.current.position.y = Math.abs(Math.sin(time * 12)) * 0.25 + 0.5;
        const dx = targetPos.current.x - group.current.position.x;
        const dz = targetPos.current.z - group.current.position.z;
        if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
          const angle = Math.atan2(dx, dz);
          group.current.rotation.y = angle;
        }
        group.current.rotation.z = Math.sin(time * 12) * 0.1;
      } else {
        group.current.position.y = Math.sin(time * 2) * 0.05 + 0.5;
        group.current.rotation.z = 0;
      }
    }
  });

  return (
    <group ref={group} position={[x, 0.5, y]}>
      {/* Front Face Sprite for Skin */}
      <mesh position={[0, 0, 0.06]} castShadow>
        <planeGeometry args={[0.6, 0.8]} />
        <meshStandardMaterial map={texture} transparent alphaTest={0.5} />
      </mesh>
      
      {/* Back Face Sprite */}
      <mesh position={[0, 0, -0.06]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.6, 0.8]} />
        <meshStandardMaterial map={texture} transparent alphaTest={0.5} />
      </mesh>

      {/* Body Core */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.45, 0.75, 0.1]} />
        <meshStandardMaterial color="#222" roughness={0.1} metalness={0.8} />
      </mesh>

      {/* Pedestal Base */}
      <mesh position={[0, -0.45, 0]} receiveShadow>
        <cylinderGeometry args={[0.35, 0.4, 0.1, 24]} />
        <meshStandardMaterial color="#111" />
      </mesh>

      {isHero && (
        <mesh position={[0, -0.48, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.45, 0.5, 32]} />
          <meshBasicMaterial color="#ffd700" transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  );
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
        color="#ffcc00"
      />

      {map.enemies.filter(e => !e.defeated).map((e, idx) => {
         const tileKey = `${state.currentMap}_${e.x}_${e.y}`;
         const dist = Math.abs(state.partyPosition.x - e.x) + Math.abs(state.partyPosition.y - e.y);
         const visible = dist <= 8;
         if (!visible) return null;
         
         return (
           <Unit3D key={`enemy-${idx}`} x={e.x} y={e.y} color="#ff3333" />
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
