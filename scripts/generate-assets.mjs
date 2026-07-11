/**
 * Asset Generation Script
 * 
 * Generates game spritesheets, icons, and organizes downloaded assets.
 * Uses pngjs to create PNG images programmatically.
 * 
 * Usage: node scripts/generate-assets.mjs
 * 
 * License notes:
 * - Generated sprites are original creations, free to use
 * - Calciumtrice skeleton spritesheet: CC-BY 3.0
 * - Admurin monster pack skeletons: CC-BY 4.0
 * - 7Soul RPG icons: CC-BY 3.0
 */

import { PNG } from 'pngjs'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC = path.resolve(__dirname, '..', 'artifacts', 'baldurs-gate', 'public', 'images')

// ─── Helper: create a blank PNG ─────────────────────────────────────────────

function createPNG(width, height) {
  const png = new PNG({ width, height })
  // Initialize with transparent pixels
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0       // R
    png.data[i + 1] = 0   // G
    png.data[i + 2] = 0   // B
    png.data[i + 3] = 0   // A (transparent)
  }
  return png
}

function setPixel(png, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= png.width || y < 0 || y >= png.height) return
  const idx = (y * png.width + x) * 4
  png.data[idx] = r
  png.data[idx + 1] = g
  png.data[idx + 2] = b
  png.data[idx + 3] = a
}

function fillRect(png, x, y, w, h, r, g, b, a = 255) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      setPixel(png, x + dx, y + dy, r, g, b, a)
    }
  }
}

function drawCircle(png, cx, cy, radius, r, g, b, a = 255) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(png, cx + dx, cy + dy, r, g, b, a)
      }
    }
  }
}

function savePNG(png, name) {
  const buf = PNG.sync.write(png)
  const filepath = path.join(PUBLIC, name)
  fs.mkdirSync(path.dirname(filepath), { recursive: true })
  fs.writeFileSync(filepath, buf)
  const sizeKb = (buf.length / 1024).toFixed(1)
  console.log(`  ✓ ${name} (${png.width}x${png.height}, ${sizeKb} KB)`)
}

// ─── Color palettes ─────────────────────────────────────────────────────────

const CLASS_COLORS = {
  warrior: { primary: [180, 40, 40], secondary: [200, 170, 100], skin: [220, 180, 140], hair: [120, 60, 20] },
  mage:    { primary: [60, 80, 220], secondary: [180, 120, 220], skin: [230, 200, 170], hair: [40, 40, 80] },
  rogue:   { primary: [40, 160, 60], secondary: [100, 80, 60], skin: [210, 160, 120], hair: [60, 40, 20] },
  cleric:  { primary: [200, 170, 60], secondary: [220, 200, 180], skin: [215, 175, 140], hair: [140, 100, 60] },
}

const ENEMY_COLORS = {
  skeleton:       { primary: [200, 190, 170], secondary: [140, 130, 110], accent: [80, 70, 55] },
  skeleton_archer:{ primary: [190, 180, 160], secondary: [130, 100, 70], accent: [100, 60, 30] },
  skeleton_mage:  { primary: [170, 160, 200], secondary: [100, 80, 150], accent: [200, 50, 200] },
  boss:           { primary: [180, 30, 30], secondary: [60, 20, 80], accent: [255, 200, 50] },
}

// ─── Character Sprite Drawing ──────────────────────────────────────────────

