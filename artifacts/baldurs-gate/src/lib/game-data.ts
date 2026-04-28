import { CharacterStats } from "@workspace/api-client-react";
import { MapData } from "./types";

export const STARTING_GOLD = 50;

export const INITIAL_COMPANIONS: CharacterStats[] = [
  {
    id: "comp_1", name: "Elara", class: "mage", race: "elf",
    level: 1, hp: 15, maxHp: 15, mp: 30, maxMp: 30,
    strength: 8, dexterity: 12, intelligence: 16, wisdom: 10,
    experience: 0, gold: 0, alive: true
  },
  {
    id: "comp_2", name: "Doran", class: "rogue", race: "halfling",
    level: 1, hp: 20, maxHp: 20, mp: 10, maxMp: 10,
    strength: 10, dexterity: 16, intelligence: 10, wisdom: 8,
    experience: 0, gold: 0, alive: true
  },
  {
    id: "comp_3", name: "Br. Silas", class: "cleric", race: "human",
    level: 1, hp: 22, maxHp: 22, mp: 20, maxMp: 20,
    strength: 12, dexterity: 10, intelligence: 12, wisdom: 16,
    experience: 0, gold: 0, alive: true
  }
];

export const ENEMY_DB: Record<string, Omit<CharacterStats, "id" | "alive">> = {
  // ── Zone 1: Thornwood ─────────────────────────────────────────────────────
  "goblin":        { name: "Гоблин-Налётчик",     class: "rogue",   race: "human", level: 1, hp: 18,  maxHp: 18,  mp: 0,   maxMp: 0,   strength: 10, dexterity: 14, intelligence: 8,  wisdom: 8,  experience: 15,  gold: 5  },
  "goblin_archer": { name: "Гоблин-Лучник",       class: "rogue",   race: "human", level: 1, hp: 14,  maxHp: 14,  mp: 0,   maxMp: 0,   strength: 8,  dexterity: 16, intelligence: 8,  wisdom: 8,  experience: 12,  gold: 4  },
  "wolf":          { name: "Лесной Волк",          class: "warrior", race: "human", level: 1, hp: 22,  maxHp: 22,  mp: 0,   maxMp: 0,   strength: 12, dexterity: 14, intelligence: 4,  wisdom: 6,  experience: 18,  gold: 2  },
  // ── Zone 2: Crypt ─────────────────────────────────────────────────────────
  "skeleton":      { name: "Скелет Неупокоенный", class: "warrior", race: "human", level: 2, hp: 25,  maxHp: 25,  mp: 0,   maxMp: 0,   strength: 12, dexterity: 10, intelligence: 6,  wisdom: 6,  experience: 20,  gold: 8  },
  "zombie":        { name: "Чумной Зомби",         class: "warrior", race: "human", level: 2, hp: 40,  maxHp: 40,  mp: 0,   maxMp: 0,   strength: 14, dexterity: 6,  intelligence: 4,  wisdom: 4,  experience: 25,  gold: 10 },
  "ghost":         { name: "Вопящий Призрак",      class: "mage",    race: "elf",   level: 3, hp: 30,  maxHp: 30,  mp: 20,  maxMp: 20,  strength: 8,  dexterity: 16, intelligence: 12, wisdom: 10, experience: 35,  gold: 15 },
  "dark_priest":   { name: "Тёмный Жрец",          class: "cleric",  race: "human", level: 3, hp: 28,  maxHp: 28,  mp: 30,  maxMp: 30,  strength: 10, dexterity: 10, intelligence: 12, wisdom: 14, experience: 40,  gold: 20 },
  "guardian":      { name: "Страж Склепа",         class: "warrior", race: "human", level: 4, hp: 80,  maxHp: 80,  mp: 0,   maxMp: 0,   strength: 18, dexterity: 10, intelligence: 8,  wisdom: 8,  experience: 80,  gold: 40 },
  "lich":          { name: "Древний Лич",           class: "mage",    race: "elf",   level: 5, hp: 150, maxHp: 150, mp: 100, maxMp: 100, strength: 10, dexterity: 12, intelligence: 18, wisdom: 16, experience: 200, gold: 100},
  // ── Zone 3: Sanctum ───────────────────────────────────────────────────────
  "malachar":      { name: "Малахар Осквернитель", class: "mage",    race: "human", level: 10,hp: 300, maxHp: 300, mp: 200, maxMp: 200, strength: 16, dexterity: 14, intelligence: 20, wisdom: 18, experience: 500, gold: 300},
};

