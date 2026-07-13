/**
 * Particle System — Canvas 2D lightweight particle engine for combat VFX.
 *
 * Architecture:
 *   • ParticlePool — manages lifecycle of all particles for one overlay
 *   • Emitter functions — one per effect type, returns a batch of particles
 *   • Single RAF loop per active pool instance
 *
 * Fire-and-forget: createEffectPool(canvas), call pool.emit('hit', x, y),
 * it auto-removes itself after all particles die.
 */

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number     // remaining life 0..1
  maxLife: number  // total life in ms
  size: number
  color: string
  alpha: number
  gravity: number
  friction: number
  rotation: number
  rotationSpeed: number
  shape: 'circle' | 'ring' | 'star' | 'line' | 'spark'
  born: number     // timestamp when created
}

export type EffectType = 'hit' | 'blood' | 'miss' | 'magic' | 'heal' | 'crit' | 'dodge' | 'fire' | 'ice' | 'holy'

interface EmitConfig {
  x: number
  y: number
  count?: number
  color?: string
  secondaryColor?: string
  intensity?: number // 0..1 multiplier
}

// ─── Colour palette ─────────────────────────────────────────────────────────

const COLORS = {
  hit:     ['#FFFFFF', '#FFD700', '#FFAA00', '#FFEE88'],
  blood:   ['#CC2222', '#AA1111', '#881111', '#FF4444'],
  magic:   ['#8844FF', '#AA66FF', '#6644CC', '#CC88FF', '#FFFFFF'],
  heal:    ['#44FF88', '#66FFAA', '#22CC66', '#AAFFCC', '#FFFFFF'],
  crit:    ['#FF6600', '#FF4400', '#FFAA00', '#FF8800', '#FFFFFF'],
  dodge:   ['#88FFFF', '#66DDDD', '#44BBBB', '#AAFFFF'],
  fire:    ['#FF6600', '#FF4400', '#FFCC00', '#FF8800', '#FFFF44'],
  ice:     ['#88CCFF', '#66AAFF', '#4488DD', '#AAEEFF', '#FFFFFF'],
  holy:    ['#FFFFAA', '#FFEE88', '#FFDD44', '#FFFFFF'],
}

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)]
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

// ─── Particle pool ──────────────────────────────────────────────────────────

