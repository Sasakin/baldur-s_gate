/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { Gamepad2 } from "lucide-react";

export default function App() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center space-y-6"
        id="game-container"
      >
        <div className="flex justify-center">
          <div className="p-4 bg-blue-600/20 rounded-full border border-blue-500/30">
            <Gamepad2 className="w-12 h-12 text-blue-500" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Ваш проект готов</h1>
          <p className="text-neutral-400">
            Вы можете загрузить код своей Node.js игры в файловый менеджер.
          </p>
        </div>

        <div className="p-6 bg-neutral-900 rounded-xl border border-neutral-800 text-left space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">Где разместить код?</h2>
          <ul className="text-sm space-y-3">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-[10px] mt-0.5">1</span>
              <span>Серверная логика: <code className="text-blue-400">/server.ts</code></span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-[10px] mt-0.5">2</span>
              <span>Фронтенд игры: <code className="text-blue-400">/src/App.tsx</code></span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-[10px] mt-0.5">3</span>
              <span>Глобальные стили: <code className="text-blue-400">/src/index.css</code></span>
            </li>
          </ul>
        </div>

        <p className="text-xs text-neutral-600">
          Нажмите на иконку папки слева, чтобы начать загрузку файлов.
        </p>
      </motion.div>

      {/* Сюда можно будет вставить Canvas или основной экран игры */}
    </div>
  );
}

