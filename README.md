# Baldur's Gate - 2D RPG Game Project

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

## Overview

Монопроект игр на основе Baldur's Gate. workspace организован через pnpm workspace.

## Структура

```
Baldur-Gate/
├── src/                 # Frontend хоста (React + Vite)
├── artifacts/          # Sub-projects (workspace packages)
│   ├── baldurs-gate/    # 2D RPG игра (основная игра)
│   ├── api-server/      # Backend API сервер
│   └── mockup-sandbox/ # Инструмент превью mockup-ов
├── scripts/            # Build/deploy скрипты
├── attached_assets/    # Референсы и документация
└── lib/                 # Общие библиотеки
```

## Артефакты

### baldurs-gate (artifacts/baldurs-gate/)
Основная 2D RPG игра. React-приложение с:
- Компоненты UI
- Хуки управления состоянием
- Страницы игры
- 2D графика через Three.js / @react-three/fiber

### api-server (artifacts/api-server/)
Express.js сервер для API игры.

### mockup-sandbox (artifacts/mockup-sandbox/)
Инструмент для превью и тестирования UI mockup-ов.

## Технологии

- **Frontend**: React 19, TypeScript, Vite 7, TailwindCSS 4
- **3D/2D Graphics**: Three.js, @react-three/fiber, @react-three/drei
- **Animations**: Motion (framer-motion fork)
- **Icons**: Lucide React
- **Backend**: Express 5
- **Package Manager**: pnpm (workspace)

## Команды

```bash
# Разработка
npm run dev              # Запуск dev сервера

# Сборка
npm run build            # Собрать всё

# Типизация
npm run typecheck       # Проверить типы

# Линтинг
npm run lint            # Линтинг
```

## Зависимости

Находятся в `.env.local`:
- `GEMINI_API_KEY` - API ключ для Gemini

## Конфиги

- `tsconfig.base.json` - Базовый TypeScript конфиг
- `vite.config.ts` - Vite конфиг для хоста
- `pnpm-workspace.yaml` - pnpm workspace конфиг