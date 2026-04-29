# Запуск приложения на Windows

## Что было сделано для запуска

### 1. Удаление Replit-зависимостей

Удалены Replit-плагины из `artifacts/baldurs-gate/package.json`:
- `@replit/vite-plugin-cartographer`
- `@replit/vite-plugin-dev-banner`
- `@replit/vite-plugin-runtime-error-modal`

Удалены Replit-плагины из `artifacts/mockup-sandbox/package.json`:
- `@replit/vite-plugin-cartographer`
- `@replit/vite-plugin-runtime-error-modal`

Удалена конфигурация из `artifacts/baldurs-gate/vite.config.ts`:
- Удалён импорт `runtimeErrorOverlay`
- Удалён плагин `runtimeErrorOverlay()`
- Удалён условный блок с `cartographer` и `devBanner`

Удалена конфигурация из `artifacts/mockup-sandbox/vite.config.ts`:
- Удалён импорт `runtimeErrorOverlay`
- Удалён плагин `runtimeErrorOverlay()`
- Удалён условный блок с `cartographer`

### 2. Добавление Windows-нативных модулей

Для запуска на Windows необходимо добавить Windows-специфичные нативные модули в корневой `package.json`:

```json
{
  "devDependencies": {
    "@esbuild/win32-x64": "0.27.3",
    "@rollup/rollup-linux-x64-gnu": "^4.60.2",
    "@rollup/rollup-win32-x64-msvc": "^4.60.2",
    "@tailwindcss/node": "^4.2.4",
    "@tailwindcss/oxide-win32-x64-msvc": "^4.2.4",
    "@tailwindcss/vite": "^4.2.4",
    "lightningcss": "^1.32.0",
    "lightningcss-win32-x64-msvc": "^1.32.0"
  }
}
```

## Команды для запуска

1. Установка зависимостей:
```bash
pnpm install
```

2. Сборка frontend (baldurs-gate):
```bash
pnpm --filter @workspace/baldurs-gate run build
```

3. Сборка backend (api-server):
```bash
pnpm --filter @workspace/api-server run build
```

4. Запуск dev сервера:
```bash
pnpm --filter @workspace/baldurs-gate run dev
```

## Примечание

- Обновлён @tailwindcss/vite с 4.1.14 до 4.2.4
- Добавлен @tailwindcss/node для поддержки Windows
- Версия esbuild должна совпадать с версией в node_modules (0.27.3)