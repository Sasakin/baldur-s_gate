import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { gameSavesTable } from "@workspace/db/schema";
import { SaveGameBody, SaveGameResponse, LoadGameResponse } from "@workspace/api-zod";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

// ── Neon wakeup: retry once on "endpoint disabled" errors ────────────────────
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    // Check both the top-level message AND the nested cause message
    const msg = `${String(err?.message ?? "")} ${String(err?.cause?.message ?? "")}`.toLowerCase();
    if (msg.includes("endpoint") || msg.includes("disabled") || msg.includes("starting")) {
      // Wait 3s for Neon to wake up, then retry once
      await new Promise(r => setTimeout(r, 3000));
      return await fn();
    }
    throw err;
  }
}

router.post("/save", async (req, res) => {
  try {
    const body = SaveGameBody.parse(req.body);
    const { slotId, gameState } = body;

    const savedAt = await withRetry(async () => {
      const existing = await db
        .select()
        .from(gameSavesTable)
        .where(eq(gameSavesTable.slotId, slotId))
        .limit(1);

      if (existing.length > 0) {
        const [updated] = await db
          .update(gameSavesTable)
          .set({ gameState, savedAt: new Date() })
          .where(eq(gameSavesTable.slotId, slotId))
          .returning();
        return updated.savedAt;
      } else {
        const [created] = await db
          .insert(gameSavesTable)
          .values({ slotId, gameState })
          .returning();
        return created.savedAt;
      }
    });

    const response = SaveGameResponse.parse({
      success: true,
      message: `Game saved to slot ${slotId}`,
      savedAt: savedAt.toISOString(),
    });

    res.json(response);
  } catch (error) {
    console.error("Error saving game:", error);
    // Return 200 so the frontend knows it's a graceful failure (save is in localStorage anyway)
    res.json({ success: false, message: "Cloud save unavailable — saved locally.", savedAt: new Date().toISOString() });
  }
});

router.get("/load", async (_req, res) => {
  try {
    const saves = await withRetry(() =>
      db
        .select()
        .from(gameSavesTable)
        .orderBy(desc(gameSavesTable.savedAt))
        .limit(10)
    );

    const slots = saves.map((save) => ({
      slotId:    save.slotId,
      savedAt:   save.savedAt.toISOString(),
      gameState: save.gameState as any,
    }));

    const response = LoadGameResponse.parse({ slots });
    res.json(response);
  } catch (error) {
    console.error("Error loading game:", error);
    // Return empty slots — frontend will fall back to localStorage
    res.json({ slots: [] });
  }
});

export default router;