function drawCharacter(png, ox, oy, cls, frame, isEnemy = false, enemyType = null) {
  const palette = isEnemy ? ENEMY_COLORS[enemyType] : CLASS_COLORS[cls]
  if (!palette) return

  const p = palette.primary
  const s = palette.secondary
  const a = palette.accent || [0, 0, 0]

  // Frame offset for walk animation
  const fOffX = Math.sin(frame * Math.PI / 2) * 1.5
  const fOffY = Math.abs(Math.sin(frame * Math.PI / 2)) * 1

  // Body (torso) - centered, slightly variable with frame
  const bodyX = ox + 32 + Math.round(fOffX)
  const bodyY = oy + 28 + Math.round(fOffY)
  const bodyW = isEnemy ? 14 : 16
  const bodyH = isEnemy ? 18 : 20

  // Shadow
  fillRect(png, ox + 20, oy + 52, 24, 4, 0, 0, 0, 40)

  if (isEnemy) {
    // ── Enemy drawing ───────────────────────────────────────────────
    drawEnemy(png, ox, oy, frame, palette, enemyType)
    return
  }

  // ── Hero drawing ─────────────────────────────────────────────────

  // Legs (animation: walking)
  const legSwing = Math.sin(frame * Math.PI / 2) * 3
  // Left leg
  fillRect(png, bodyX - 5, bodyY + bodyH - 2, 4, 8 + Math.round(legSwing * 0.5), s[0], s[1], s[2])
  // Right leg  
  fillRect(png, bodyX + 2, bodyY + bodyH - 2, 4, 8 - Math.round(legSwing * 0.5), s[0], s[1], s[2])

  // Feet
  fillRect(png, bodyX - 6, bodyY + bodyH + 5 + Math.round(legSwing * 0.3), 6, 3, 80, 60, 40)
  fillRect(png, bodyX + 1, bodyY + bodyH + 5 - Math.round(legSwing * 0.3), 6, 3, 80, 60, 40)

  // Body torso
  fillRect(png, bodyX - bodyW/2, bodyY, bodyW, bodyH, p[0], p[1], p[2])

  // Belt
  fillRect(png, bodyX - bodyW/2 - 1, bodyY + bodyH - 4, bodyW + 2, 3, s[0], s[1], s[2])

  // Arms (swing with walk)
  const armSwing = Math.sin(frame * Math.PI / 2) * 2
  fillRect(png, bodyX - bodyW/2 - 3, bodyY + 4 + Math.round(armSwing), 3, bodyH - 6, p[0], p[1], p[2])
  fillRect(png, bodyX + bodyW/2, bodyY + 4 - Math.round(armSwing), 3, bodyH - 6, p[0], p[1], p[2])

  // Class-specific details
  switch (cls) {
    case 'warrior':
      // Helmet
      fillRect(png, bodyX - 7, bodyY - 12, 14, 8, 160, 160, 160)
      fillRect(png, bodyX - 8, bodyY - 6, 2, 6, 160, 160, 160)
      fillRect(png, bodyX + 6, bodyY - 6, 2, 6, 160, 160, 160)
      // Sword (right hand)
      fillRect(png, bodyX + bodyW/2 + 3, bodyY - 2, 3, 16, 180, 180, 200)
      fillRect(png, bodyX + bodyW/2 + 2, bodyY + 14, 5, 2, 160, 120, 60)
      // Shield (left hand)
      fillRect(png, bodyX - bodyW/2 - 6, bodyY + 2, 5, 10, a[0] || 180, a[1] || 100, a[2] || 60)
      // Eyes
      setPixel(png, bodyX - 2, bodyY - 8, 255, 255, 255)
      setPixel(png, bodyX + 2, bodyY - 8, 255, 255, 255)
      break

    case 'mage':
      // Pointed hat
      fillRect(png, bodyX - 6, bodyY - 18, 12, 4, p[0], p[1], p[2])
      fillRect(png, bodyX - 6, bodyY - 22, 12, 4, p[0], p[1], p[2])
      fillRect(png, bodyX - 3, bodyY - 26, 6, 4, p[0], p[1], p[2])
      setPixel(png, bodyX, bodyY - 28, 255, 215, 0) // Star on hat
      // Staff
      fillRect(png, bodyX + bodyW/2 + 4, bodyY - 6, 2, 28, 140, 100, 60)
      drawCircle(png, bodyX + bodyW/2 + 5, bodyY - 10, 4, a[0] || 100, a[1] || 100, 255)
      // Robe effect
      fillRect(png, bodyX - bodyW/2, bodyY + bodyH - 2, bodyW, 6, p[0], p[1], p[2], 180)
      // Eyes (glowing)
      setPixel(png, bodyX - 2, bodyY - 4, 150, 150, 255)
      setPixel(png, bodyX + 2, bodyY - 4, 150, 150, 255)
      break

    case 'rogue':
      // Hood
      fillRect(png, bodyX - 6, bodyY - 12, 12, 8, 40, 80, 40)
      fillRect(png, bodyX - 5, bodyY - 8, 4, 2, 200, 160, 100) // Eyes visible
      fillRect(png, bodyX + 1, bodyY - 8, 4, 2, 200, 160, 100)
      // Daggers (both hands)
      fillRect(png, bodyX - bodyW/2 - 4, bodyY + 6, 2, 12, 180, 180, 200)
      fillRect(png, bodyX + bodyW/2 + 2, bodyY + 2, 2, 12, 180, 180, 200)
      // Dark clothes
      fillRect(png, bodyX - bodyW/2 - 1, bodyY + 4, bodyW + 2, 3, 30, 30, 40)
      // Cape
      fillRect(png, bodyX - bodyW/2 - 1, bodyY + bodyH - 4, 2, 8, 40, 80, 40, 150)
      fillRect(png, bodyX + bodyW/2 - 1, bodyY + bodyH - 4, 2, 8, 40, 80, 40, 150)
      break

    case 'cleric':
      // Hair
      fillRect(png, bodyX - 6, bodyY - 10, 12, 6, a[0] || 140, a[1] || 100, a[2] || 60)
      // Holy symbol (neck)
      drawCircle(png, bodyX, bodyY - 2, 2, 255, 215, 0)
      setPixel(png, bodyX, bodyY - 3, 255, 215, 0)
      setPixel(png, bodyX, bodyY - 1, 255, 215, 0)
      setPixel(png, bodyX - 1, bodyY - 2, 255, 215, 0)
      setPixel(png, bodyX + 1, bodyY - 2, 255, 215, 0)
      // Mace (right hand)
      fillRect(png, bodyX + bodyW/2 + 3, bodyY, 3, 16, 140, 100, 60)
      drawCircle(png, bodyX + bodyW/2 + 4, bodyY - 2, 4, 180, 180, 180)
      // Light robes
      fillRect(png, bodyX - bodyW/2, bodyY + bodyH - 4, bodyW, 8, s[0], s[1], s[2], 200)
      // Eyes (kind)
      setPixel(png, bodyX - 2, bodyY - 7, 255, 255, 200)
      setPixel(png, bodyX + 2, bodyY - 7, 255, 255, 200)
      break
  }
}

