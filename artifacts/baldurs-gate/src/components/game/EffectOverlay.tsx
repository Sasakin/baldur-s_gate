/**
 * EffectOverlay — Canvas 2D particle VFX overlay for combat.
 *
 * Uses a lightweight particle pool for all visual effects:
 *   • hit   — bright flash + radial sparks (white/gold)
 *   • blood — blood spray + slash impact lines
 *   • miss  — "MISS" text + dodge swoosh
 *   • magic — sparkle burst + expanding energy ring (blue/purple)
 *   • heal  — green bubbles + cross pattern
 *   • crit  — explosive orange flash + heavy sparks
 *   • dodge — ghostly afterimages + wind swoosh
 *
 * The canvas layer auto-resizes and the pool cleans up after itself.
 */

import React, { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ParticlePool, EffectType } from '../../lib/particle-system'

// ─── Text overlay for floating labels (MISS, +X, etc.) ──────────────────────

interface TextLabel {
  id: string
  x: number
  y: number
  text: string
  color: string
  size: 'sm' | 'md' | 'lg' | 'xl'
  createdAt: number
}

// ─── Ref API ─────────────────────────────────────────────────────────────────

export interface EffectOverlayRef {
  spawnEffect: (x: number, y: number, type: EffectType, amount?: number) => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export const EffectOverlay = forwardRef<EffectOverlayRef>((_, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const poolRef = useRef<ParticlePool | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [texts, setTexts] = useState<TextLabel[]>([])

  // ── Init particle pool ────────────────────────────────────────────────────

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

  // ── Imperative spawn API ──────────────────────────────────────────────────

  const spawnEffect = useCallback((x: number, y: number, type: EffectType, amount?: number) => {
    const pool = poolRef.current
    if (!pool) return

    // Emit particles
    const intensity = type === 'crit' ? 1.5 : 1
    pool.emit(type, x, y, intensity)

    // Show text label for amounts / specialised messages
    if (amount !== undefined || type === 'miss') {
      const id = Math.random().toString(36).substring(7)
      let text = ''
      let color = '#FFFFFF'
      let size: TextLabel['size'] = 'md'

      if (type === 'miss') {
        text = 'МИМО!'
        color = '#AAAAAA'
        size = 'lg'
      } else if (type === 'dodge') {
        text = 'УКЛОН!'
        color = '#88FFFF'
        size = 'lg'
      } else if (amount !== undefined && amount < 0) {
        text = `${amount}`
        color = '#FF4444'
        size = 'md'
      } else if (amount !== undefined && amount > 0) {
        text = `+${amount}`
        color = '#44FF88'
        size = 'md'
      } else if (type === 'crit') {
        text = 'КРИТ!'
        color = '#FF6600'
        size = 'xl'
      }

      if (text) {
        setTexts(prev => [...prev, { id, x, y, text, color, size, createdAt: Date.now() }])
        setTimeout(() => {
          setTexts(prev => prev.filter(t => t.id !== id))
        }, 1200)
      }
    }

    // Auto-cleanup: text labels remove after timeout
  }, [])

  useImperativeHandle(ref, () => ({
    spawnEffect
  }))

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none z-[60] overflow-hidden"
    >
      {/* Canvas layer for particles */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* Text label layer */}
      <div className="absolute inset-0">
        <AnimatePresence>
          {texts.map(t => {
            const sizeClass = t.size === 'xl' ? 'text-3xl font-black tracking-wider'
              : t.size === 'lg' ? 'text-xl font-bold'
              : t.size === 'sm' ? 'text-sm'
              : 'text-base font-semibold'

            return (
              <motion.div
                key={t.id}
                initial={{ y: 0, opacity: 1, scale: 0.5 }}
                animate={{ y: -80, opacity: 0, scale: t.size === 'xl' ? 2 : 1.2 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                className={`absolute left-1/2 pointer-events-none whitespace-nowrap z-10 ${sizeClass}`}
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

EffectOverlay.displayName = 'EffectOverlay'
