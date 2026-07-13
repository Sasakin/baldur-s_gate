import * as React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"

// ─── Types ───────────────────────────────────────────────────────────────────

interface LoadingScene {
  id: string
  title: string
  subtitle: string
  image: string
  overlayGradient: string
  glowColor: string
}

interface Props {
  onLoadingComplete: () => void
}

// ─── Art scenes (random game art rotation) ──────────────────────────────────

const BASE = import.meta.env.BASE_URL

const LOADING_SCENES: LoadingScene[] = [
  {
    id: "heroes",
    title: "Герои Королевства",
    subtitle: "Воины, маги, воры и клирики объединяются против тьмы",
    image: `${BASE}images/classic_heroes.png`,
    overlayGradient: `
      radial-gradient(ellipse 60% 50% at 50% 80%, rgba(180,120,40,0.3) 0%, transparent 70%),
      radial-gradient(ellipse 80% 60% at 30% 30%, rgba(40,60,140,0.25) 0%, transparent 60%)
    `,
    glowColor: "#FFD700",
  },
  {
    id: "battle",
    title: "Битва за Торнвуд",
    subtitle: "Сражайтесь с порождениями тьмы в тактических боях",
    image: `${BASE}images/combat-bg.png`,
    overlayGradient: `
      radial-gradient(ellipse 60% 50% at 50% 30%, rgba(180,30,10,0.35) 0%, transparent 60%),
      radial-gradient(ellipse 80% 60% at 50% 80%, rgba(10,10,30,0.5) 0%, transparent 60%)
    `,
    glowColor: "#CC3333",
  },
  {
    id: "undead",
    title: "Враги Подземелий",
    subtitle: "Скелеты, зомби и личи ждут в Склепе Забытых",
    image: `${BASE}images/skeleton_spritesheet_calciumtrice.png`,
    overlayGradient: `
      radial-gradient(ellipse 60% 50% at 50% 50%, rgba(100,80,120,0.3) 0%, transparent 60%),
      radial-gradient(ellipse 80% 60% at 20% 80%, rgba(20,40,60,0.4) 0%, transparent 60%)
    `,
    glowColor: "#8866BB",
  },
  {
    id: "wilderness",
    title: "Дикие Земли",
    subtitle: "Исследуйте мрачные леса и древние руины",
    image: `${BASE}images/main-menu-bg.png`,
    overlayGradient: `
      radial-gradient(ellipse 50% 40% at 50% 20%, rgba(60,100,40,0.25) 0%, transparent 60%),
      radial-gradient(ellipse 80% 60% at 30% 70%, rgba(20,10,40,0.35) 0%, transparent 60%),
      radial-gradient(ellipse 80% 60% at 70% 70%, rgba(60,20,10,0.3) 0%, transparent 60%)
    `,
    glowColor: "#66AA44",
  },
]

// ─── Loading tips (Russian, game-themed) ────────────────────────────────────

const LOADING_TIPS: string[] = [
  "Воры наносят +50% урона из скрытности — атакуйте первыми!",
  "Маги могут комбинировать стихии: огонь + яд = взрывной туман",
  "Клирики наносят двойной урон нежити Священным ударом",
  "Используйте укрытие в бою, чтобы избежать вражеских атак",
  "Зелья здоровья восстанавливают 30 HP — держите их в инвентаре",
  "Фланговая атака даёт +2 к броску попадания",
  "Воины получают вторую атаку на 7-м уровне",
  "Заклинания магов требуют время на каст — не дайте врагу сбить концентрацию",
  "Исследуйте каждый уголок карты — там могут быть сокровища",
  "Сундуки могут быть заперты — найдите ключи или взломайте их",
  "Союзники с разными классами дополняют друг друга в бою",
  "Дымовая шашка вора даёт уклонение от следующей атаки",
  "Лечение божественной силой восстанавливает WIS×2+10 HP",
  "Ледяное копьё наносит двойной урон по цели",
  "Не забывайте сохраняться перед опасными битвами",
  "Каждый класс имеет уникальные способности — экспериментируйте!",
]

// ─── Asset preloader ────────────────────────────────────────────────────────

function preloadImages(urls: string[]): Promise<void> {
  const promises = urls.map(
    (url) =>
      new Promise<void>((resolve) => {
        const img = new Image()
        img.onload = () => resolve()
        img.onerror = () => resolve() // don't block on bad images
        img.src = url
      }),
  )
  return Promise.all(promises).then(() => {})
}

// ─── Loading Bar ────────────────────────────────────────────────────────────