function drawEnemy(png, ox, oy, frame, palette, enemyType) {
  const p = palette.primary
  const s = palette.secondary
  const a = palette.accent

  const fOffY = Math.sin(frame * Math.PI / 2) * 1
  const bodyX = ox + 32
  const bodyY = oy + 28 + Math.round(fOffY)
  const legSwing = Math.sin(frame * Math.PI / 2) * 2

  switch (enemyType) {
    case 'skeleton':
      // Skull head
      fillRect(png, bodyX - 6, bodyY - 14, 12, 10, p[0], p[1], p[2])
      // Eye sockets
      setPixel(png, bodyX - 3, bodyY - 10, 0, 0, 0)
      setPixel(png, bodyX + 3, bodyY - 10, 0, 0, 0)
      // Mouth
      fillRect(png, bodyX - 3, bodyY - 6, 6, 2, 0, 0, 0)
      // Ribcage
      fillRect(png, bodyX - 5, bodyY, 10, 12, p[0], p[1], p[2])
      setPixel(png, bodyX - 2, bodyY + 3, 0, 0, 0)
      setPixel(png, bodyX + 2, bodyY + 3, 0, 0, 0)
      setPixel(png, bodyX - 2, bodyY + 6, 0, 0, 0)
      setPixel(png, bodyX + 2, bodyY + 6, 0, 0, 0)
      // Arms
      fillRect(png, bodyX - 8, bodyY + 2, 3, 10, p[0], p[1], p[2])
      fillRect(png, bodyX + 5, bodyY + 2, 3, 10, p[0], p[1], p[2])
      // Legs
      fillRect(png, bodyX - 4, bodyY + 12, 4, 8 + Math.round(legSwing * 0.3), s[0], s[1], s[2])
      fillRect(png, bodyX + 1, bodyY + 12, 4, 8 - Math.round(legSwing * 0.3), s[0], s[1], s[2])
      // Weapon (rusty sword)
      fillRect(png, bodyX + 8, bodyY + 2, 2, 14, 120, 120, 130)
      break

    case 'skeleton_archer':
      // Similar skeleton with bow
      fillRect(png, bodyX - 6, bodyY - 14, 12, 10, p[0], p[1], p[2])
      setPixel(png, bodyX - 3, bodyY - 10, 0, 0, 0)
      setPixel(png, bodyX + 3, bodyY - 10, 0, 0, 0)
      fillRect(png, bodyX - 3, bodyY - 6, 6, 2, 0, 0, 0)
      fillRect(png, bodyX - 5, bodyY, 10, 12, p[0], p[1], p[2])
      fillRect(png, bodyX - 4, bodyY + 12, 4, 8, s[0], s[1], s[2])
      fillRect(png, bodyX + 1, bodyY + 12, 4, 8, s[0], s[1], s[2])
      // Bow
      fillRect(png, bodyX - 10, bodyY - 2, 3, 16, 120, 80, 40)
      fillRect(png, bodyX - 9, bodyY - 4, 1, 20, 120, 80, 40)
      // Arrow
      fillRect(png, bodyX - 7, bodyY + 4, 8, 1, 180, 160, 100)
      break

    case 'skeleton_mage':
      // Skeleton with dark robes and magic
      fillRect(png, bodyX - 6, bodyY - 14, 12, 10, p[0], p[1], p[2])
      setPixel(png, bodyX - 3, bodyY - 10, 200, 50, 200) // Glowing eyes
      setPixel(png, bodyX + 3, bodyY - 10, 200, 50, 200)
      fillRect(png, bodyX - 3, bodyY - 6, 6, 2, 0, 0, 0)
      // Dark robes
      fillRect(png, bodyX - 7, bodyY - 2, 14, 16, s[0], s[1], s[2])
      fillRect(png, bodyX - 6, bodyY + 14, 12, 6, s[0], s[1], s[2])
      // Staff
      fillRect(png, bodyX + 8, bodyY - 4, 2, 22, 100, 60, 40)
      drawCircle(png, bodyX + 9, bodyY - 8, 4, a[0], a[1], a[2])
      // Arms
      fillRect(png, bodyX - 9, bodyY, 3, 8, p[0], p[1], p[2])
      fillRect(png, bodyX + 6, bodyY, 3, 8, p[0], p[1], p[2])
      break

    case 'boss':
      // Dark Lord - large imposing figure
      // Crown / Helmet
      fillRect(png, bodyX - 8, bodyY - 18, 16, 6, a[0] || 60, a[1] || 20, a[2] || 80)
      fillRect(png, bodyX - 3, bodyY - 22, 6, 4, 255, 215, 0)
      // Face
      fillRect(png, bodyX - 7, bodyY - 12, 14, 10, 100, 60, 80)
      setPixel(png, bodyX - 3, bodyY - 8, 255, 100, 50) // Glowing red eyes
      setPixel(png, bodyX + 3, bodyY - 8, 255, 100, 50)
      // Armor
      fillRect(png, bodyX - 9, bodyY - 2, 18, 18, p[0], p[1], p[2])
      fillRect(png, bodyX - 10, bodyY - 2, 2, 16, s[0], s[1], s[2])
      fillRect(png, bodyX + 8, bodyY - 2, 2, 16, s[0], s[1], s[2])
      // Cape
      fillRect(png, bodyX - 9, bodyY + 14, 18, 10, a[0] || 60, a[1] || 20, a[2] || 80, 200)
      // Greatsword
      fillRect(png, bodyX + 10, bodyY - 6, 3, 22, 150, 100, 200)
      drawCircle(png, bodyX + 11, bodyY - 10, 3, 255, 50, 50)
      // Legs
      fillRect(png, bodyX - 5, bodyY + 16, 5, 8, s[0], s[1], s[2])
      fillRect(png, bodyX + 1, bodyY + 16, 5, 8, s[0], s[1], s[2])
      break
  }
}

