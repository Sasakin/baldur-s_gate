/**
 * compose-icons.cjs
 * 
 * Creates game_icons.png from LPC pixel-art head sprites.
 * Output: 256x128 px (4 cols x 2 rows, 64x64 icons)
 * 
 * Row 0: warrior(0), mage(1), rogue(2), cleric(3)
 * Row 1: skeleton(4), skeleton_archer(5), skeleton_mage(6), boss(7)
 */

const fs = require('fs')
const path = require('path')
const PNG = require('pngjs').PNG

const IMG_DIR = path.resolve(__dirname, '..')
const HERO_DIR = path.join(IMG_DIR, 'hero', 'isometric_hero')

// LPC head sheets (4096x1024)
const HEAD_FILES = {
  head1: path.join(HERO_DIR, 'male_head1.png'),
  head2: path.join(HERO_DIR, 'male_head2.png'),
  head3: path.join(HERO_DIR, 'male_head3.png'),
}

// LPC body sheets for armor colours
const BODY_FILES = {
  clothes: path.join(HERO_DIR, 'clothes.png'),
  leather: path.join(HERO_DIR, 'leather_armor.png'),
  steel: path.join(HERO_DIR, 'steel_armor.png'),
}

const OUTPUT = path.join(IMG_DIR, 'icons', 'game_icons.png')

// LPC frame layout for 4096x1024 sheets
const FRAME_W = 128
const ROW_H = 129
const CONTENT_X = 32  // Use center 64px of 128px frame
const CONTENT_Y = 40  // Focus on head area
const ICON_SIZE = 64

// Icon definitions: [sheet, head, frame_col, frame_row, tint]
const ICONS = [
  // Row 0: Heroes
  { name: 'warrior', body: 'steel', head: 'head1', col: 0, row: 0, tint: { r: 180, g: 40, b: 40, a: 0.12 } },
  { name: 'mage', body: 'clothes', head: 'head2', col: 0, row: 0, tint: { r: 60, g: 80, b: 220, a: 0.15 } },
  { name: 'rogue', body: 'leather', head: 'head2', col: 0, row: 0, tint: { r: 40, g: 160, b: 60, a: 0.12 } },
  { name: 'cleric', body: 'clothes', head: 'head3', col: 0, row: 0, tint: { r: 200, g: 170, b: 60, a: 0.15 } },
  // Row 1: Enemies
  { name: 'skeleton', body: 'steel', head: 'head1', col: 0, row: 0, tint: { r: 140, g: 140, b: 140, a: 0.25 } },
  { name: 'skeleton_archer', body: 'leather', head: 'head2', col: 0, row: 0, tint: { r: 120, g: 90, b: 60, a: 0.2 } },
  { name: 'skeleton_mage', body: 'clothes', head: 'head3', col: 0, row: 0, tint: { r: 80, g: 60, b: 160, a: 0.2 } },
  { name: 'boss', body: 'steel', head: 'head3', col: 0, row: 0, tint: { r: 180, g: 20, b: 20, a: 0.25 } },
]

function readPNG(filePath) {
  const data = fs.readFileSync(filePath)
  return PNG.sync.read(data)
}

function applyTint(frame, tint) {
  for (let i = 0; i < frame.data.length; i += 4) {
    if (frame.data[i + 3] > 10) {
      frame.data[i] = Math.min(255, Math.round(frame.data[i] * (1 - tint.a) + tint.r * tint.a))
      frame.data[i + 1] = Math.min(255, Math.round(frame.data[i + 1] * (1 - tint.a) + tint.g * tint.a))
      frame.data[i + 2] = Math.min(255, Math.round(frame.data[i + 2] * (1 - tint.a) + tint.b * tint.a))
    }
  }
}

function compose() {
  console.log('Reading LPC sprite sheets for icons...')
  
  const heads = {}
  for (const [key, filePath] of Object.entries(HEAD_FILES)) {
    if (fs.existsSync(filePath)) {
      heads[key] = readPNG(filePath)
      console.log(`  head ${key}: OK`)
    }
  }
  
  const bodies = {}
  for (const [key, filePath] of Object.entries(BODY_FILES)) {
    if (fs.existsSync(filePath)) {
      bodies[key] = readPNG(filePath)
      console.log(`  body ${key}: OK`)
    }
  }
  
  // Create output: 256x128 (4 cols x 2 rows, 64x64)
  const output = new PNG({ width: 256, height: 128 })
  for (let i = 0; i < output.data.length; i++) output.data[i] = 0
  
  for (let idx = 0; idx < ICONS.length; idx++) {
    const icon = ICONS[idx]
    const bodySheet = bodies[icon.body]
    const headSheet = heads[icon.head]
    
    if (!bodySheet || !headSheet) {
      console.log(`  SKIP ${icon.name}: sheet not found`)
      continue
    }
    
    // Extract icon from body (shoulder/chest area) with head layered on top
    const iconFrame = new PNG({ width: ICON_SIZE, height: ICON_SIZE })
    for (let i = 0; i < iconFrame.data.length; i++) iconFrame.data[i] = 0
    
    // Copy from body sheet
    const srcX = icon.col * FRAME_W + CONTENT_X
    const srcY = icon.row * ROW_H + CONTENT_Y
    
    for (let y = 0; y < ICON_SIZE; y++) {
      for (let x = 0; x < ICON_SIZE; x++) {
        const si = ((srcY + y) * bodySheet.width + (srcX + x)) * 4
        const di = (y * ICON_SIZE + x) * 4
        iconFrame.data[di] = bodySheet.data[si]
        iconFrame.data[di + 1] = bodySheet.data[si + 1]
        iconFrame.data[di + 2] = bodySheet.data[si + 2]
        iconFrame.data[di + 3] = bodySheet.data[si + 3]
      }
    }
    
    // Layer head on top (overwrite body with head pixels)
    for (let y = 0; y < ICON_SIZE; y++) {
      for (let x = 0; x < ICON_SIZE; x++) {
        const hi = ((srcY + y) * headSheet.width + (srcX + x)) * 4
        const di = (y * ICON_SIZE + x) * 4
        if (headSheet.data[hi + 3] > 0) {
          iconFrame.data[di] = headSheet.data[hi]
          iconFrame.data[di + 1] = headSheet.data[hi + 1]
          iconFrame.data[di + 2] = headSheet.data[hi + 2]
          iconFrame.data[di + 3] = headSheet.data[hi + 3]
        }
      }
    }
    
    // Apply class tint
    applyTint(iconFrame, icon.tint)
    
    // Place into output
    const outCol = idx % 4
    const outRow = Math.floor(idx / 4)
    const outX = outCol * ICON_SIZE
    const outY = outRow * ICON_SIZE
    
    for (let y = 0; y < ICON_SIZE; y++) {
      for (let x = 0; x < ICON_SIZE; x++) {
        const si = (y * ICON_SIZE + x) * 4
        const di = ((outY + y) * output.width + (outX + x)) * 4
        output.data[di] = iconFrame.data[si]
        output.data[di + 1] = iconFrame.data[si + 1]
        output.data[di + 2] = iconFrame.data[si + 2]
        output.data[di + 3] = iconFrame.data[si + 3]
      }
    }
    
    console.log(`  Composed ${icon.name} icon`)
  }
  
  // Write output
  const buf = PNG.sync.write(output)
  fs.writeFileSync(OUTPUT, buf)
  console.log(`\nWritten: ${OUTPUT}`)
  console.log(`  Size: ${output.width} x ${output.height}`)
}

compose()
