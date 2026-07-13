/**
 * compose-heroes.js
 * 
 * Creates a new heroes_spritesheet.png from LPC pixel-art parts.
 * 
 * Uses pngjs to extract frames from the existing LPC sprite sheets
 * (clothes.png, leather_armor.png, steel_armor.png, male_head1.png)
 * and compose them into a single spritesheet matching the code's
 * expected format:
 *   - 1536 x 128 px (24 cols x 2 rows, 64x64 frames)
 *   - Row 0: warrior(0), mage(1), rogue(2), cleric(3), (empty), (empty)
 *   - Row 1: skeleton(6), skeleton_archer(7), skeleton_mage(8), boss(9), (empty), (empty)
 * 
 * Run: node compose-heroes.js
 */

const fs = require('fs')
const path = require('path')
const PNG = require('pngjs').PNG

// Input paths
const IMG_DIR = path.resolve(__dirname, '..')
const HERO_DIR = path.join(IMG_DIR, 'hero', 'isometric_hero')

// LPC sheets (4096x1024, ~128x129 frames)
const SHEETS = {
  clothes: path.join(HERO_DIR, 'clothes.png'),
  leather: path.join(HERO_DIR, 'leather_armor.png'),
  steel: path.join(HERO_DIR, 'steel_armor.png'),
  head1: path.join(HERO_DIR, 'male_head1.png'),
  head2: path.join(HERO_DIR, 'male_head2.png'),
  head3: path.join(HERO_DIR, 'male_head3.png'),
}

// Output
const OUTPUT = path.join(IMG_DIR, 'heroes_spritesheet.png')

// Frame layout for LPC sheets (4096x1024)
// Frame width: ~128px, Row height: ~129px, Content offset Y: ~56px
const FRAME_W = 128
const ROW_H = 129
const CONTENT_Y = 56    // y-offset within each row where pixel content starts
const CONTENT_H = 64     // height of actual character content
const CONTENT_W = 64     // width of actual character content
const CONTENT_X_OFF = 32 // x-offset within each 128px frame (centered)

// Target spritesheet (64x64 frames)
const OUT_FRAME_W = 64
const OUT_FRAME_H = 64
const OUT_COLS = 24  // 6 chars x 4 frames
const OUT_ROWS = 2

// Class configurations: [body_sheet, head_sheet, frame_col_index, frame_row_index]
// Frame row: 0 = idle/down, 1 = idle/side, 2 = walk, etc.
// We use the first idle frame (column 0) for simplicity
const CLASS_CONFIG = {
  // Row 0 in output: warrior, mage, rogue, cleric
  warrior: { sheet: 'steel', head: 'head1', col: 0, row: 0 },
  mage: { sheet: 'clothes', head: 'head2', col: 0, row: 0 },
  rogue: { sheet: 'leather', head: 'head2', col: 0, row: 0 },
  cleric: { sheet: 'clothes', head: 'head3', col: 0, row: 0 },
  // Row 1 in output: skeletons (we'll use simple colored variants)
  skeleton: { sheet: 'steel', head: 'head1', col: 0, row: 1 },
  skeleton_archer: { sheet: 'leather', head: 'head2', col: 0, row: 1 },
  skeleton_mage: { sheet: 'clothes', head: 'head3', col: 0, row: 1 },
  boss: { sheet: 'steel', head: 'head1', col: 0, row: 1 },
}

// Order of characters in the output spritesheet
const CHAR_ORDER = ['warrior', 'mage', 'rogue', 'cleric', 'empty', 'empty', 'skeleton', 'skeleton_archer', 'skeleton_mage', 'boss']

/**
 * Read a PNG file and return the PNG object
 */
function readPNG(filePath) {
  const data = fs.readFileSync(filePath)
  return PNG.sync.read(data)
}

/**
 * Extract a character frame from an LPC sheet
 * Returns a 64x64 PNG
 */