// ─── Main Spritesheet Generator ────────────────────────────────────────────

function generateClassSpritesheet() {
  const FRAME_W = 64
  const FRAME_H = 64
  const FRAMES = 4
  const CLASSES_PER_ROW = 6
  const TOTAL_CLASSES = 8 // 4 heroes + 4 enemies
  const ROWS = 2

  const width = CLASSES_PER_ROW * FRAME_W * FRAMES
  const height = ROWS * FRAME_H

  const png = createPNG(width, height)

  const classes = Object.keys(CLASS_COLORS)
  const enemies = Object.keys(ENEMY_COLORS)

  // Draw heroes (row 0)
  classes.forEach((cls, idx) => {
    for (let f = 0; f < FRAMES; f++) {
      const ox = idx * FRAMES * FRAME_W + f * FRAME_W
      const oy = 0
      drawCharacter(png, ox, oy, cls, f, false)
    }
  })

  // Fill remaining slots in row 0 with placeholders
  // (positions 4,5 in row 0)

  // Draw enemies (row 1)
  enemies.forEach((enemy, idx) => {
    for (let f = 0; f < FRAMES; f++) {
      const ox = idx * FRAMES * FRAME_W + f * FRAME_W
      const oy = FRAME_H
      drawCharacter(png, ox, oy, null, f, true, enemy)
    }
  })

  savePNG(png, 'heroes_spritesheet.png')
}