// Tile types:
// 0 = void (impassable, invisible)
// 1 = grass
// 2 = stone floor
// 3 = wall (impassable)
// 4 = water (impassable)
// 5 = stairs/exit
// 6 = dirt path
// 7 = building floor (tavern/shop interior tile)
// 8 = treasure chest
// 9 = tree (impassable decoration)

const W = 20; // map width
const H = 20; // map height

function makeGrid(w: number, h: number, fill: number): number[][] {
  return Array.from({ length: h }, () => Array(w).fill(fill));
}

// ─── THORNWOOD VILLAGE ──────────────────────────────────────────────────────
// A village with:
//  - Open grass fields
//  - Dirt roads crossing the map
//  - Tavern building (top-left area)
//  - Blacksmith (top-right area)
//  - Temple (center-right)
//  - Well (center)
//  - South exit to Crypt
function buildVillageGrid(): number[][] {
  const g = makeGrid(W, H, 1); // all grass

  // South wall row (edge)
  for (let x = 0; x < W; x++) { g[0][x] = 9; g[H-1][x] = 9; g[x < H ? x : H-1][0] = 9; g[x < H ? x : H-1][W-1] = 9; }

  // Dirt roads
  for (let x = 0; x < W; x++) g[10][x] = 6; // horizontal road
  for (let y = 0; y < H; y++) g[y][10] = 6;  // vertical road

  // Tavern building (rows 2-6, cols 2-6)
  for (let y = 2; y <= 6; y++) for (let x = 2; x <= 6; x++) g[y][x] = 7;
  for (let x = 2; x <= 6; x++) { g[2][x] = 3; g[6][x] = 3; } // walls
  for (let y = 2; y <= 6; y++) { g[y][2] = 3; g[y][6] = 3; } // walls
  g[6][4] = 7; // tavern entrance (open door)

  // Blacksmith (rows 2-6, cols 13-17)
  for (let y = 2; y <= 6; y++) for (let x = 13; x <= 17; x++) g[y][x] = 7;
  for (let x = 13; x <= 17; x++) { g[2][x] = 3; g[6][x] = 3; }
  for (let y = 2; y <= 6; y++) { g[y][13] = 3; g[y][17] = 3; }
  g[6][15] = 7; // blacksmith entrance

  // Temple (rows 12-17, cols 13-18)
  for (let y = 12; y <= 17; y++) for (let x = 13; x <= 18; x++) g[y][x] = 7;
  for (let x = 13; x <= 18; x++) { g[12][x] = 3; g[17][x] = 3; }
  for (let y = 12; y <= 17; y++) { g[y][13] = 3; g[y][18] = 3; }
  g[17][15] = 7; // temple entrance

  // Well (center decoration, impassable)
  g[9][9]  = 3;
  g[9][10] = 6; // road crosses
  g[9][11] = 3;

  // Trees around edges
  for (let i = 1; i < H-1; i += 3) { g[i][1] = 9; g[i][W-2] = 9; }
  for (let i = 1; i < W-1; i += 3) { g[1][i] = 9; g[H-2][i] = 9; }

  // South exit (middle bottom)
  g[H-1][10] = 5; // exit tile

  return g;
}

// ─── CRYPT OF THE FORGOTTEN ─────────────────────────────────────────────────
// A dungeon with interconnected rooms
function buildCryptGrid(): number[][] {
  const g = makeGrid(W, H, 0); // start void

  const room = (x1: number, y1: number, x2: number, y2: number) => {
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) g[y][x] = 2;
    for (let x = x1; x <= x2; x++) { g[y1][x] = 3; g[y2][x] = 3; }
    for (let y = y1; y <= y2; y++) { g[y][x1] = 3; g[y][x2] = 3; }
  };

  const corridor = (x1: number, y1: number, x2: number, y2: number) => {
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) g[y][x] = 2;
  };

  // Rooms
  room(1, 1, 6, 5);    // Entry room
  room(1, 8, 6, 12);   // West room
  room(8, 1, 13, 6);   // North room
  room(8, 8, 13, 13);  // Central chamber
  room(15, 3, 19, 8);  // East room
  room(14, 14, 19, 19); // Boss antechamber

  // Corridors between rooms
  corridor(4, 5, 4, 8);   // Entry → West
  corridor(6, 3, 8, 3);   // Entry → North
  corridor(6, 10, 8, 10); // West → Central
  corridor(11, 6, 11, 8); // North → Central
  corridor(13, 4, 15, 4); // North → East
  corridor(11, 13, 11, 15); // Central → Boss ante
  corridor(15, 10, 17, 10); // East → connects

  // Entrance (from village) – top of entry room
  g[1][4] = 5;

  // Exit to sanctum – bottom of boss antechamber
  g[19][17] = 5;

  return g;
}

