/**
 * VFXOverlay — Canvas 2D particle effects overlay for combat.
 *
 * Lightweight particle system on Canvas2D with simple ref-based API.
 * Effects:
 *   • hit    — white/gold flash (200ms burst) + radial sparks
 *   • magic  — blue/purple sparkles flying from caster toward target
 *   • blood  — red particle spray + impact lines
 *   • miss   — whoosh/arc trail + floating "МИМО!" text
 *
 * Integrates into CombatArena.tsx via useRef + spawnEffect imperative handle.
 */

import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ParticlePool, EffectType } from '../../lib/particle-system'

// ─── Text label (floating damage, MISS, etc.) ───────────────────────────────

interface TextLabel {
  id: string
  x: number
  y: number
  text: string
  color: string
  size: 'sm' | 'md' | 'lg'
}

// ─── Ref API ────────────────────────────────────────────────────────────────

export interface VFXOverlayRef {
  /** Spawn a visual effect at position (x, y) in percentage 0..100 */
  spawnEffect: (x: number, y: number, type: EffectType, amount?: number) => void
  /** Clear all active particles */
  clear: () => void
}

// ─── Component ──────────────────────────────────────────────────────────────

export const VFXOverlay = forwardRef<VFXOverlayRef>((_, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const poolRef = useRef<ParticlePool | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [texts, setTexts] = useState<TextLabel[]>([])

  // ── Init particle pool on mount ──────────────────────────────────────────

  useEffect(() => {
    if (!canvasRef.current) return
    const pool = new ParticlePool(canvasRef.current)
    poolRef.current = pool

    const resize = () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      pool.resize(rect.width, rect.height)
    }

    resize()
    window.addEventListener('resize', resize)

    return () => {
      pool.destroy()
      window.removeEventListener('resize', resize)
    }
  }, [])

  // ── Spawn effect (called from parent via ref) ────────────────────────────

  const spawnEffect = useCallback((x: number, y: number, type: EffectType, amount?: number) => {
    const pool = poolRef.current
    if (!pool) return

    // Emit particles
    pool.emit(type, x, y)

    // Show text label for amounts and special types
    if (amount !== undefined || type === 'miss' || type === 'dodge') {
      const id = Math.random().toString(36).substring(7)
      let text = ''
      let color = '#FFFFFF'
      let size: TextLabel['size'] = 'md'

      switch (type) {
        case 'miss':
          text = 'МИМО!'
          color = '#AAAAAA'
          size = 'lg'
          break
        case 'dodge':
          text = 'УКЛОН!'
          color = '#88FFFF'
          size = 'lg'
          break
        case 'crit':
          text = 'КРИТ!'
          color = '#FF6600'
          size = 'lg'
          break
        default:
          if (amount !== undefined && amount < 0) {
            text = `${amount}`
            color = '#FF4444'
            size = 'md'
          } else if (amount !== undefined && amount > 0) {
            text = `+${amount}`
            color = '#44FF88'
            size = 'md'
          }
      }

      if (text) {
        setTexts(prev => [...prev, { id, x, y, text, color, size }])
        setTimeout(() => {
          setTexts(prev => prev.filter(t => t.id !== id))
        }, 1200)
      }
    }
  }, [])

  const clear = useCallback(() => {
    poolRef.current?.clear()
    setTexts([])
  }, [])

  useImperativeHandle(ref, () => ({ spawnEffect, clear }), [spawnEffect, clear])

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none z-[60] overflow-hidden"
    >
      {/* Canvas layer for particle effects */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* Floating text labels */}
      <div className="absolute inset-0">
        <AnimatePresence>
          {texts.map(t => {
            const sizeClass = t.size === 'lg'
              ? 'text-xl font-bold tracking-wider'
              : t.size === 'sm'
                ? 'text-sm'
                : 'text-base font-semibold'

            return (
              <motion.div
                key={t.id}
                initial={{ y: 0, opacity: 1, scale: 0.5 }}
                animate={{ y: -80, opacity: 0, scale: t.size === 'lg' ? 1.4 : 1.1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                className={`absolute pointer-events-none whitespace-nowrap z-10 ${sizeClass}`}
                style={{
                  left: `${t.x}%`,
                  top: `${t.y}%`,
                  color: t.color,
                  textShadow: `0 0 12px ${t.color}88, 0 2px 4px rgba(0,0,0,0.8)`,
                  fontFamily: "'Cinzel', 'Georgia', serif",
                }}
              >
                {t.text}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
})

VFXOverlay.displayName = 'VFXOverlay'