// ─── Icons Generator ──────────────────────────────────────────────────────

function generateClassIcons() {
  const ICON_SIZE = 64
  const COLS = 4
  const ROWS = 2
  const ICONS_PER_CLASS = 4 // classes
  const ICONS_PER_ENEMY = 4 // enemies

  const width = ICON_SIZE * COLS
  const height = ICON_SIZE * ROWS

  const png = createPNG(width, height)

  const classes = Object.keys(CLASS_COLORS)
  const enemies = Object.keys(ENEMY_COLORS)

  // Generate class icons (row 0)
  classes.forEach((cls, idx) => {
    const ox = idx * ICON_SIZE
    const oy = 0
    drawClassIcon(png, ox, oy, ICON_SIZE, cls)
  })

  // Generate enemy icons (row 1)  
  enemies.forEach((enemy, idx) => {
    const ox = idx * ICON_SIZE
    const oy = ICON_SIZE
    drawEnemyIcon(png, ox, oy, ICON_SIZE, enemy)
  })

  savePNG(png, 'icons/game_icons.png')
}

function drawClassIcon(png, ox, oy, size, cls) {
  const colors = CLASS_COLORS[cls]
  if (!colors) return

  const cx = ox + size / 2
  const cy = oy + size / 2
  const r = size / 2 - 4

  // Background circle
  drawCircle(png, cx, cy, r, colors.primary[0], colors.primary[1], colors.primary[2], 200)
  drawCircle(png, cx, cy, r + 1, colors.secondary[0], colors.secondary[1], colors.secondary[2], 80)

  switch (cls) {
    case 'warrior':
      // Shield + Sword icon
      fillRect(png, ox + 18, oy + 14, 28, 36, 180, 180, 180)
      fillRect(png, ox + 20, oy + 16, 24, 32, colors.secondary[0], colors.secondary[1], colors.secondary[2])
      // Cross on shield
      fillRect(png, ox + 28, oy + 22, 8, 20, 200, 50, 50)
      fillRect(png, ox + 22, oy + 28, 20, 8, 200, 50, 50)
      // Sword behind
      fillRect(png, ox + 40, oy + 10, 4, 30, 200, 200, 200)
      fillRect(png, ox + 38, oy + 38, 8, 4, 140, 100, 50)
      break

    case 'mage':
      // Crystal ball / Magic
      drawCircle(png, cx, cy + 4, 14, 80, 80, 220)
      drawCircle(png, cx - 2, cy + 2, 8, 150, 150, 255)
      // Stars
      setPixel(png, ox + 12, oy + 10, 255, 255, 200)
      setPixel(png, ox + 48, oy + 14, 255, 255, 200)
      setPixel(png, ox + 50, oy + 46, 200, 200, 255)
      setPixel(png, ox + 8, oy + 48, 200, 200, 255)
      break

    case 'rogue':
      // Crossed daggers
      fillRect(png, ox + 14, oy + 12, 3, 36, 180, 180, 200)
      fillRect(png, ox + 46, oy + 12, 3, 36, 180, 180, 200)
      fillRect(png, ox + 12, oy + 46, 7, 3, 140, 100, 50)
      fillRect(png, ox + 44, oy + 46, 7, 3, 140, 100, 50)
      // Diagonal arrangement
      break

    case 'cleric':
      // Holy cross symbol
      fillRect(png, ox + 26, oy + 10, 12, 44, 255, 215, 0)
      fillRect(png, ox + 14, oy + 26, 36, 12, 255, 215, 0)
      // Circle behind
      drawCircle(png, cx, cy, 22, 220, 200, 180, 60)
      break
  }
}