// ─── DARK SANCTUM ───────────────────────────────────────────────────────────
function buildSanctumGrid(): number[][] {
  const g = makeGrid(W, H, 0);

  const room = (x1: number, y1: number, x2: number, y2: number) => {
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) g[y][x] = 2;
    for (let x = x1; x <= x2; x++) { g[y1][x] = 3; g[y2][x] = 3; }
    for (let y = y1; y <= y2; y++) { g[y][x1] = 3; g[y][x2] = 3; }
  };

  const corridor = (x1: number, y1: number, x2: number, y2: number) => {
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) g[y][x] = 2;
  };

  room(1, 1, 18, 5);      // entrance hall
  room(1, 7, 8, 12);      // west wing
  room(11, 7, 18, 12);    // east wing
  room(4, 14, 15, 19);    // boss chamber

  corridor(5, 5, 5, 7);
  corridor(14, 5, 14, 7);
  corridor(5, 12, 5, 14);
  corridor(14, 12, 14, 14);

  // Entrance from crypt
  g[1][9] = 5;

  return g;
}

export const MAPS: Record<string, MapData> = {
  "thornwood": {
    id: "thornwood",
    name: "Thornwood Village",
    grid: buildVillageGrid(),
    enemies: [
      { id: "goblin1", x: 5,  y: 14, refId: "goblin", group: ["goblin_archer"] },
      { id: "goblin2", x: 15, y: 9,  refId: "goblin", group: ["wolf", "goblin_archer"] },
    ],
    items: [
      { id: "chest_v1", x: 5,  y: 4,  refId: "chest" },
      { id: "chest_v2", x: 15, y: 4,  refId: "chest" },
      { id: "item_v1",  x: 16, y: 15, refId: "hp_potion" },
    ],
    transitions: [
      { x: 10, y: 19, targetMap: "crypt", targetX: 4, targetY: 2 }
    ]
  },
  "crypt": {
    id: "crypt",
    name: "Crypt of the Forgotten",
    grid: buildCryptGrid(),
    enemies: [
      { id: "skel1",  x: 4,  y: 9,  refId: "skeleton",   group: ["zombie"] },
      { id: "skel2",  x: 11, y: 4,  refId: "skeleton",   group: ["skeleton", "dark_priest"] },
      { id: "zombie1",x: 10, y: 11, refId: "zombie",     group: ["zombie"] },
      { id: "ghost1", x: 17, y: 6,  refId: "ghost",      group: ["dark_priest"] },
      { id: "guard1", x: 16, y: 17, refId: "guardian" },
      { id: "lich1",  x: 17, y: 17, refId: "lich",       group: ["guardian"] },
    ],
    items: [
      { id: "chest_c1", x: 4,  y: 2,  refId: "chest" },
      { id: "chest_c2", x: 11, y: 2,  refId: "chest" },
      { id: "chest_c3", x: 18, y: 7,  refId: "chest" },
      { id: "item_c1",  x: 5,  y: 10, refId: "mp_potion" },
    ],
    transitions: [
      { x: 4,  y: 1,  targetMap: "thornwood", targetX: 10, targetY: 18 },
      { x: 17, y: 19, targetMap: "sanctum",   targetX: 9,  targetY: 2  }
    ]
  },
  "sanctum": {
    id: "sanctum",
    name: "Dark Sanctum",
    grid: buildSanctumGrid(),
    enemies: [
      { id: "guard_s1", x: 4,  y: 9,  refId: "guardian" },
      { id: "guard_s2", x: 14, y: 9,  refId: "guardian" },
      { id: "malachar", x: 9,  y: 17, refId: "malachar" },
    ],
    items: [
      { id: "chest_s1", x: 2,  y: 3, refId: "chest" },
      { id: "chest_s2", x: 17, y: 3, refId: "chest" },
    ],
    transitions: [
      { x: 9, y: 1, targetMap: "crypt", targetX: 17, targetY: 18 }
    ]
  }
};
