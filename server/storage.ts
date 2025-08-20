import { users, callLogs, systemSettings, type User, type InsertUser, type InsertCallLog, type CallLog, type InsertSystemSetting, type SystemSetting } from "@shared/schema";
import { db } from "./db";
import { eq, and, sum, isNull, lt } from "drizzle-orm";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Call log methods
  createCallLog(callLog: InsertCallLog): Promise<CallLog>;
  updateCallLog(id: number, updates: Partial<InsertCallLog>): Promise<CallLog | undefined>;
  getDailyUserSeconds(userId: string, date: string): Promise<number>;
  getDailyTotalSeconds(date: string): Promise<number>;
  getActiveCall(userId: string): Promise<CallLog | undefined>;
  getOrphanedCalls(cutoffTime: Date): Promise<CallLog[]>;
  
  // System settings methods
  getSetting(key: string): Promise<string | undefined>;
  setSetting(key: string, value: string, description?: string): Promise<SystemSetting>;
  getAllSettings(): Promise<SystemSetting[]>;
  
  // Admin methods
  resetAllCallData(): Promise<{ deletedCount: number }>;
  getUsageStats(): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createCallLog(callLog: InsertCallLog): Promise<CallLog> {
    const [log] = await db
      .insert(callLogs)
      .values(callLog)
      .returning();
    return log;
  }

  async updateCallLog(id: number, updates: Partial<InsertCallLog>): Promise<CallLog | undefined> {
    const [log] = await db
      .update(callLogs)
      .set(updates)
      .where(eq(callLogs.id, id))
      .returning();
    return log || undefined;
  }

  async getDailyUserSeconds(userId: string, date: string): Promise<number> {
    const result = await db
      .select({ total: sum(callLogs.durationSeconds) })
      .from(callLogs)
      .where(and(
        eq(callLogs.userId, userId),
        eq(callLogs.date, date)
      ));
    
    return Number(result[0]?.total || 0);
  }

  async getDailyTotalSeconds(date: string): Promise<number> {
    const result = await db
      .select({ total: sum(callLogs.durationSeconds) })
      .from(callLogs)
      .where(eq(callLogs.date, date));
    
    return Number(result[0]?.total || 0);
  }

  async getActiveCall(userId: string): Promise<CallLog | undefined> {
    const [call] = await db
      .select()
      .from(callLogs)
      .where(and(
        eq(callLogs.userId, userId),
        isNull(callLogs.endTime)
      ))
      .limit(1);
    
    return call || undefined;
  }

  async getOrphanedCalls(cutoffTime: Date): Promise<CallLog[]> {
    const calls = await db
      .select()
      .from(callLogs)
      .where(and(
        isNull(callLogs.endTime),
        lt(callLogs.startTime, cutoffTime) // calls started before cutoff and still active
      ));
    
    return calls;
  }

  async resetAllCallData(): Promise<{ deletedCount: number }> {
    const result = await db.delete(callLogs);
    return { deletedCount: result.rowCount || 0 };
  }

  // System settings methods
  async getSetting(key: string): Promise<string | undefined> {
    const [setting] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    return setting?.value;
  }

  async setSetting(key: string, value: string, description?: string): Promise<SystemSetting> {
    const now = new Date();
    
    // Upsert: update if exists, insert if not
    const [existing] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    
    if (existing) {
      const [updated] = await db
        .update(systemSettings)
        .set({ value, description, updatedAt: now })
        .where(eq(systemSettings.key, key))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(systemSettings)
        .values({ key, value, description, updatedAt: now })
        .returning();
      return created;
    }
  }

  async getAllSettings(): Promise<SystemSetting[]> {
    return await db.select().from(systemSettings);
  }

  async getUsageStats(): Promise<any> {
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's total usage
    const dailyTotal = await this.getDailyTotalSeconds(today);
    
    // Get all users' usage today
    const userStats = await db
      .select({
        userId: callLogs.userId,
        totalSeconds: sum(callLogs.durationSeconds)
      })
      .from(callLogs)
      .where(eq(callLogs.date, today))
      .groupBy(callLogs.userId);

    // Use fixed config limits as per requirements
    // Use fixed config limits as per requirements
    const dailyTotalLimitMinutes = 180; // 180 minutes total per day
    const dailyUserLimitMinutes = 10; // 10 minutes per user per day
    
    return {
      date: today,
      dailyTotalSeconds: dailyTotal,
      dailyTotalLimitSeconds: dailyTotalLimitMinutes * 60,
      dailyUserLimitSeconds: dailyUserLimitMinutes * 60,
      userStats: userStats.map(stat => ({
        userId: stat.userId,
        totalSeconds: Number(stat.totalSeconds || 0),
        remainingSeconds: Math.max(0, (dailyUserLimitMinutes * 60) - Number(stat.totalSeconds || 0))
      })),
      systemRemainingSeconds: Math.max(0, (dailyTotalLimitMinutes * 60) - dailyTotal)
    };
  }
}

export const storage = new DatabaseStorage();