function extractFrame(sheet, col, row) {
  const srcX = col * FRAME_W + CONTENT_X_OFF
  const srcY = row * ROW_H + CONTENT_Y
  
  // Create output frame (64x64)
  const frame = new PNG({ width: OUT_FRAME_W, height: OUT_FRAME_H })
  
  // Copy character content centered in the 64x64 frame
  for (let y = 0; y < CONTENT_H; y++) {
    for (let x = 0; x < CONTENT_W; x++) {
      const srcIdx = ((srcY + y) * sheet.width + (srcX + x)) * 4
      const dstIdx = (y * OUT_FRAME_W + x) * 4
      
      // Copy RGBA
      frame.data[dstIdx] = sheet.data[srcIdx]       // R
      frame.data[dstIdx + 1] = sheet.data[srcIdx + 1] // G
      frame.data[dstIdx + 2] = sheet.data[srcIdx + 2] // B
      frame.data[dstIdx + 3] = sheet.data[srcIdx + 3] // A
    }
  }
  
  return frame
}

/**
 * Apply a color tint to a frame
 */
function applyTint(frame, tintR, tintG, tintB, amount) {
  for (let i = 0; i < frame.data.length; i += 4) {
    if (frame.data[i + 3] > 0) { // Non-transparent
      frame.data[i] = Math.min(255, Math.round(frame.data[i] * (1 - amount) + tintR * amount))
      frame.data[i + 1] = Math.min(255, Math.round(frame.data[i + 1] * (1 - amount) + tintG * amount))
      frame.data[i + 2] = Math.min(255, Math.round(frame.data[i + 2] * (1 - amount) + tintB * amount))
    }
  }
}

/**
 * Layer head onto body frame
 */
function layerHead(bodyFrame, headSheet, headCol, headRow) {
  const headSrcX = headCol * FRAME_W + CONTENT_X_OFF
  const headSrcY = headRow * ROW_H + CONTENT_Y
  
  // Overwrite body pixels with head pixels where head has alpha > 0
  for (let y = 0; y < CONTENT_H; y++) {
    for (let x = 0; x < CONTENT_W; x++) {
      const headIdx = ((headSrcY + y) * headSheet.width + (headSrcX + x)) * 4
      const dstIdx = (y * OUT_FRAME_W + x) * 4
      
      const headA = headSheet.data[headIdx + 3]
      if (headA > 0) {
        bodyFrame.data[dstIdx] = headSheet.data[headIdx]       // R
        bodyFrame.data[dstIdx + 1] = headSheet.data[headIdx + 1] // G
        bodyFrame.data[dstIdx + 2] = headSheet.data[headIdx + 2] // B
        bodyFrame.data[dstIdx + 3] = headA                       // A
      }
    }
  }
}

/**
 * Add animation variation to a frame
 * Creates 4 slightly different frames for animation
 */
function createAnimationFrames(baseFrame, variationType) {
  const frames = []
  
  for (let f = 0; f < 4; f++) {
    const frame = new PNG({ width: OUT_FRAME_W, height: OUT_FRAME_H })
    
    // Copy base frame
    for (let i = 0; i < frame.data.length; i++) {
      frame.data[i] = baseFrame.data[i]
    }
    
    // Add animation variation
    if (f > 0) {
      // Shift pixels slightly for walk-like animation
      const shiftX = f % 2 === 0 ? 1 : -1
      const shiftY = f === 1 ? 1 : (f === 3 ? -1 : 0)
      
      // Apply subtle shifts by copying
      const shifted = new PNG({ width: OUT_FRAME_W, height: OUT_FRAME_H })
      for (let y = 0; y < OUT_FRAME_H; y++) {
        for (let x = 0; x < OUT_FRAME_W; x++) {
          const srcX = Math.max(0, Math.min(OUT_FRAME_W - 1, x - shiftX))
          const srcY = Math.max(0, Math.min(OUT_FRAME_H - 1, y - shiftY))
          const srcIdx = (srcY * OUT_FRAME_W + srcX) * 4
          const dstIdx = (y * OUT_FRAME_W + x) * 4
          shifted.data[dstIdx] = frame.data[srcIdx]
          shifted.data[dstIdx + 1] = frame.data[srcIdx + 1]
          shifted.data[dstIdx + 2] = frame.data[srcIdx + 2]
          shifted.data[dstIdx + 3] = frame.data[srcIdx + 3]
        }
      }
      frames.push(shifted)
    } else {
      frames.push(frame)
    }
  }
  
  return frames
}

/**
 * Main composition function
 */