export class ParticlePool {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private particles: Particle[] = []
  private animationId: number | null = null
  private lastTick: number = 0
  private active: boolean = false

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Cannot get 2D context')
    this.ctx = ctx
  }

  /** Resize the backing canvas to match parent */
  resize(w: number, h: number) {
    const dpr = window.devicePixelRatio || 1
    this.canvas.width = w * dpr
    this.canvas.height = h * dpr
    this.canvas.style.width = `${w}px`
    this.canvas.style.height = `${h}px`
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  /** Emit one effect at position (percentage 0..100) */
  emit(type: EffectType, xPct: number, yPct: number, intensity: number = 1) {
    const w = this.canvas.width / (window.devicePixelRatio || 1)
    const h = this.canvas.height / (window.devicePixelRatio || 1)
    const cx = (xPct / 100) * w
    const cy = (yPct / 100) * h

    const now = performance.now()
    let batch: Particle[] = []

    switch (type) {
      case 'hit':    batch = emitHit(cx, cy, now, intensity); break
      case 'blood':  batch = emitBlood(cx, cy, now, intensity); break
      case 'miss':   batch = emitMiss(cx, cy, now, intensity); break
      case 'magic':  batch = emitMagic(cx, cy, now, intensity); break
      case 'heal':   batch = emitHeal(cx, cy, now, intensity); break
      case 'crit':   batch = emitCrit(cx, cy, now, intensity); break
      case 'dodge':  batch = emitDodge(cx, cy, now, intensity); break
      case 'fire':   batch = emitFire(cx, cy, now, intensity); break
      case 'ice':    batch = emitIce(cx, cy, now, intensity); break
      case 'holy':   batch = emitHoly(cx, cy, now, intensity); break
    }

    this.particles.push(...batch)
    this.start()
  }

  /** Clear all particles immediately */
  clear() {
    this.particles = []
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  /** Destroy the pool and stop the loop */
  destroy() {
    this.active = false
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
    this.particles = []
  }

  private start() {
    if (this.active) return
    this.active = true
    this.lastTick = performance.now()
    this.tick(this.lastTick)
  }

  private tick = (now: number) => {
    if (!this.active) return

    const dt = Math.min(now - this.lastTick, 50) // cap at 50ms
    this.lastTick = now

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    // Update & draw
    const alive: Particle[] = []
    for (const p of this.particles) {
      p.life = Math.max(0, 1 - (now - p.born) / p.maxLife)
      if (p.life <= 0) continue

      // Physics
      p.vx *= p.friction
      p.vy *= p.friction
      p.vy += p.gravity * (dt / 16)
      p.x += p.vx * (dt / 16)
      p.y += p.vy * (dt / 16)
      p.rotation += p.rotationSpeed * (dt / 16)

      this.drawParticle(p)
      alive.push(p)
    }

    this.particles = alive

    if (alive.length > 0) {
      this.animationId = requestAnimationFrame(this.tick)
    } else {
      this.active = false
      this.animationId = null
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    }
  }

  private drawParticle(p: Particle) {
    const ctx = this.ctx
    const alpha = p.alpha * Math.min(1, p.life * 2) * Math.min(1, (1 - p.life) * 4)
    const size = p.size * (0.3 + 0.7 * (1 - p.life))

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rotation)

    switch (p.shape) {
      case 'circle':
        ctx.beginPath()
        ctx.arc(0, 0, size, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.fill()
        break

      case 'ring':
        ctx.beginPath()
        ctx.arc(0, 0, size, 0, Math.PI * 2)
        ctx.strokeStyle = p.color
        ctx.lineWidth = Math.max(1, size * 0.3)
        ctx.stroke()
        break

      case 'star':
        // Simple 4-point star via two crossed lines
        ctx.strokeStyle = p.color
        ctx.lineWidth = Math.max(1, size * 0.2)
        ctx.beginPath()
        ctx.moveTo(-size, 0)
        ctx.lineTo(size, 0)
      //   ctx.moveTo(0, -size)
      //   ctx.lineTo(0, size)
        ctx.stroke()
        break

      case 'line':
        // directional slash/scratch
        ctx.strokeStyle = p.color
        ctx.lineWidth = Math.max(1, size * 0.3)
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(-size * 2, -size)
        ctx.stroke()
        break

      case 'spark':
        // elongated spark (thin rectangle rotated)
        ctx.fillStyle = p.color
        ctx.fillRect(-size, -size * 0.15, size * 3, size * 0.3)
        break
    }

    ctx.restore()
  }
}

// ─── Emitter functions ──────────────────────────────────────────────────────

function emitHit(x: number, y: number, now: number, intensity: number): Particle[] {
  const particles: Particle[] = []

  // Bright central flash (several large overlapping circles)
  for (let i = 0; i < 3; i++) {
    particles.push({
      x, y, vx: 0, vy: 0,
      life: 1, maxLife: 150 + i * 30,
      size: 20 + i * 8,
      color: pick(COLORS.hit),
      alpha: 0.8 * intensity,
      gravity: 0, friction: 1,
      rotation: 0, rotationSpeed: 0,
      shape: 'circle',
      born: now,
    })
  }

  // Expanding ring
  particles.push({
    x, y, vx: 0, vy: 0,
    life: 1, maxLife: 250,
    size: 10,
    color: '#FFD700',
    alpha: 0.6 * intensity,
    gravity: 0, friction: 1,
    rotation: 0, rotationSpeed: 0,
    shape: 'ring',
    born: now,
  })

  // Radial sparks
  const sparkCount = Math.floor(6 + 4 * intensity)
  for (let i = 0; i < sparkCount; i++) {
    const angle = (Math.PI * 2 * i) / sparkCount + rand(-0.3, 0.3)
    const speed = rand(1, 4)
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1, maxLife: rand(200, 400),
      size: rand(2, 5),
      color: pick(COLORS.hit),
      alpha: 0.9 * intensity,
      gravity: 0.05, friction: 0.96,
      rotation: angle, rotationSpeed: rand(-0.2, 0.2),
      shape: 'spark',
      born: now,
    })
  }

  return particles
}

