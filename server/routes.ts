import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // Check call limits before starting conversation
  app.post("/api/call/check-limits", async (req, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // Get limits from database settings
      const [userLimitSetting, totalLimitSetting] = await Promise.all([
        storage.getSetting('DAILY_USER_LIMIT_MINUTES'),
        storage.getSetting('DAILY_TOTAL_LIMIT_MINUTES')
      ]);
      
      const dailyUserLimit = parseInt(userLimitSetting || '10'); // Default 10 if not set
      const dailyTotalLimit = parseInt(totalLimitSetting || '180'); // Default 180 if not set
      
      console.log(`Using database limits: User=${dailyUserLimit}min, Total=${dailyTotalLimit}min`);
      
      // Check current usage in seconds
      const [userSecondsUsed, totalSecondsUsed] = await Promise.all([
        storage.getDailyUserSeconds(userId, today),
        storage.getDailyTotalSeconds(today)
      ]);

      // Convert limits from minutes to seconds for comparison
      const dailyTotalLimitSeconds = dailyTotalLimit * 60;
      const dailyUserLimitSeconds = dailyUserLimit * 60;
      
      console.log(`Call limits check for user ${userId}:`);
      console.log(`- User seconds used today: ${userSecondsUsed}/${dailyUserLimitSeconds} (${Math.floor(userSecondsUsed/60)}m ${userSecondsUsed%60}s / ${dailyUserLimit}m)`);
      console.log(`- Total seconds used today: ${totalSecondsUsed}/${dailyTotalLimitSeconds} (${Math.floor(totalSecondsUsed/60)}m ${totalSecondsUsed%60}s / ${dailyTotalLimit}m)`);
      
      // Check if limits exceeded
      if (totalSecondsUsed >= dailyTotalLimitSeconds) {
        return res.status(429).json({ 
          error: "daily_total_limit_exceeded",
          message: "Thời lượng gọi đã đủ trong ngày, mời bạn quay lại ngày hôm sau.",
          userSecondsUsed,
          totalSecondsUsed,
          dailyUserLimit,
          dailyTotalLimit,
          userMinutesUsed: Math.floor(userSecondsUsed / 60),
          totalMinutesUsed: Math.floor(totalSecondsUsed / 60)
        });
      }
      
      if (userSecondsUsed >= dailyUserLimitSeconds) {
        return res.status(429).json({ 
          error: "daily_user_limit_exceeded", 
          message: "Thời lượng gọi đã đủ trong ngày, mời bạn quay lại ngày hôm sau.",
          userSecondsUsed,
          totalSecondsUsed,
          dailyUserLimit,
          dailyTotalLimit,
          userMinutesUsed: Math.floor(userSecondsUsed / 60),
          totalMinutesUsed: Math.floor(totalSecondsUsed / 60)
        });
      }
      
      // Limits OK, return current usage
      res.json({
        allowed: true,
        userSecondsUsed,
        totalSecondsUsed,
        dailyUserLimit,
        dailyTotalLimit,
        userSecondsRemaining: dailyUserLimitSeconds - userSecondsUsed,
        totalSecondsRemaining: dailyTotalLimitSeconds - totalSecondsUsed,
        // Legacy minute fields for backward compatibility
        userMinutesUsed: Math.floor(userSecondsUsed / 60),
        totalMinutesUsed: Math.floor(totalSecondsUsed / 60),
        userMinutesRemaining: Math.floor((dailyUserLimitSeconds - userSecondsUsed) / 60),
        totalMinutesRemaining: Math.floor((dailyTotalLimitSeconds - totalSecondsUsed) / 60)
      });
      
    } catch (error) {
      console.error('Error checking call limits:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Check limits during active call
  app.post("/api/call/check-active-limits", async (req, res) => {
    try {
      const { userId, callLogId, currentDurationSeconds } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      const today = new Date().toISOString().split('T')[0];
      
      // Get limits from database settings
      const [userLimitSetting, totalLimitSetting] = await Promise.all([
        storage.getSetting('DAILY_USER_LIMIT_MINUTES'),
        storage.getSetting('DAILY_TOTAL_LIMIT_MINUTES')
      ]);
      
      const dailyUserLimit = parseInt(userLimitSetting || '10'); // Default 10 if not set
      const dailyTotalLimit = parseInt(totalLimitSetting || '180'); // Default 180 if not set
      
      // Get current usage (excluding current active call)
      const [baseUserSecondsUsed, baseTotalSecondsUsed] = await Promise.all([
        storage.getDailyUserSeconds(userId, today),
        storage.getDailyTotalSeconds(today)
      ]);

      // Add current call duration to totals
      const currentCallSeconds = currentDurationSeconds || 0;
      const totalUserSecondsWithCurrent = baseUserSecondsUsed + currentCallSeconds;
      const totalSystemSecondsWithCurrent = baseTotalSecondsUsed + currentCallSeconds;
      
      // Convert limits to seconds
      const dailyUserLimitSeconds = dailyUserLimit * 60;
      const dailyTotalLimitSeconds = dailyTotalLimit * 60;
      
      console.log(`Active call limits check for user ${userId}:`);
      console.log(`- Current call duration: ${currentCallSeconds}s (${Math.floor(currentCallSeconds/60)}m ${currentCallSeconds%60}s)`);
      console.log(`- Total user seconds (with current): ${totalUserSecondsWithCurrent}/${dailyUserLimitSeconds}`);
      console.log(`- Total system seconds (with current): ${totalSystemSecondsWithCurrent}/${dailyTotalLimitSeconds}`);
      
      // Check if user limit exceeded
      if (totalUserSecondsWithCurrent >= dailyUserLimitSeconds) {
        console.log(`🚨 User ${userId} exceeded daily limit during call: ${totalUserSecondsWithCurrent}s >= ${dailyUserLimitSeconds}s`);
        
        // If callLogId provided, end the call automatically with proper duration calculation
        if (callLogId) {
          const now = new Date();
          
          // Get the actual call log to calculate real duration from start time
          const existingCallLog = await storage.getCallLog(callLogId);
          if (existingCallLog && existingCallLog.startTime && !existingCallLog.endTime) {
            const actualCallDurationMs = now.getTime() - new Date(existingCallLog.startTime).getTime();
            const actualCallDurationSeconds = Math.round(actualCallDurationMs / 1000);
            
            // Calculate the actual allowed duration to prevent over-recording
            const maxAllowedDuration = Math.max(0, dailyUserLimitSeconds - baseUserSecondsUsed);
            const actualDurationToRecord = Math.min(actualCallDurationSeconds, maxAllowedDuration);
            
            console.log(`🛑 Force-ending call ${callLogId}:`);
            console.log(`  - Actual call duration: ${actualCallDurationSeconds}s (${Math.floor(actualCallDurationSeconds/60)}m ${actualCallDurationSeconds%60}s)`);
            console.log(`  - Max allowed duration: ${maxAllowedDuration}s`);
            console.log(`  - Recording duration: ${actualDurationToRecord}s`);
            
            await storage.updateCallLog(callLogId, {
              endTime: now,
              durationSeconds: actualDurationToRecord,
              endReason: 'user_limit_exceeded'
            });
            console.log(`✅ Force-ended call ${callLogId} due to user limit exceeded. Recorded: ${actualDurationToRecord}s of actual ${actualCallDurationSeconds}s`);
          } else if (!existingCallLog) {
            console.log(`⚠️ Call log ${callLogId} not found - may have been already cleaned up. Limit enforcement still active.`);
          } else if (existingCallLog.endTime) {
            console.log(`⚠️ Call log ${callLogId} already ended at ${existingCallLog.endTime}. Duration: ${existingCallLog.durationSeconds}s`);
          } else {
            console.log(`❌ Call log ${callLogId} missing start time - cannot calculate duration`);
          }
        }
        
        return res.status(429).json({
          limitExceeded: true,
          reason: "user_limit_exceeded",
          message: `Bạn đã hết thời gian gọi trong ngày (${dailyUserLimit} phút). Cuộc gọi đã được kết thúc tự động.`,
          userSecondsUsed: totalUserSecondsWithCurrent,
          dailyUserLimit,
          dailyUserLimitSeconds,
          userSecondsRemaining: Math.max(0, dailyUserLimitSeconds - totalUserSecondsWithCurrent),
          autoEnded: !!callLogId,
          forceEnd: true
        });
      }
      
      // Check if system limit exceeded
      if (totalSystemSecondsWithCurrent >= dailyTotalLimitSeconds) {
        console.log(`🚨 System limit exceeded during call (user ${userId}): ${totalSystemSecondsWithCurrent}s >= ${dailyTotalLimitSeconds}s`);
        
        // If callLogId provided, end the call automatically with proper duration calculation
        if (callLogId) {
          const now = new Date();
          
          // Get the actual call log to calculate real duration from start time
          const existingCallLog = await storage.getCallLog(callLogId);
          if (existingCallLog && existingCallLog.startTime && !existingCallLog.endTime) {
            const actualCallDurationMs = now.getTime() - new Date(existingCallLog.startTime).getTime();
            const actualCallDurationSeconds = Math.round(actualCallDurationMs / 1000);
            
            // Calculate the actual allowed duration to prevent over-recording
            const maxAllowedDuration = Math.max(0, dailyTotalLimitSeconds - baseTotalSecondsUsed);
            const actualDurationToRecord = Math.min(actualCallDurationSeconds, maxAllowedDuration);
            
            console.log(`🛑 Force-ending call ${callLogId} (system limit):`);
            console.log(`  - Actual call duration: ${actualCallDurationSeconds}s (${Math.floor(actualCallDurationSeconds/60)}m ${actualCallDurationSeconds%60}s)`);
            console.log(`  - Max allowed duration: ${maxAllowedDuration}s`);
            console.log(`  - Recording duration: ${actualDurationToRecord}s`);
            
            await storage.updateCallLog(callLogId, {
              endTime: now,
              durationSeconds: actualDurationToRecord,
              endReason: 'system_limit_exceeded'
            });
            console.log(`✅ Force-ended call ${callLogId} due to system limit exceeded. Recorded: ${actualDurationToRecord}s of actual ${actualCallDurationSeconds}s`);
          } else if (!existingCallLog) {
            console.log(`⚠️ Call log ${callLogId} not found - may have been already cleaned up. Limit enforcement still active.`);
          } else if (existingCallLog.endTime) {
            console.log(`⚠️ Call log ${callLogId} already ended at ${existingCallLog.endTime}. Duration: ${existingCallLog.durationSeconds}s`);
          } else {
            console.log(`❌ Call log ${callLogId} missing start time - cannot calculate duration`);
          }
        }
        
        return res.status(429).json({
          limitExceeded: true,
          reason: "system_limit_exceeded", 
          message: `Hệ thống đã hết thời gian gọi trong ngày (${dailyTotalLimit} phút). Cuộc gọi đã được kết thúc tự động.`,
          totalSecondsUsed: totalSystemSecondsWithCurrent,
          dailyTotalLimit,
          dailyTotalLimitSeconds,
          totalSecondsRemaining: Math.max(0, dailyTotalLimitSeconds - totalSystemSecondsWithCurrent),
          autoEnded: !!callLogId,
          forceEnd: true
        });
      }
      
      // Calculate remaining time and warnings
      const userSecondsRemaining = Math.max(0, dailyUserLimitSeconds - totalUserSecondsWithCurrent);
      const totalSecondsRemaining = Math.max(0, dailyTotalLimitSeconds - totalSystemSecondsWithCurrent);
      const warningThreshold = 30; // 30 seconds warning
      
      let warning = null;
      if (userSecondsRemaining <= warningThreshold && userSecondsRemaining > 0) {
        warning = {
          type: 'user_limit_warning',
          message: `Chỉ còn ${userSecondsRemaining} giây cho cuộc gọi của bạn`,
          secondsRemaining: userSecondsRemaining
        };
      } else if (totalSecondsRemaining <= warningThreshold && totalSecondsRemaining > 0) {
        warning = {
          type: 'system_limit_warning', 
          message: `Hệ thống chỉ còn ${totalSecondsRemaining} giây`,
          secondsRemaining: totalSecondsRemaining
        };
      }
      
      // Limits OK
      res.json({
        limitExceeded: false,
        userSecondsUsed: totalUserSecondsWithCurrent,
        totalSecondsUsed: totalSystemSecondsWithCurrent,
        dailyUserLimit,
        dailyTotalLimit,
        dailyUserLimitSeconds,
        dailyTotalLimitSeconds,
        userSecondsRemaining,
        totalSecondsRemaining,
        warning,
        currentCallDuration: currentCallSeconds
      });
      
    } catch (error) {
      console.error('Error checking active call limits:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Force end active call (emergency endpoint)
  app.post("/api/call/force-end", async (req, res) => {
    try {
      const { userId, callLogId, reason } = req.body;
      
      if (!userId && !callLogId) {
        return res.status(400).json({ error: "userId or callLogId is required" });
      }

      let callLog;
      const now = new Date();
      
      if (callLogId) {
        // End specific call by ID
        const existingCall = await storage.getCallLog(callLogId);
        if (!existingCall) {
          return res.status(404).json({ error: "Call log not found" });
        }
        
        if (existingCall.endTime) {
          return res.status(400).json({ error: "Call already ended" });
        }
        
        // Calculate duration and end the call
        const durationMs = now.getTime() - new Date(existingCall.startTime).getTime();
        const durationSeconds = Math.round(durationMs / 1000);
        
        callLog = await storage.updateCallLog(callLogId, {
          endTime: now,
          durationSeconds,
          endReason: reason || 'force_end'
        });
        
        console.log(`🛑 Force-ended call ${callLogId} for user ${existingCall.userId}, duration: ${durationSeconds}s, reason: ${reason || 'force_end'}`);
      } else if (userId) {
        // Find and end active call for user
        const activeCall = await storage.getActiveCall(userId);
        if (!activeCall) {
          return res.status(404).json({ error: "No active call found for user" });
        }
        
        const durationMs = now.getTime() - new Date(activeCall.startTime).getTime();
        const durationSeconds = Math.round(durationMs / 1000);
        
        callLog = await storage.updateCallLog(activeCall.id, {
          endTime: now,
          durationSeconds,
          endReason: reason || 'force_end'
        });
        
        console.log(`🛑 Force-ended active call ${activeCall.id} for user ${userId}, duration: ${durationSeconds}s, reason: ${reason || 'force_end'}`);
      }
      
      if (callLog) {
        res.json({ 
          success: true,
          message: "Call force-ended successfully",
          callLog,
          endReason: reason || 'force_end'
        });
      } else {
        res.status(500).json({ error: 'Failed to end call' });
      }
      
    } catch (error) {
      console.error('Error force-ending call:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Start call logging
  app.post("/api/call/start", async (req, res) => {
    try {
      const { userId, conversationId, elevenLabsStartTime } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      // CRITICAL: Check limits BEFORE allowing call to start
      const totalUserSecondsToday = await storage.getDailyUserSeconds(userId, today);
      const totalSystemSecondsToday = await storage.getDailyTotalSeconds(today);
      
      // Get limits from database settings (dynamic)
      const [userLimitSetting, totalLimitSetting] = await Promise.all([
        storage.getSetting('DAILY_USER_LIMIT_MINUTES'),
        storage.getSetting('DAILY_TOTAL_LIMIT_MINUTES')
      ]);
      
      const dailyUserLimit = parseInt(userLimitSetting || '10'); // Default 10 if not set
      const dailyTotalLimit = parseInt(totalLimitSetting || '180'); // Default 180 if not set
      const dailyUserLimitSeconds = dailyUserLimit * 60;
      const dailyTotalLimitSeconds = dailyTotalLimit * 60;
      
      // Check if user has exceeded daily limit
      if (totalUserSecondsToday >= dailyUserLimitSeconds) {
        return res.status(403).json({ 
          error: `Bạn đã vượt quá giới hạn ${dailyUserLimit} phút/ngày`,
          userSecondsUsed: totalUserSecondsToday,
          userLimit: dailyUserLimitSeconds
        });
      }
      
      // Check if system has exceeded daily limit
      if (totalSystemSecondsToday >= dailyTotalLimitSeconds) {
        return res.status(403).json({ 
          error: `Hệ thống đã vượt quá giới hạn ${dailyTotalLimit} phút/ngày`,
          systemSecondsUsed: totalSystemSecondsToday,
          systemLimit: dailyTotalLimitSeconds
        });
      }
      
      // Create call log entry
      const callLog = await storage.createCallLog({
        userId,
        startTime: now,
        conversationId: conversationId || null,
        date: today,
        durationSeconds: 0,
        elevenLabsStartTime: elevenLabsStartTime ? new Date(elevenLabsStartTime) : now,
        endReason: null
      });
      
      console.log(`✅ Call started for user ${userId}, log ID: ${callLog.id} - User: ${totalUserSecondsToday}/${dailyUserLimitSeconds}s, System: ${totalSystemSecondsToday}/${dailyTotalLimitSeconds}s`);
      
      res.json({ 
        callLogId: callLog.id, 
        startTime: now,
        userSecondsRemaining: dailyUserLimitSeconds - totalUserSecondsToday,
        systemSecondsRemaining: dailyTotalLimitSeconds - totalSystemSecondsToday
      });
      
    } catch (error) {
      console.error('Error starting call log:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // End call logging
  app.post("/api/call/end", async (req, res) => {
    try {
      const { callLogId, userId, elevenLabsEndTime, elevenLabsDurationMs, endReason } = req.body;
      
      if (!callLogId && !userId) {
        return res.status(400).json({ error: "callLogId or userId is required" });
      }

      let callLog;
      const now = new Date();
      
      if (callLogId) {
        // Update specific call log by ID
        callLog = await storage.updateCallLog(callLogId, {
          endTime: now,
          elevenLabsEndTime: elevenLabsEndTime ? new Date(elevenLabsEndTime) : now,
          elevenLabsDurationMs: elevenLabsDurationMs || null,
          endReason: endReason || 'user_stop'
        });
        
        if (callLog && callLog.startTime) {
          // Calculate duration - prefer ElevenLabs timing if available
          let durationMs;
          let durationSeconds;
          
          if (elevenLabsDurationMs) {
            durationMs = elevenLabsDurationMs;
            durationSeconds = Math.round(durationMs / 1000);
            console.log(`Using ElevenLabs duration: ${durationMs}ms = ${durationSeconds} seconds`);
          } else if (callLog.elevenLabsStartTime && elevenLabsEndTime) {
            durationMs = new Date(elevenLabsEndTime).getTime() - new Date(callLog.elevenLabsStartTime).getTime();
            durationSeconds = Math.round(durationMs / 1000);
            console.log(`Calculated from ElevenLabs timestamps: ${durationMs}ms = ${durationSeconds} seconds`);
          } else {
            // Fallback to system timestamps
            durationMs = now.getTime() - new Date(callLog.startTime).getTime();
            durationSeconds = Math.round(durationMs / 1000);
            console.log(`Fallback to system timestamps: ${durationMs}ms = ${durationSeconds} seconds`);
          }
          
          callLog = await storage.updateCallLog(callLogId, {
            durationSeconds,
            elevenLabsDurationMs: durationMs
          });
        }
      } else if (userId) {
        // Find and end active call for user
        const activeCall = await storage.getActiveCall(userId);
        if (activeCall) {
          const durationMs = now.getTime() - new Date(activeCall.startTime).getTime();
          const durationSeconds = Math.round(durationMs / 1000);
          
          callLog = await storage.updateCallLog(activeCall.id, {
            endTime: now,
            durationSeconds,
            elevenLabsEndTime: elevenLabsEndTime ? new Date(elevenLabsEndTime) : now,
            elevenLabsDurationMs: elevenLabsDurationMs || durationMs,
            endReason: endReason || 'user_stop'
          });
        }
      }
      
      if (callLog) {
        const durationSource = callLog.elevenLabsDurationMs && elevenLabsDurationMs ? 'ElevenLabs' : 'System';
        const durationSeconds = callLog.durationSeconds || 0;
        const minutes = Math.floor(durationSeconds / 60);
        const seconds = durationSeconds % 60;
        console.log(`Call ended for user ${userId || 'unknown'}, duration: ${durationSeconds} seconds (${minutes}m ${seconds}s) (${durationSource} timing), reason: ${callLog.endReason}`);
        res.json({ 
          callLog,
          message: `Call logged successfully: ${durationSeconds} seconds (${minutes}m ${seconds}s) (${durationSource} timing)`
        });
      } else {
        res.status(404).json({ error: 'Call log not found' });
      }
      
    } catch (error) {
      console.error('Error ending call log:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Cleanup orphaned calls - end calls that have been active too long
  app.post("/api/call/cleanup-orphaned", async (req, res) => {
    try {
      const { maxDurationMinutes = 2.0 } = req.body; // Default max 2 minutes to allow for real calls
      
      const cutoffTime = new Date(Date.now() - maxDurationMinutes * 60 * 1000);
      
      // Find calls that started before cutoff time and are still active (no endTime)
      const orphanedCalls = await storage.getOrphanedCalls(cutoffTime);
      
      let cleanedCount = 0;
      
      for (const call of orphanedCalls) {
        const now = new Date();
        const durationMs = now.getTime() - new Date(call.startTime).getTime();
        const durationSeconds = Math.round(durationMs / 1000);
        
        await storage.updateCallLog(call.id, {
          endTime: now,
          durationSeconds,
          endReason: 'browser_disconnect'
        });
        
        const minutes = Math.floor(durationSeconds / 60);
        const seconds = durationSeconds % 60;
        console.log(`🧹 Auto-ended orphaned call ${call.id} for user ${call.userId}, duration: ${durationSeconds}s (${minutes}m ${seconds}s) - likely browser disconnect`);
        cleanedCount++;
      }
      
      res.json({ 
        message: `Cleaned up ${cleanedCount} orphaned calls`,
        cleanedCount,
        orphanedCalls: orphanedCalls.map(c => ({ id: c.id, userId: c.userId, startTime: c.startTime }))
      });
      
    } catch (error) {
      console.error('Error cleaning up orphaned calls:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Admin endpoint to reset all call data
  app.post('/api/admin/reset-data', async (req, res) => {
    try {
      const result = await storage.resetAllCallData();
      console.log(`Reset all call data: ${result.deletedCount} records deleted`);
      res.json({ 
        message: `Successfully reset all call data`,
        deletedCount: result.deletedCount,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error resetting call data:', error);
      res.status(500).json({ error: 'Failed to reset call data' });
    }
  });

  // Admin endpoint to get current usage stats
  app.get('/api/admin/usage-stats', async (req, res) => {
    try {
      const stats = await storage.getUsageStats();
      res.json(stats);
    } catch (error) {
      console.error('Error getting usage stats:', error);
      res.status(500).json({ error: 'Failed to get usage stats' });
    }
  });

  // Admin endpoint to get detailed call logs with filtering
  app.get('/api/admin/call-logs', async (req, res) => {
    try {
      const { date, userId, page = '1', limit = '50' } = req.query;
      
      const logs = await storage.getCallLogsWithFilters({
        date: date as string,
        userId: userId as string,
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      });
      
      res.json(logs);
    } catch (error) {
      console.error('Error getting call logs:', error);
      res.status(500).json({ error: 'Failed to get call logs' });
    }
  });

  // Get user daily call minutes
  app.get('/api/user/:userId/total-minutes', async (req, res) => {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      // Get total seconds from completed calls for this user today
      const totalSeconds = await storage.getUserDailySeconds(userId);
      const totalMinutes = Math.floor(totalSeconds / 60);
      const remainingSeconds = totalSeconds % 60;
      
      res.json({
        userId,
        totalSeconds,
        totalMinutes,
        remainingSeconds,
        formattedTime: `${totalMinutes}:${remainingSeconds.toString().padStart(2, '0')}`
      });
      
    } catch (error) {
      console.error('Error getting user daily minutes:', error);
      res.status(500).json({ error: 'Failed to get user daily minutes' });
    }
  });

  // Token verification endpoint
  app.post("/api/verify-token", async (req, res) => {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ error: "token is required" });
      }

      console.log('Verifying token...');
      
      const response = await fetch('https://stage.incard.biz/api/verify-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();
      console.log('Token verification response:', data);
      
      if (!response.ok || !data.status) {
        return res.status(401).json({ 
          valid: false, 
          message: data.message || 'Invalid token',
          errors: data.errors || []
        });
      }

      // Token is valid, return user data
      res.json({
        valid: true,
        message: data.message,
        userData: data.data
      });
      
    } catch (error) {
      console.error('Error verifying token:', error);
      res.status(500).json({ 
        valid: false,
        error: 'Token verification failed',
        message: 'Internal server error'
      });
    }
  });

  // ElevenLabs signed URL endpoint - optimized (token already verified on startup)
  app.get("/api/elevenlabs/signed-url", async (req, res) => {
    try {
      const { agent_id, user_id } = req.query;
      
      if (!agent_id) {
        return res.status(400).json({ error: "agent_id is required" });
      }

      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "ElevenLabs API key not configured" });
      }

      const userId = user_id;

      // Build the URL with user_id parameter
      let url = `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agent_id}`;
      
      if (userId) {
        url += `&user_id=${userId}`;
        console.log(`Including userid parameter: ${userId}`);
        console.log(`Full ElevenLabs URL: ${url}`);
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ElevenLabs API error:', response.status, errorText);
        return res.status(response.status).json({ 
          error: 'Failed to get signed URL from ElevenLabs',
          details: errorText 
        });
      }

      const data = await response.json();
      console.log('ElevenLabs response:', JSON.stringify(data, null, 2));
      
      // Check if the response contains any timeout or session configuration
      if (data.signed_url) {
        console.log('Signed URL generated successfully');
      }
      
      // Return signed URL (no userData needed since token already verified)
      res.json(data);
    } catch (error) {
      console.error('Error getting signed URL:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  // System settings management endpoints
  app.get("/api/admin/settings", async (req, res) => {
    try {
      const settings = await storage.getAllSettings();
      res.json(settings);
    } catch (error) {
      console.error('Error getting settings:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post("/api/admin/settings", async (req, res) => {
    try {
      const { key, value, description } = req.body;
      
      if (!key || !value) {
        return res.status(400).json({ error: "key and value are required" });
      }
      
      const setting = await storage.setSetting(key, value, description);
      res.json(setting);
    } catch (error) {
      console.error('Error setting value:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/admin/settings/:key", async (req, res) => {
    try {
      const { key } = req.params;
      const value = await storage.getSetting(key);
      
      if (value === undefined) {
        return res.status(404).json({ error: "Setting not found" });
      }
      
      res.json({ key, value });
    } catch (error) {
      console.error('Error getting setting:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Admin API - Get call logs with filtering and pagination
  app.get("/api/admin/call-logs", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100); // Max 100 per page
      const date = req.query.date as string;
      const userId = req.query.userId as string;

      const result = await storage.getCallLogsWithFilters({
        date,
        userId,
        page,
        limit
      });

      res.json(result);
    } catch (error) {
      console.error('Error fetching call logs:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Initialize default settings if they don't exist
  const initializeDefaultSettings = async () => {
    try {
      // Check if settings exist, if not create defaults
      const userLimit = await storage.getSetting('DAILY_USER_LIMIT_MINUTES');
      const totalLimit = await storage.getSetting('DAILY_TOTAL_LIMIT_MINUTES');
      
      if (!userLimit) {
        await storage.setSetting('DAILY_USER_LIMIT_MINUTES', '5', 'Daily call limit per user in minutes');
        console.log('Initialized DAILY_USER_LIMIT_MINUTES to 5 minutes');
      }
      
      if (!totalLimit) {
        await storage.setSetting('DAILY_TOTAL_LIMIT_MINUTES', '180', 'Daily total call limit for all users in minutes');
        console.log('Initialized DAILY_TOTAL_LIMIT_MINUTES to 180 minutes');
      }
    } catch (error) {
      console.error('Error initializing default settings:', error);
    }
  };

  // Initialize defaults on server start
  initializeDefaultSettings();

  const httpServer = createServer(app);

  return httpServer;
}