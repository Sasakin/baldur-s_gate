/**
 * ParallaxBackground — multi-layer parallax background for the combat arena.
 *
 * Architecture:
 *   • 3 layers (far, mid, near) moving at different speeds on mouse movement
 *   • requestAnimationFrame loop with smooth interpolation (lerp) for 60fps
 *   • Subtle ambient drift when mouse is idle
 *   • Cleans up RAF + listeners on unmount
 *
 * Layer speeds (multiplier vs pointer delta from center):
 *   far   0.015 — distant mountains / sky
 *   mid   0.035 — battlefield mid-ground
 *   near  0.07  — foreground atmosphere / vignette
 */

import { useEffect, useRef } from "react"

const BASE = import.meta.env.BASE_URL

interface ParallaxBackgroundProps {
  /** Optional className for the container div */
  className?: string
}

// ─── Layer config ─────────────────────────────────────────────────────────────

interface LayerConfig {
  /** CSS background-image value (url or gradient) */
  image: string
  /** Movement speed multiplier relative to pointer delta */
  speed: number
  /** Additional CSS background properties */
  style?: React.CSSProperties
  /** CSS filter string */
  filter?: string
  /** z-index of the layer */
  zIndex: number
  /** Opacity of the layer */
  opacity: number
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
           Layer 1 — Far (distant mountains / sky)
           Uses combat-bg.png at full width, dark-tinted
           ───────────────────────────────────────────────────────────────── */}
      <div
        ref={farRef}
        className="absolute inset-0 will-change-transform"
        style={{
          backgroundImage: `url('${BASE}images/combat-bg.png')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          opacity: 0.9,
          zIndex: 1,
          filter: "brightness(0.6) saturate(0.7)",
        }}
      />

      {/* ────────────────────────────────────────────────────────────────────
           Layer 2 — Mid (battlefield mid-ground)
           Same combat-bg.png but zoomed in, colourised for depth
           ───────────────────────────────────────────────────────────────── */}
      <div
        ref={midRef}
        className="absolute inset-0 will-change-transform"
        style={{
          backgroundImage: `url('${BASE}images/combat-bg.png')`,
          backgroundSize: "115%",
          backgroundPosition: "52% 48%",
          backgroundRepeat: "no-repeat",
          opacity: 0.55,
          zIndex: 2,
          filter: "brightness(0.5) sepia(0.3) contrast(1.1)",
          mixBlendMode: "screen" as const,
        }}
      />

      {/* ────────────────────────────────────────────────────────────────────
           Layer 3 — Near (atmospheric gradients + vignette)
           Pure CSS — no image needed, moves fastest
           ───────────────────────────────────────────────────────────────── */}
      <div
        ref={nearRef}
        className="absolute inset-0 will-change-transform"
        style={{
          zIndex: 3,
          opacity: 0.85,
          background: `
            radial-gradient(ellipse 120% 60% at 50% 100%, rgba(80,20,0,0.5) 0%, transparent 70%),
            radial-gradient(ellipse 80% 40% at 20% 50%, rgba(0,20,80,0.25) 0%, transparent 60%),
            radial-gradient(ellipse 80% 40% at 80% 50%, rgba(80,0,0,0.25) 0%, transparent 60%)
          `,
          backgroundBlendMode: "overlay",
        }}
      />

      {/* ─── Dark vignette overlay ─────────────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 5,
          background: `
            radial-gradient(ellipse 70% 50% at 50% 50%, transparent 40%, rgba(0,0,0,0.4) 100%)
          `,
        }}
      />
    </div>
  )
}