function emitBlood(x: number, y: number, now: number, intensity: number): Particle[] {
  const particles: Particle[] = []
  const count = Math.floor(8 + 6 * intensity)

  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + rand(-0.8, 0.8) // mostly upward
    const speed = rand(1, 5 + intensity * 3)
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1,
      life: 1, maxLife: rand(300, 600),
      size: rand(2, 5),
      color: pick(COLORS.blood),
      alpha: 1,
      gravity: 0.12, friction: 0.97,
      rotation: 0, rotationSpeed: rand(-0.1, 0.1),
      shape: 'circle',
      born: now,
    })
  }

  // Impact lines (slash marks)
  for (let i = 0; i < 3; i++) {
    const angle = rand(-0.6, 0.6) - Math.PI / 2
    particles.push({
      x, y,
      vx: Math.cos(angle) * 3,
      vy: Math.sin(angle) * 3,
      life: 1, maxLife: 150,
      size: rand(3, 6),
      color: pick(COLORS.blood),
      alpha: 0.7,
      gravity: 0, friction: 0.95,
      rotation: angle, rotationSpeed: 0,
      shape: 'line',
      born: now,
    })
  }

  return particles
}

function emitMiss(x: number, y: number, now: number, _intensity: number): Particle[] {
  // Miss is handled by the dodge effect and a text overlay — keep simple swoosh
  return emitDodge(x, y, now, 0.5)
}

function emitDodge(x: number, y: number, now: number, intensity: number): Particle[] {
  const particles: Particle[] = []
  // Swoosh arc — several small particles that trail sideways
  for (let i = 0; i < 8; i++) {
    const t = i / 8
    const angle = -0.8 + t * 1.6 // arc from -45° to +45° relative to right
    const dist = 20 + t * 30
    particles.push({
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist - t * 10,
      vx: Math.cos(angle) * 2,
      vy: Math.sin(angle) * 2 - 1,
      life: 1, maxLife: 250 + i * 20,
      size: rand(1, 3),
      color: pick(COLORS.dodge),
      alpha: 0.6 * intensity,
      gravity: 0.03, friction: 0.95,
      rotation: 0, rotationSpeed: 0,
      shape: 'spark',
      born: now,
    })
  }

  // A couple of ghostly afterimages
  for (let i = 0; i < 3; i++) {
    const offsetX = -20 - i * 10
    particles.push({
      x: x + offsetX, y,
      vx: -1, vy: -0.3,
      life: 1, maxLife: 200 + i * 50,
      size: 6 + i * 3,
      color: 'rgba(136, 255, 255, 0.3)',
      alpha: 0.3 * intensity,
      gravity: 0, friction: 0.98,
      rotation: 0, rotationSpeed: 0,
      shape: 'circle',
      born: now,
    })
  }

  return particles
}