function LoadingBar({ progress }: { progress: number }) {
  return (
    <div className="relative w-full max-w-md mx-auto h-1.5 bg-white/10 rounded-full overflow-hidden">
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{
          background: "linear-gradient(90deg, var(--color-rpg-gold-dim), var(--color-rpg-gold))",
          boxShadow: "0 0 12px rgba(255, 215, 0, 0.4)",
        }}
        initial={{ width: "0%" }}
        animate={{ width: `${Math.min(progress, 100)}%` }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      />
      {/* Animated shimmer */}
      <motion.div
        className="absolute inset-y-0 left-0 w-20 rounded-full bg-white/20"
        animate={{ x: [0, 400] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        style={{ width: "20%" }}
      />
    </div>
  )
}

// ─── Loading Screen Component ───────────────────────────────────────────────

export function LoadingScreen({ onLoadingComplete }: Props) {
  const [progress, setProgress] = useState(0)
  const [currentSceneIdx, setCurrentSceneIdx] = useState(0)
  const [currentTipIdx, setCurrentTipIdx] = useState(0)
  const [sceneKey, setSceneKey] = useState(0)
  const [phase, setPhase] = useState<"loading" | "transitioning">("loading")
  const startedAt = useRef(Date.now())
  const MIN_DISPLAY_MS = 2500 // minimum 2.5s display time

  // ── Cycle tips every 4s ─────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => {
      setCurrentTipIdx((i) => (i + 1) % LOADING_TIPS.length)
    }, 4000)
    return () => clearInterval(t)
  }, [])

  // ── Cycle art scenes every 5s ───────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => {
      setCurrentSceneIdx((i) => (i + 1) % LOADING_SCENES.length)
      setSceneKey((k) => k + 1)
    }, 5000)
    return () => clearInterval(t)
  }, [])

  // ── Preload assets and animate progress ─────────────────────────────────
  const simulateLoading = useCallback(async () => {
    // Collect all images to preload
    const imagesToPreload = LOADING_SCENES.map((s) => s.image)
    // Also preload key in-game assets
    imagesToPreload.push(
      `${BASE}images/parchment.png`,
      `${BASE}images/enemies/Skeleton_Idle.png`,
      `${BASE}images/enemies/Witch_Doctor_Idle.png`,
      `${BASE}images/heroes_spritesheet.png`,
    )

    const totalSteps = 20
    for (let step = 0; step <= totalSteps; step++) {
      setProgress(Math.round((step / totalSteps) * 100))

      if (step === 3) {
        // Start actual image preloading at ~15%
        await preloadImages(imagesToPreload)
      }

      // Stagger progress updates for visual effect
      await new Promise((r) => setTimeout(r, 80 + Math.random() * 120))
    }

    // Ensure minimum display time
    const elapsed = Date.now() - startedAt.current
    if (elapsed < MIN_DISPLAY_MS) {
      await new Promise((r) => setTimeout(r, MIN_DISPLAY_MS - elapsed))
    }

    setPhase("transitioning")
    // Small delay for exit animation
    setTimeout(onLoadingComplete, 600)
  }, [onLoadingComplete])

  useEffect(() => {
    simulateLoading()
  }, [simulateLoading])

  const scene = LOADING_SCENES[currentSceneIdx]

  return (
    <motion.div
      className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-black select-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: phase === "transitioning" ? 0.5 : 0.8, ease: "easeInOut" }}
    >
      {/* ── Background layer ─────────────────────────────────────────────── */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            url('${scene.image}') center/cover no-repeat,
            ${scene.overlayGradient},
            linear-gradient(180deg, #050508 0%, #0a0508 50%, #050508 100%)
          `,
          backgroundBlendMode: "overlay, normal, normal, normal",
        }}
      />

      {/* Dark vignette overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 50%, transparent 30%, rgba(0,0,0,0.7) 100%)",
        }}
      />

      {/* ── Scan line effect ──────────────────────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)",
        }}
      />

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-2xl px-6">

        {/* ── Game logo / title ──────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="mb-8 text-center"
        >
          <h1 className="text-2xl md:text-4xl font-display text-primary-foreground drop-shadow-[0_0_15px_rgba(255,215,0,0.4)] leading-tight">
            Chronicles of the
            <br />
            <span
              className="text-[var(--color-rpg-gold)] text-3xl md:text-5xl"
              style={{ textShadow: "0 0 20px rgba(255, 215, 0, 0.3)" }}
            >
              Forgotten Realm
            </span>
          </h1>
        </motion.div>

        {/* ── Art scene card ──────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={sceneKey}
            initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 1.05, filter: "blur(4px)" }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="w-full max-w-lg mb-6 rounded-sm overflow-hidden"
            style={{
              border: "1px solid rgba(255, 215, 0, 0.15)",
              boxShadow: `0 0 30px rgba(0,0,0,0.6), inset 0 0 60px rgba(0,0,0,0.4)`,
            }}
          >
            {/* Scene image preview */}
            <div className="relative h-40 md:h-52 overflow-hidden">
              <div
                className="absolute inset-0"
                style={{
                  background: `url('${scene.image}') center/cover no-repeat`,
                  filter: "saturate(1.1) contrast(1.05)",
                }}
              />
              {/* Gradient overlays for readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/40" />

              {/* Scene label */}
              <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5">
                <motion.h2
                  className="text-lg md:text-2xl font-display font-bold tracking-wider"
                  style={{ color: scene.glowColor, textShadow: `0 0 20px ${scene.glowColor}44` }}
                >
                  {scene.title}
                </motion.h2>
                <p className="text-xs md:text-sm text-gray-300/80 mt-1 italic">
                  {scene.subtitle}
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* ── Loading tip ──────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTipIdx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="mb-8 text-center"
          >
            <span className="text-[10px] uppercase tracking-[0.25em] text-[var(--color-rpg-gold-dim)] font-display">
              Совет
            </span>
            <p className="text-sm md:text-base text-gray-300/90 mt-1 max-w-md leading-relaxed">
              {LOADING_TIPS[currentTipIdx]}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* ── Progress bar ────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="w-full max-w-md flex flex-col items-center gap-2"
        >
          <LoadingBar progress={progress} />
          <span className="text-[10px] font-display tracking-[0.2em] text-white/30 uppercase">
            {progress < 100 ? "Загрузка..." : "Почти готово..."}
          </span>
        </motion.div>

        {/* ── Decorative bottom ───────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-8 text-[8px] tracking-[0.4em] uppercase text-white/10 font-display"
        >
          Baldur's Gate · Isometric RPG
        </motion.div>
      </div>
    </motion.div>
  )
}
