import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const callLogs = pgTable("call_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  durationSeconds: integer("duration_seconds").default(0),
  conversationId: text("conversation_id"),
  date: text("date").notNull(), // Format: YYYY-MM-DD for easy daily queries
  elevenLabsStartTime: timestamp("elevenlabs_start_time"),
  elevenLabsEndTime: timestamp("elevenlabs_end_time"),
  elevenLabsDurationMs: integer("elevenlabs_duration_ms"),
  endReason: text("end_reason"), // 'user_stop', 'timeout', 'error', 'disconnect'
});

export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertCallLogSchema = createInsertSchema(callLogs).pick({
  userId: true,
  startTime: true,
  endTime: true,
  durationSeconds: true,
  conversationId: true,
  date: true,
  elevenLabsStartTime: true,
  elevenLabsEndTime: true,
  elevenLabsDurationMs: true,
  endReason: true,
});

export const insertSystemSettingSchema = createInsertSchema(systemSettings).pick({
  key: true,
  value: true,
  description: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertCallLog = z.infer<typeof insertCallLogSchema>;
export type CallLog = typeof callLogs.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type SystemSetting = typeof systemSettings.$inferSelect;