function drawEnemyIcon(png, ox, oy, size, enemyType) {
  const colors = ENEMY_COLORS[enemyType]
  if (!colors) return

  const cx = ox + size / 2
  const cy = oy + size / 2

  // Skull-like shape for all enemies
  drawCircle(png, cx, cy, size / 2 - 4, colors.primary[0], colors.primary[1], colors.primary[2], 200)

  switch (enemyType) {
    case 'skeleton':
      drawCircle(png, cx, cy, 16, 200, 190, 170)
      setPixel(png, cx - 5, cy - 4, 0, 0, 0) // Left eye
      setPixel(png, cx + 5, cy - 4, 0, 0, 0) // Right eye
      fillRect(png, cx - 4, cy + 4, 8, 3, 0, 0, 0) // Mouth
      break

    case 'skeleton_archer':
      drawCircle(png, cx - 2, cy - 2, 14, 190, 180, 160)
      setPixel(png, cx - 6, cy - 6, 0, 0, 0)
      setPixel(png, cx + 4, cy - 6, 0, 0, 0)
      // Bow
      fillRect(png, ox + 8, oy + 12, 3, 24, 120, 80, 40)
      break

    case 'skeleton_mage':
      drawCircle(png, cx, cy, 15, 170, 160, 200)
      setPixel(png, cx - 4, cy - 4, 200, 50, 200)
      setPixel(png, cx + 4, cy - 4, 200, 50, 200)
      // Magic glow
      drawCircle(png, cx + 12, oy + 8, 6, 200, 50, 200, 150)
      break

    case 'boss':
      drawCircle(png, cx, cy, 20, 180, 30, 30)
      fillRect(png, ox + 14, oy + 6, 36, 8, 60, 20, 80) // Crown
      setPixel(png, cx - 5, cy - 4, 255, 200, 50)
      setPixel(png, cx + 5, cy - 4, 255, 200, 50)
      fillRect(png, cx - 6, cy + 6, 12, 3, 255, 200, 50) // Crown jewels
      break
  }
}

// ─── Organize Monster Pack Sprites ────────────────────────────────────────

function organizeMonsterSprites() {
  const monstersDir = path.join(PUBLIC, 'monsters')
  if (!fs.existsSync(monstersDir)) return

  const targetDir = path.join(PUBLIC, 'enemies')
  fs.mkdirSync(targetDir, { recursive: true })

  // Move/copy monster spritesheets to enemies directory
  const sheets = [
    'Monster Pack 40 (Skeletons)/Spritesheets/Skeleton/Skeleton_Idle.png',
    'Monster Pack 40 (Skeletons)/Spritesheets/Skeleton/Skeleton_Move.png',
    'Monster Pack 40 (Skeletons)/Spritesheets/Witch Doctor/Witch_Doctor_Idle.png',
    'Monster Pack 40 (Skeletons)/Spritesheets/Witch Doctor/Witch_Doctor_Move.png',
    'Monster Pack 40 (Skeletons)/Spritesheets/Witch Doctor/Witch_Doctor_Skill.png',
  ]

  sheets.forEach(sheet => {
    const src = path.join(monstersDir, sheet)
    const name = path.basename(sheet)
    if (fs.existsSync(src)) {
      const dest = path.join(targetDir, name)
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(src, dest)
        console.log(`  ✓ enemies/${name}`)
      }
    }
  })
}

// ─── Create ATTRIBUTION.md ────────────────────────────────────────────────