function emitMagic(x: number, y: number, now: number, intensity: number): Particle[] {
  const particles: Particle[] = []

  // Central glow
  for (let i = 0; i < 2; i++) {
    particles.push({
      x, y, vx: 0, vy: 0,
      life: 1, maxLife: 300 + i * 60,
      size: 15 + i * 10,
      color: pick(COLORS.magic),
      alpha: 0.5 * intensity,
      gravity: 0, friction: 1,
      rotation: 0, rotationSpeed: 0,
      shape: 'circle',
      born: now,
    })
  }

  // Expanding ring
  particles.push({
    x, y, vx: 0, vy: 0,
    life: 1, maxLife: 400,
    size: 8,
    color: '#AA66FF',
    alpha: 0.7 * intensity,
    gravity: 0, friction: 1,
    rotation: 0, rotationSpeed: 0.05,
    shape: 'ring',
    born: now,
  })

  // Sparkle particles flying outward
  const sparkCount = Math.floor(10 + 8 * intensity)
  for (let i = 0; i < sparkCount; i++) {
    const angle = Math.PI * 2 * Math.random()
    const speed = rand(0.5, 3 + intensity * 2)
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1, maxLife: rand(300, 600),
      size: rand(1, 4),
      color: pick(COLORS.magic),
      alpha: 0.8 * intensity,
      gravity: -0.02, // float upward slightly
      friction: 0.97,
      rotation: angle, rotationSpeed: rand(-0.3, 0.3),
      shape: 'spark',
      born: now,
    })
  }

  // Star bursts
  for (let i = 0; i < 4; i++) {
    const angle = (Math.PI * 2 * i) / 4 + rand(-0.2, 0.2)
    particles.push({
      x, y,
      vx: Math.cos(angle) * 2,
      vy: Math.sin(angle) * 2,
      life: 1, maxLife: 200,
      size: rand(3, 6),
      color: '#FFFFFF',
      alpha: 0.9 * intensity,
      gravity: 0, friction: 0.95,
      rotation: angle, rotationSpeed: 0,
      shape: 'star',
      born: now,
    })
  }

  return particles
}

function emitHeal(x: number, y: number, now: number, intensity: number): Particle[] {
  const particles: Particle[] = []

  // Green cross shape (4 lines)
  for (let i = 0; i < 4; i++) {
    const angle = (Math.PI * 2 * i) / 4
    particles.push({
      x, y,
      vx: Math.cos(angle) * 2,
      vy: Math.sin(angle) * 2,
      life: 1, maxLife: 250,
      size: rand(4, 7),
      color: pick(COLORS.heal),
      alpha: 0.7 * intensity,
      gravity: -0.05, // float up
      friction: 0.96,
      rotation: angle, rotationSpeed: 0,
      shape: 'line',
      born: now,
    })
  }

  // Rising bubbles
  const count = Math.floor(6 + 4 * intensity)
  for (let i = 0; i < count; i++) {
    const angle = rand(-1, 1) - Math.PI / 2
    const speed = rand(0.5, 2)
    particles.push({
      x: x + rand(-15, 15),
      y: y + rand(-10, 10),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1, maxLife: rand(400, 700),
      size: rand(2, 5),
      color: pick(COLORS.heal),
      alpha: 0.6 * intensity,
      gravity: -0.03,
      friction: 0.98,
      rotation: 0, rotationSpeed: rand(-0.1, 0.1),
      shape: 'circle',
      born: now,
    })
  }

  return particles
}

function emitCrit(x: number, y: number, now: number, intensity: number): Particle[] {
  const particles: Particle[] = []

  // Big flash
  for (let i = 0; i < 4; i++) {
    particles.push({
      x, y, vx: 0, vy: 0,
      life: 1, maxLife: 200 + i * 40,
      size: 15 + i * 10,
      color: pick(COLORS.crit),
      alpha: 0.9 * intensity,
      gravity: 0, friction: 1,
      rotation: 0, rotationSpeed: 0,
      shape: 'circle',
      born: now,
    })
  }

  // Massive ring
  particles.push({
    x, y, vx: 0, vy: 0,
    life: 1, maxLife: 350,
    size: 12,
    color: '#FF6600',
    alpha: 0.8 * intensity,
    gravity: 0, friction: 1,
    rotation: 0, rotationSpeed: 0.08,
    shape: 'ring',
    born: now,
  })

  // Many sparks in all directions
  const count = Math.floor(12 + 8 * intensity)
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + rand(-0.2, 0.2)
    const speed = rand(2, 6 + intensity * 2)
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1, maxLife: rand(250, 500),
      size: rand(2, 5),
      color: pick(COLORS.crit),
      alpha: 1,
      gravity: 0.08,
      friction: 0.96,
      rotation: angle, rotationSpeed: rand(-0.2, 0.2),
      shape: 'spark',
      born: now,
    })
  }

  return particles
}