function compose() {
  console.log('Reading LPC sprite sheets...')
  
  // Read all sheets
  const sheets = {}
  for (const [key, filePath] of Object.entries(SHEETS)) {
    if (fs.existsSync(filePath)) {
      sheets[key] = readPNG(filePath)
      console.log(`  ${key}: ${filePath} (${sheets[key].width}x${sheets[key].height})`)
    } else {
      console.error(`  ${key}: NOT FOUND at ${filePath}`)
      return
    }
  }
  
  // Create output spritesheet
  const output = new PNG({
    width: OUT_COLS * OUT_FRAME_W,
    height: OUT_ROWS * OUT_FRAME_H,
  })
  
  // Fill with transparent
  for (let i = 0; i < output.data.length; i++) {
    output.data[i] = 0
  }
  
  // Process each character
  for (let charIdx = 0; charIdx < CHAR_ORDER.length; charIdx++) {
    const name = CHAR_ORDER[charIdx]
    const config = CLASS_CONFIG[name]
    if (!config || name === 'empty') {
      if (name !== 'empty') console.log(`  Skipping ${name} (no config)`)
      continue
    }
    
    console.log(`  Composing ${name}...`)
    
    const sheet = sheets[config.sheet]
    if (!sheet) {
      console.log(`    Sheet ${config.sheet} not found, skipping`)
      continue
    }
    
    const headSheet = sheets[config.head]
    
    // Extract base body frame
    const baseFrame = extractFrame(sheet, config.col, config.row)
    
    // Layer head
    if (headSheet) {
      layerHead(baseFrame, headSheet, config.col, config.row)
    }
    
    // Apply class-specific color adjustments
    const tints = {
      warrior: { r: 180, g: 40, b: 40, amount: 0.15 },   // Red tint
      mage: { r: 60, g: 80, b: 220, amount: 0.2 },       // Blue tint
      rogue: { r: 40, g: 160, b: 60, amount: 0.15 },     // Green tint
      cleric: { r: 200, g: 170, b: 60, amount: 0.2 },    // Gold tint
      skeleton: { r: 180, g: 180, b: 180, amount: 0.3 },  // Desaturated/gray
      skeleton_archer: { r: 160, g: 120, b: 80, amount: 0.25 }, // Brown tint
      skeleton_mage: { r: 100, g: 80, b: 180, amount: 0.25 },   // Purple tint
      boss: { r: 200, g: 30, b: 30, amount: 0.3 },       // Dark red (demon)
    }
    
    const tint = tints[name]
    if (tint) {
      applyTint(baseFrame, tint.r, tint.g, tint.b, tint.amount)
    }
    
    // Create 4 animation frames
    const animFrames = createAnimationFrames(baseFrame, name)
    
    // Place into output spritesheet
    const outputRow = Math.floor(charIdx / 6)  // 6 chars per row
    const outputCol = charIdx % 6
    
    for (let f = 0; f < 4; f++) {
      const frame = animFrames[f]
      const outX = (outputCol * 4 + f) * OUT_FRAME_W
      const outY = outputRow * OUT_FRAME_H
      
      // Copy frame to output
      for (let y = 0; y < OUT_FRAME_H; y++) {
        for (let x = 0; x < OUT_FRAME_W; x++) {
          const srcIdx = (y * OUT_FRAME_W + x) * 4
          const dstIdx = ((outY + y) * output.width + (outX + x)) * 4
          output.data[dstIdx] = frame.data[srcIdx]
          output.data[dstIdx + 1] = frame.data[srcIdx + 1]
          output.data[dstIdx + 2] = frame.data[srcIdx + 2]
          output.data[dstIdx + 3] = frame.data[srcIdx + 3]
        }
      }
    }
  }
  
  // Write output
  const buf = PNG.sync.write(output)
  fs.writeFileSync(OUTPUT, buf)
  console.log(`\nWritten: ${OUTPUT}`)
  console.log(`  Size: ${output.width} x ${output.height}`)
  
  // Clean up temp files
  const tempDir = path.join(IMG_DIR, 'temp')
  if (fs.existsSync(tempDir)) {
    const tempFiles = fs.readdirSync(tempDir)
    for (const f of tempFiles) {
      fs.unlinkSync(path.join(tempDir, f))
    }
    fs.rmdirSync(tempDir)
    console.log('  Cleaned up temp/')
  }
  
  return output
}

compose()
