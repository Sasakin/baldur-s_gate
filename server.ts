import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Парсинг JSON для ваших игровых запросов
  app.use(express.json());

  // Интеграция основного API сервера из артефактов
  try {
    const { default: apiApp } = await import("./artifacts/api-server/src/app.ts");
    app.use(apiApp);
  } catch (err) {
    console.error("Failed to load api-server, using fallback status route:", err);
    app.get("/api/status", (req, res) => {
      res.json({ status: "alive", message: "Server is ready for your game code!" });
    });
  }

  // Настройка Vite как middleware для фронтенда
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      root: path.join(process.cwd(), "artifacts/baldurs-gate"),
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // В продакшене отдаем скомпилированные файлы
    const distPath = path.join(process.cwd(), "artifacts/baldurs-gate/dist/public");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
