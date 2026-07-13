/**
 * ParallaxBackground — multi-layer parallax background for the combat arena.
 *
 * Architecture:
 *   • 3 pure CSS gradient layers (no external images) for crisp rendering
 *   • Layers move at different speeds on mouse movement
 *   • requestAnimationFrame loop with smooth interpolation (lerp) for 60fps
 *   • Subtle ambient drift when mouse is idle
 *   • Cleans up RAF + listeners on unmount
 *
 * Layer speeds (multiplier vs pointer delta from center):
 *   far   0.015 — distant night sky (deep space gradient + stars)
 *   mid   0.035 — atmospheric haze / mist bands
 *   near  0.07  — ground glow + side atmospheric effects
 *
 * Why pure CSS instead of images:
 *   combat-bg.png looked blurry with blend modes and didn't cover the field well.
 *   CSS gradients are crisp, responsive, and give a deliberate dark fantasy look.
 */

import { useEffect, useRef } from "react"

interface ParallaxBackgroundProps {
  /** Optional className for the container div */
  className?: string
}

export default function ParallaxBackground({ className = "" }: ParallaxBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const farRef    = useRef<HTMLDivElement>(null)
  const midRef    = useRef<HTMLDivElement>(null)
  const nearRef   = useRef<HTMLDivElement>(null)
  const mouseRef  = useRef({ x: 0, y: 0 })
  const targetRef = useRef({ x: 0, y: 0 })
  const rafRef    = useRef<number | null>(null)
  const timeRef   = useRef(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // ── Mouse / pointer tracking ───────────────────────────────────────────
    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      // Normalise to [-1, 1] where 0,0 is centre
      targetRef.current = {
        x: ((e.clientX - rect.left) / rect.width  - 0.5) * 2,
        y: ((e.clientY - rect.top)  / rect.height - 0.5) * 2,
      }
    }

    // ── Animation loop ────────────────────────────────────────────────────
    const animate = (now: number) => {
      const dt = now - timeRef.current
      timeRef.current = now

      // Smooth interpolation factor — frame-rate independent
      // ~0.08 at 60fps → smooth but responsive feel
      const lerpFactor = Math.min(1, dt * 0.005)

      // Smoothly chase target
      const m = mouseRef.current
      const t = targetRef.current
      m.x += (t.x - m.x) * lerpFactor
      m.y += (t.y - m.y) * lerpFactor

      // Subtle ambient drift (sine-based, very slow)
      const driftX = Math.sin(now * 0.0002) * 0.03
      const driftY = Math.cos(now * 0.00015) * 0.02

      const cx = m.x + driftX
      const cy = m.y + driftY

      // Apply transforms to layers
      const layers = [
        { ref: farRef,  speed: 0.015 },
        { ref: midRef,  speed: 0.035 },
        { ref: nearRef, speed: 0.07  },
      ]

      for (const layer of layers) {
        const el = layer.ref.current
        if (!el) continue
        const dx = -cx * layer.speed * 4  // 4 = base sensitivity (px units)
        const dy = -cy * layer.speed * 4
        el.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`
      }

      rafRef.current = requestAnimationFrame(animate)
    }

    // ── Start ──────────────────────────────────────────────────────────────
    container.addEventListener("pointermove", onPointerMove, { passive: true })
    rafRef.current = requestAnimationFrame(animate)

    return () => {
      container.removeEventListener("pointermove", onPointerMove)
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      style={{ zIndex: 0 }}
    >
      {/* ────────────────────────────────────────────────────────────────────
           Layer 1 — Far (distant night sky)
           Deep space gradient with subtle star-like speckles
           ───────────────────────────────────────────────────────────────── */}
      <div
        ref={farRef}
        className="absolute inset-0 will-change-transform"
        style={{
          zIndex: 1,
          opacity: 0.9,
          background: `
            radial-gradient(ellipse 140% 80% at 50% 20%, #0a0a1a 0%, #050510 40%, #000000 100%),
            repeating-linear-gradient(
              45deg,
              transparent 0px,
              transparent 2px,
              rgba(255,255,255,0.01) 2px,
              rgba(255,255,255,0.01) 3px,
              transparent 3px,
              transparent 6px
            ),
            radial-gradient(ellipse 60% 40% at 30% 30%, rgba(100,120,200,0.06) 0%, transparent 60%),
            radial-gradient(ellipse 50% 30% at 70% 20%, rgba(200,150,100,0.04) 0%, transparent 50%)
          `,
        }}
      />

      {/* ────────────────────────────────────────────────────────────────────
           Layer 2 — Mid (atmospheric haze / mist bands)
           Warm haze at bottom, cool fog at top — creates depth
           ───────────────────────────────────────────────────────────────── */}
      <div
        ref={midRef}
        className="absolute inset-0 will-change-transform"
        style={{
          zIndex: 2,
          opacity: 0.7,
          background: `
            linear-gradient(180deg,
              rgba(0,10,30,0.3) 0%,
              rgba(10,5,15,0.2) 30%,
              rgba(30,15,10,0.3) 60%,
              rgba(50,25,10,0.5) 80%,
              rgba(60,30,15,0.6) 100%
            ),
            repeating-linear-gradient(
              180deg,
              transparent 0px,
              rgba(80,40,20,0.03) 80px,
              transparent 160px
            )
          `,
        }}
      />

      {/* ────────────────────────────────────────────────────────────────────
           Layer 3 — Near (ground glow + side atmosphere)
           Warm glow from below, cool blue/red side glows
           ───────────────────────────────────────────────────────────────── */}
      <div
        ref={nearRef}
        className="absolute inset-0 will-change-transform"
        style={{
          zIndex: 3,
          opacity: 0.8,
          background: `
            radial-gradient(ellipse 100% 50% at 50% 100%, rgba(80,30,10,0.4) 0%, transparent 70%),
            radial-gradient(ellipse 70% 35% at 25% 55%, rgba(0,30,80,0.12) 0%, transparent 60%),
            radial-gradient(ellipse 70% 35% at 75% 55%, rgba(80,10,10,0.12) 0%, transparent 60%)
          `,
        }}
      />

      {/* ─── Dark vignette overlay ─────────────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 5,
          background: `
            radial-gradient(ellipse 65% 55% at 50% 45%, transparent 35%, rgba(0,0,0,0.5) 100%)
          `,
        }}
      />
    </div>
  )
}
