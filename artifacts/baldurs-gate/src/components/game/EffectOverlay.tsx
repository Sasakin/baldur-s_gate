import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export interface Effect {
  id: string;
  x: number;
  y: number;
  type: 'hit' | 'miss' | 'magic' | 'blood' | 'heal';
  amount?: number;
}

export interface EffectOverlayRef {
  spawnEffect: (x: number, y: number, type: Effect['type'], amount?: number) => void;
}

export const EffectOverlay = forwardRef<EffectOverlayRef>((_, ref) => {
  const [effects, setEffects] = useState<Effect[]>([]);

  const spawnEffect = useCallback((x: number, y: number, type: Effect['type'], amount?: number) => {
    const id = Math.random().toString(36).substring(7);
    setEffects(prev => [...prev, { id, x, y, type, amount }]);

    // Auto cleanup
    setTimeout(() => {
      setEffects(prev => prev.filter(e => e.id !== id));
    }, 1000);
  }, []);

  useImperativeHandle(ref, () => ({
    spawnEffect
  }));

  return (
    <div className="absolute inset-0 pointer-events-none z-[60] overflow-hidden">
      <AnimatePresence>
        {effects.map(effect => (
          <div
            key={effect.id}
            className="absolute"
            style={{ left: `${effect.x}%`, top: `${effect.y}%` }}
          >
            {effect.type === 'hit' && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: [1.2, 1], opacity: [1, 0] }}
                transition={{ duration: 0.4 }}
                className="w-16 h-16 -ml-8 -mt-8 bg-white rounded-full mix-blend-screen blur-md"
              />
            )}

            {effect.type === 'blood' && (
              <div className="relative">
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                    animate={{ 
                      x: (Math.random() - 0.5) * 100, 
                      y: (Math.random() - 0.2) * 80 + 20, 
                      opacity: 0,
                      scale: 0.2 
                    }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="absolute w-2 h-2 bg-red-600 rounded-full"
                  />
                ))}
              </div>
            )}

            {effect.type === 'miss' && (
              <motion.div
                initial={{ y: 0, opacity: 1 }}
                animate={{ y: -50, opacity: 0 }}
                className="text-white font-bold text-xl drop-shadow-md -ml-6"
              >
                MISS
              </motion.div>
            )}

            {effect.type === 'magic' && (
              <motion.div
                initial={{ scale: 0, rotate: 0 }}
                animate={{ scale: [1, 1.5, 2], rotate: 360, opacity: 0 }}
                transition={{ duration: 0.8 }}
                className="w-20 h-20 -ml-10 -mt-10 border-2 border-blue-400 rounded-full flex items-center justify-center"
              >
                <div className="w-10 h-10 bg-blue-500/30 blur-xl rounded-full" />
              </motion.div>
            )}

            {effect.type === 'heal' && (
              <motion.div
                initial={{ scale: 0, y: 0 }}
                animate={{ scale: [1, 1.2], y: -30, opacity: [1, 0] }}
                transition={{ duration: 0.7 }}
                className="text-green-400 text-4xl -ml-4"
              >
                ➕
              </motion.div>
            )}

            {effect.amount !== undefined && (
              <motion.div
                initial={{ y: 0, opacity: 1, scale: 0.5 }}
                animate={{ y: -60, opacity: 0, scale: 1.5 }}
                className={`font-display font-bold text-2xl -ml-4 ${effect.amount > 0 ? 'text-green-400' : 'text-red-500'}`}
                style={{ textShadow: '2px 2px 0px black' }}
              >
                {effect.amount > 0 ? `+${effect.amount}` : effect.amount}
              </motion.div>
            )}
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
});

EffectOverlay.displayName = 'EffectOverlay';