function createAttribution() {
  const content = `# Asset Attributions

This game uses assets from the following sources:

## Character Sprites
- **heroes_spritesheet.png** — Original pixel art created for this project
- **classic_heroes.png** — Original sprite sheet (retained for compatibility)

## Enemy Sprites
- **skeleton_spritesheet_calciumtrice.png** — "Animated Skeleton" by Calciumtrice
  - License: CC-BY 3.0 (https://creativecommons.org/licenses/by/3.0/)
  - Source: https://opengameart.org/content/animated-skeleton
  - Author: Calciumtrice (https://calciumtrice.tumblr.com/)

- **Monster Pack Skeletons** by Admurin
  - License: CC-BY 4.0 (https://creativecommons.org/licenses/by/4.0/)
  - Source: https://opengameart.org/content/monster-pack-skeletons
  - Contains: Skeleton, Witch Doctor spritesheets (128x128px, top-down)

- **skeleton_enemy.png, skeleton_friends.png** — Original sprites (retained for compatibility)

## RPG Icons
- **icons/game_icons.png** — Original pixel art created for this project
- **icons/RPGIconsExtra/** — "98 Pixel Art RPG Icons" by 7Soul (Henrique Lazarini)
  - License: CC-BY 3.0 (https://creativecommons.org/licenses/by/3.0/)
  - Source: https://opengameart.org/content/98-pixel-art-rpg-icons
  - Author: ails.deviantart.com

## Background Images
- **combat-bg.png, main-menu-bg.png, parchment.png** — Original assets created for this project
- **hero/isometric_hero/** — Equipment sprites (weapons, armor, heads)

## Isometric Tiles
- **tiles/Isometric_Tiles_Pixel_Art/** — Isometric tile set

## 3D Textures
- **images_user_upload/** — User-uploaded 3D skin textures

---

*This file was last updated on 2026-07-11.*
`

  fs.writeFileSync(path.join(PUBLIC, 'ATTRIBUTION.md'), content, 'utf-8')
  console.log('  ✓ ATTRIBUTION.md')
}

// ─── Organize existing skeleton sprites ───────────────────────────────────

function organizeSkeletonSprites() {
  const targetDir = path.join(PUBLIC, 'enemies')
  fs.mkdirSync(targetDir, { recursive: true })

  // Copy existing skeleton sprites to enemies dir for organization
  const existingSkels = ['skeleton_enemy.png', 'skeleton_friends.png']
  existingSkels.forEach(name => {
    const src = path.join(PUBLIC, name)
    if (fs.existsSync(src)) {
      const dest = path.join(targetDir, name)
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(src, dest)
        console.log(`  ✓ enemies/${name}`)
      }
    }
  })

  // Copy calciumtrice skeleton
  const src = path.join(PUBLIC, 'skeleton_spritesheet_calciumtrice.png')
  if (fs.existsSync(src)) {
    const dest = path.join(targetDir, 'skeleton_spritesheet_calciumtrice.png')
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(src, dest)
      console.log(`  ✓ enemies/skeleton_spritesheet_calciumtrice.png`)
    }
  }
}

// ─── Create background reference markdown ─────────────────────────────────

function createBackgroundNotes() {
  const content = `Background images available:
- combat-bg.png (2498 KB, 1280x720) — for CombatArena background
- main-menu-bg.png (1941 KB, 1280x720) — for MainMenu background
- parchment.png (3337 KB) — for InventoryQuestPanel parchment texture
`
  const filepath = path.join(PUBLIC, 'BACKGROUNDS.md')
  if (!fs.existsSync(filepath)) {
    fs.writeFileSync(filepath, content, 'utf-8')
    console.log('  ✓ BACKGROUNDS.md')
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────

function main() {
  console.log('\n=== Baldur\'s Gate Asset Generator ===\n')

  // Create directories
  const dirs = ['icons', 'enemies', 'sprites']
  dirs.forEach(d => fs.mkdirSync(path.join(PUBLIC, d), { recursive: true }))

  // Generate assets
  console.log('Generating class spritesheet...')
  generateClassSpritesheet()

  console.log('Generating game icons...')
  generateClassIcons()

  console.log('Organizing monster pack sprites...')
  organizeMonsterSprites()

  console.log('Organizing skeleton sprites...')
  organizeSkeletonSprites()

  console.log('Creating attribution...')
  createAttribution()

  console.log('Creating background notes...')
  createBackgroundNotes()

  console.log('\n✓ All assets generated successfully!\n')
}

main()
