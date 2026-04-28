import { pgTable, serial, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const gameSavesTable = pgTable("game_saves", {
  id: serial("id").primaryKey(),
  slotId: integer("slot_id").notNull(),
  gameState: jsonb("game_state").notNull(),
  savedAt: timestamp("saved_at").defaultNow().notNull(),
});

export const insertGameSaveSchema = createInsertSchema(gameSavesTable).omit({ id: true, savedAt: true });
export type InsertGameSave = z.infer<typeof insertGameSaveSchema>;
export type GameSave = typeof gameSavesTable.$inferSelect;