function emitFire(x: number, y: number, now: number, intensity: number): Particle[] {
  const particles: Particle[] = []

  // Fireball impact
  for (let i = 0; i < 3; i++) {
    particles.push({
      x, y, vx: 0, vy: 0,
      life: 1, maxLife: 200 + i * 50,
      size: 12 + i * 8,
      color: pick(COLORS.fire),
      alpha: 0.6 * intensity,
      gravity: 0, friction: 1,
      rotation: 0, rotationSpeed: 0,
      shape: 'circle',
      born: now,
    })
  }

  // Rising embers
  const count = Math.floor(8 + 6 * intensity)
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + rand(-0.5, 0.5)
    const speed = rand(0.5, 3)
    particles.push({
      x: x + rand(-10, 10),
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1, maxLife: rand(300, 600),
      size: rand(2, 5),
      color: pick(COLORS.fire),
      alpha: 0.8 * intensity,
      gravity: -0.05,
      friction: 0.97,
      rotation: rand(0, Math.PI * 2), rotationSpeed: rand(-0.1, 0.1),
      shape: 'spark',
      born: now,
    })
  }

  return particles
}

function emitIce(x: number, y: number, now: number, intensity: number): Particle[] {
  const particles: Particle[] = []

  // Cold flash
  particles.push({
    x, y, vx: 0, vy: 0,
    life: 1, maxLife: 300,
    size: 18,
    color: pick(COLORS.ice),
    alpha: 0.6 * intensity,
    gravity: 0, friction: 1,
    rotation: 0, rotationSpeed: 0,
    shape: 'circle',
    born: now,
  })

  // Frost ring
  particles.push({
    x, y, vx: 0, vy: 0,
    life: 1, maxLife: 400,
    size: 10,
    color: '#88CCFF',
    alpha: 0.7 * intensity,
    gravity: 0, friction: 1,
    rotation: 0, rotationSpeed: -0.04,
    shape: 'ring',
    born: now,
  })

  // Shatter shards
  const count = Math.floor(6 + 4 * intensity)
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + rand(-0.3, 0.3)
    const speed = rand(1, 4)
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1, maxLife: rand(200, 400),
      size: rand(2, 5),
      color: pick(COLORS.ice),
      alpha: 0.9 * intensity,
      gravity: 0.05,
      friction: 0.96,
      rotation: angle, rotationSpeed: rand(-0.3, 0.3),
      shape: 'spark',
      born: now,
    })
  }

  return particles
}

function emitHoly(x: number, y: number, now: number, intensity: number): Particle[] {
  const particles: Particle[] = []

  // Golden glow
  for (let i = 0; i < 2; i++) {
    particles.push({
      x, y, vx: 0, vy: 0,
      life: 1, maxLife: 300 + i * 50,
      size: 12 + i * 8,
      color: pick(COLORS.holy),
      alpha: 0.5 * intensity,
      gravity: 0, friction: 1,
      rotation: 0, rotationSpeed: 0,
      shape: 'circle',
      born: now,
    })
  }

  // Radiant rays
  const count = Math.floor(5 + 3 * intensity)
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + rand(-0.2, 0.2)
    const speed = rand(1, 3)
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1, maxLife: rand(250, 450),
      size: rand(3, 6),
      color: pick(COLORS.holy),
      alpha: 0.7 * intensity,
      gravity: -0.02,
      friction: 0.97,
      rotation: angle, rotationSpeed: 0,
      shape: 'star',
      born: now,
    })
  }

  return particles
}
