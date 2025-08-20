import { useState, useEffect, useRef } from "react";
import { useConversation } from "@elevenlabs/react";
import { toast } from "@/hooks/use-toast";
import { ELEVENLABS_CONFIG } from "@/config/elevenlabs";
import VoiceAvatar from "./VoiceAvatar";
import InfoModal from "./InfoModal";
import AudioFilters from "@/utils/audioFilters";

// Language content configuration
const LANGUAGE_CONTENT = {
  en: {
    tokenRequired: "Token Required",
    tokenRequiredMessage:
      "Please provide a valid token in the URL: ?token=your_jwt_token",
    mainText: "With Inka, you can:",
    callLimitError: "Call Limit Reached",
    calling: "Calling...",
    connected: "Connected",
    disconnected: "Call Ended",
    firstMessage:
      "Hello {{user_name}}, I am INKA - your personal assistant. What would you like me to help with today?",
    features: [
      {
        key: "Appointment",
        text: "Create, edit, and manage your schedules with ease.",
      },
      {
        key: "Email",
        text: "Check, send and reply to emails quickly and accurately.",
      },
      { key: "Contact", text: "Find and manage your contacts efficiently." },
      {
        key: "Tasks & Notes",
        text: "Organize tasks, take notes, and track your progress.",
      },
      {
        key: "Online Research",
        text: "Search for information online – fast and reliable.",
      },
      {
        key: "Ask Me Anything",
        text: "Ask any question – Inka is here to help!",
      },
    ],
  },
  vi: {
    tokenRequired: "Cần Token",
    tokenRequiredMessage:
      "Vui lòng cung cấp token hợp lệ trong URL: ?token=your_jwt_token",
    mainText: "Với Inka, bạn có thể:",
    callLimitError: "Giới hạn cuộc gọi",
    calling: "Đang gọi...",
    connected: "Đã kết nối",
    disconnected: "Đã kết thúc cuộc gọi",
    firstMessage:
      "Em chào {{greeting_message}} {{user_name}}, em là INKA - một trợ lý cá nhân. {{user_name}} muốn em giúp gì trong hôm nay?",
    features: [
      {
        key: "Cuộc hẹn",
        text: "Tạo, chỉnh sửa và quản lý lịch trình của bạn một cách dễ dàng.",
      },
      {
        key: "Email",
        text: "Kiểm tra, gửi và trả lời email nhanh chóng và chính xác.",
      },
      {
        key: "Danh bạ",
        text: "Tìm kiếm và quản lý liên hệ của bạn một cách hiệu quả.",
      },
      {
        key: "Công việc & Ghi chú",
        text: "Tổ chức công việc, ghi chú và theo dõi tiến độ.",
      },
      {
        key: "Tìm kiếm trực tuyến",
        text: "Tra cứu thông tin trên mạng – nhanh chóng và đáng tin cậy.",
      },
      {
        key: "Hỏi tôi bất cứ điều gì",
        text: "Đặt bất kỳ câu hỏi nào – Inka luôn sẵn sàng hỗ trợ bạn!",
      },
    ],
  },
};

const VoiceAgent = () => {
  const [isListening, setIsListening] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [stopTimeout, setStopTimeout] = useState<NodeJS.Timeout | null>(null);
  const [callLogId, setCallLogId] = useState<number | null>(null);
  const [callLimitsInfo, setCallLimitsInfo] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  const [limitCheckInterval, setLimitCheckInterval] =
    useState<NodeJS.Timeout | null>(null);
  const [noiseFilterEnabled, setNoiseFilterEnabled] = useState(true);
  const [noiseSensitivity, setNoiseSensitivity] = useState<
    "low" | "medium" | "high"
  >("medium");
  const audioFiltersRef = useRef<AudioFilters | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  
  // Refs for callback access to current state values
  const conversationIdRef = useRef<string | null>(null);
  const callLogIdRef = useRef<number | null>(null);
  const callStartTimeRef = useRef<Date | null>(null);

  // Extract token and language from URL on component mount
  const [token, setToken] = useState<string>("");
  const [userData, setUserData] = useState<any>(null);
  const [userId, setUserId] = useState<string>("");
  const [tokenVerified, setTokenVerified] = useState<boolean>(false);
  const [language, setLanguage] = useState<string>("vi"); // Default to Vietnamese
  const [totalMinutesUsed, setTotalMinutesUsed] = useState<string>("0:00");
  const [dailyUserLimit, setDailyUserLimit] = useState<number>(10); // Default to 10, will be updated from backend
  
  // Real-time usage tracking
  const [currentCallDuration, setCurrentCallDuration] = useState(0);
  const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sync state with refs for callback access
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    callLogIdRef.current = callLogId;
  }, [callLogId]);

  useEffect(() => {
    callStartTimeRef.current = callStartTime;
  }, [callStartTime]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const extractedToken = urlParams.get("token");
    const extractedLanguage = urlParams.get("language") || "vi"; // Default to 'vi' if not specified

    setLanguage(extractedLanguage);
    console.log("Language set to:", extractedLanguage);

    if (extractedToken) {
      setToken(extractedToken);
      console.log("VoiceAgent component mounted, token extracted from URL");

      // Validate token immediately on app startup
      verifyTokenAndGetUserData(extractedToken).catch((error) => {
        console.error("Token validation on startup failed:", error);
      });
    } else {
      console.log("No token found in URL");
    }

    // Initialize audio filters
    audioFiltersRef.current = new AudioFilters();

    return () => {
      // Cleanup audio filters on unmount
      if (audioFiltersRef.current) {
        audioFiltersRef.current.dispose();
      }
      
      // Cleanup usage tracking
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
      }
    };
  }, []);

  const conversation = useConversation({
    // Pass micMuted state to ElevenLabs hook for proper microphone control
    micMuted: isMuted,
    
    onConnect: () => {
      console.log("🔥 ELEVENLABS CONNECTED - onConnect callback triggered!");
      console.log("ElevenLabs: Connected to voice agent");
      console.log("📍 onConnect: About to set isListening to true");
      console.log("📍 onConnect: conversationId =", conversationId, "callLogId =", callLogId);
      console.log("📍 onConnect: callStartTime =", callStartTime);
      console.log("📍 onConnect: conversationIdRef.current =", conversationIdRef.current);
      console.log("📍 onConnect: callLogIdRef.current =", callLogIdRef.current);
      console.log("📍 onConnect: callStartTimeRef.current =", callStartTimeRef.current);
      
      // CRITICAL: Only set listening if we intentionally started a conversation
      const currentConversationId = conversationIdRef.current || conversationId;
      const currentCallLogId = callLogIdRef.current || callLogId;
      const currentCallStartTime = callStartTimeRef.current || callStartTime;
      
      if (currentConversationId) {
        console.log("📍 onConnect: Setting isListening=true because we have conversationId");
        setIsListening(true);
        
        // 🔥 CRITICAL FIX: Start tracking functions when ElevenLabs connects successfully
        if (currentCallStartTime && currentCallLogId) {
          console.log("🚀 onConnect: Starting tracking functions with callStartTime:", currentCallStartTime);
          console.log("🚀 onConnect: callLogId:", currentCallLogId);
          startUsageTrackingWithTime(currentCallStartTime);
          startLimitMonitoringWithTime(currentCallStartTime);
          console.log("🎯 onConnect: Tracking functions started successfully!");
        } else if (currentCallLogId) {
          // Fallback with current time if callStartTime is not set
          const fallbackTime = new Date();
          console.log("🔄 onConnect: Using fallback time for tracking:", fallbackTime);
          startUsageTrackingWithTime(fallbackTime);
          startLimitMonitoringWithTime(fallbackTime);
        } else {
          console.warn("⚠️ onConnect: No callLogId available, cannot start tracking!");
        }
      } else {
        console.log("🚨 onConnect: NOT setting isListening=true - no conversationId, probably auto-connect");
        // Force disconnect if this is an unwanted auto-connect
        console.log("🚨 onConnect: Force disconnecting unwanted auto-connection");
        conversation.endSession().catch(console.error);
      }
      // No toast notification for connection
    },
    onDisconnect: () => {
      console.log("🔥 ELEVENLABS DISCONNECTED - onDisconnect callback triggered!");
      console.log("ElevenLabs: Disconnected from voice agent");

      // Stop limit monitoring
      stopLimitMonitoring();

      // Reset UI states on disconnect
      setIsListening(false);
      setConversationId(null);
      setAudioLevel(0); // Tắt hiệu ứng wave khi disconnect
      setIsMuted(false); // Reset mute state when disconnected

      // Auto-end call logging when ElevenLabs disconnects
      if (callLogId) {
        console.log("ElevenLabs disconnected, ending call log...");
        endCallLog("disconnect");
      }

      // No toast notification for disconnection
    },
    onMessage: (message: any) => {
      console.log("ElevenLabs: Message received:", message);

      // Track conversation activity for more accurate timing
      if (message?.type === "conversation_initiation_metadata") {
        console.log("ElevenLabs: Conversation metadata:", message);
      }

      if (message?.type === "user_transcript") {
        console.log("ElevenLabs: User said:", message?.transcript);
      }

      if (message?.type === "agent_response") {
        console.log("ElevenLabs: Agent responded:", message);
      }
    },
    onError: (error) => {
      console.error("ElevenLabs: Conversation error:", error);

      // Reset UI states on error
      setIsListening(false);
      setConversationId(null);
      setAudioLevel(0); // Tắt hiệu ứng wave khi có lỗi

      // End call log on error
      if (callLogId) {
        console.log("ElevenLabs error, ending call log...");
        endCallLog("error");
      }

      // No toast notification for errors
    },
    onModeChange: (mode: any) => {
      console.log("ElevenLabs: Mode changed to:", mode);
    },
    onStatusChange: (status: any) => {
      console.log("🔥 ELEVENLABS STATUS CHANGE - callback triggered!");
      console.log("ElevenLabs: Status changed to:", status);
      console.log("🔄 Status change details:", {
        newStatus: status,
        currentIsListening: isListening,
        currentConversationId: conversationId,
        currentCallLogId: callLogId
      });
    },
  });

  const { status, isSpeaking } = conversation;

  // Simulate audio level animation when AI is speaking - slower and smoother
  useEffect(() => {
    let animationId: number;

    if (isSpeaking) {
      const animateAudioLevel = () => {
        // Generate realistic audio level simulation with slower, smoother changes
        const baseLevel = 0.4;
        const time = Date.now() * 0.003; // Much slower time progression

        // Create smoother voice-like audio pattern
        const level =
          baseLevel +
          Math.sin(time * 0.8) * 0.15 +
          Math.sin(time * 1.2) * 0.12 +
          Math.sin(time * 1.8) * 0.08 +
          Math.random() * 0.05; // Reduced randomness

        setAudioLevel(Math.max(0.1, Math.min(0.9, level)));
        animationId = requestAnimationFrame(animateAudioLevel);
      };

      animateAudioLevel();
    } else {
      setAudioLevel(0);
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isSpeaking]);

  // Request microphone access with noise filtering on component mount
  useEffect(() => {
    const requestMicrophoneAccess = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          if (noiseFilterEnabled && audioFiltersRef.current) {
            // Use filtered microphone with noise suppression
            console.log("🎤 Initializing microphone with noise filtering...");
            const filteredStream =
              await audioFiltersRef.current.getFilteredMicrophoneStream();
            console.log("🎤 Microphone access granted with noise filtering");

            // Set noise sensitivity based on environment
            audioFiltersRef.current.adjustNoiseSensitivity(noiseSensitivity);
          } else {
            // Basic microphone access with native noise suppression
            await navigator.mediaDevices.getUserMedia({
              audio: {
                noiseSuppression: true,
                echoCancellation: true,
              },
            });
            console.log("🎤 Basic microphone access granted");
          }
        } else {
          console.log("getUserMedia not available in this environment");
        }
      } catch (error) {
        console.log(
          "Microphone access not available:",
          (error as Error).message,
        );
      }
    };

    requestMicrophoneAccess();
  }, [noiseFilterEnabled, noiseSensitivity]);

  // Cleanup on unmount and handle page beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      console.log("Page unloading, ending active call...");
      if (callLogId && userId) {
        // Use navigator.sendBeacon for more reliable cleanup
        const data = JSON.stringify({
          callLogId,
          userId: userId,
          endReason: 'page_refresh'
        });
        
        // navigator.sendBeacon is more reliable for page unload
        navigator.sendBeacon('/api/call/end', data);
        console.log(`Sent beacon to end call ${callLogId} for user ${userId}`);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && callLogId) {
        console.log("Page hidden with active call, logging...");
        // Could implement background heartbeat here
      }
    };

    // Add event listeners
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      // Cleanup when component unmounts - but don't end active calls unnecessarily
      console.log("Component unmounting, cleaning up...");

      // Remove event listeners
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      // Don't automatically end calls or reset states on component unmount
      // This prevents stopping calls when components re-render
    };
  }, [callLogId, userId]); // Update when callLogId or userId changes

  // Monitor status changes and sync with isListening state
  useEffect(() => {
    if (status === "disconnected" && isListening) {
      console.log("Status disconnected, resetting listening state");
      stopLimitMonitoring();
      setIsListening(false);
      setConversationId(null);
      setAudioLevel(0); // Tắt hiệu ứng wave khi status disconnected
    }
  }, [status, isListening]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopLimitMonitoring();
    };
  }, []);

  const checkCallLimitsForUser = async (targetUserId: string) => {
    if (!targetUserId) {
      console.error("No user ID provided for call limits check");
      return false;
    }

    const response = await fetch("/api/call/check-limits", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: targetUserId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 429) {
        setCallLimitsInfo({
          ...data,
          error: true,
          errorMessage: data.message,
        });
        return false;
      }
      throw new Error(data.error || "Failed to check call limits");
    }

    setCallLimitsInfo(data);
    if (data.dailyUserLimit) {
      setDailyUserLimit(data.dailyUserLimit);
    }
    console.log("Call limits check passed:", data);
    return true;
  };

  const checkCallLimits = async () => {
    if (!userId) {
      console.error("No user data available for call limits check");
      return false;
    }

    return checkCallLimitsForUser(userId);
  };

  const checkActiveLimits = async (overrideCallLogId?: number, overrideStartTime?: Date) => {
    // Calculate call duration using immediate values or React state
    const now = Date.now();
    let currentDurationSeconds = 0;
    
    // Use override values if provided (for immediate state), otherwise use React state
    const activeCallLogId = overrideCallLogId || callLogId;
    const activeStartTime = overrideStartTime || callStartTime;
    
    if (activeStartTime) {
      const currentDurationMs = now - activeStartTime.getTime();
      currentDurationSeconds = Math.floor(currentDurationMs / 1000);
    }

    // Skip check if no active call state
    if (!userId) {
      console.log("⏰ checkActiveLimits skipped: no userId");
      return;
    }

    // CRITICAL: If we have active ElevenLabs session but no call logging, emergency stop
    if (isListening && status === "connected" && conversationId && !callLogId) {
      console.log("🚨 CRITICAL: Active session without call logging! Emergency stopping to prevent limit bypass...");
      
      // Force stop the conversation immediately to prevent limit bypass
      console.log("🛑 EMERGENCY: Force stopping conversation to prevent unlimited calling");
      if (conversation) {
        conversation.endSession();
      }
      setIsListening(false);
      setConversationId(null);
      return;
    }

    // CRITICAL FIX: Always run limit check if we have limitCheckInterval running
    // This prevents bypassing force-end when UI state is inconsistent
    console.log("⏰ checkActiveLimits proceeding - force-end safety check active regardless of UI state");

    // If we have partial state, continue with the check for safety
    if (!activeCallLogId || !activeStartTime) {
      console.log("⚠️ Partial call state detected - continuing with limit check for safety:", { 
        userId: !!userId, 
        callLogId: !!activeCallLogId, 
        callStartTime: !!activeStartTime,
        isListening,
        status,
        conversationId: !!conversationId,
        currentDuration: currentDurationSeconds > 0 ? `${currentDurationSeconds}s` : "unknown",
        usingOverrides: !!(overrideCallLogId || overrideStartTime)
      });
    }

    console.log(`⏰ checkActiveLimits running: user ${userId}, duration ${currentDurationSeconds}s (${Math.floor(currentDurationSeconds/60)}m ${currentDurationSeconds%60}s)`);

    try {
      const response = await fetch("/api/call/check-active-limits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userId,
          callLogId: activeCallLogId,
          currentDurationSeconds,
        }),
      });

      const data = await response.json();

      if (!response.ok && response.status === 429) {
        // Limit exceeded during call - force end immediately
        console.log("🚨 FORCE END: Call limit exceeded during active call:", data);

        // Force disconnect immediately
        setIsListening(false);
        setConversationId(null);
        setAudioLevel(0);

        // Clear the interval
        if (limitCheckInterval) {
          clearInterval(limitCheckInterval);
          setLimitCheckInterval(null);
        }

        // Stop ElevenLabs session immediately
        try {
          console.log("🛑 Force stopping ElevenLabs session due to limit exceeded");
          if (conversation) {
            await conversation.endSession();
          }
        } catch (error) {
          console.error("Error ending ElevenLabs session:", error);
        }

        // Update call limits info to show error with enhanced messaging
        setCallLimitsInfo({
          ...data,
          error: true,
          errorMessage: data.message || "Giới hạn thời gian gọi đã đạt",
          autoEnded: true,
          forceEnd: data.forceEnd || false,
          reason: data.reason,
        });

        // Clear call state since it's forcefully ended
        setCallLogId(null);
        setCallStartTime(null);
        
        // Stop monitoring intervals immediately
        if (limitCheckInterval) {
          clearInterval(limitCheckInterval);
          setLimitCheckInterval(null);
        }
        if (trackingIntervalRef.current) {
          clearInterval(trackingIntervalRef.current);
          trackingIntervalRef.current = null;
        }

        // Optionally show toast notification for user
        console.log(`🔚 Call force-ended: ${data.reason} - ${data.message}`);

        return false;
      }

      // Update current usage info and handle warnings
      if (response.ok) {
        setCallLimitsInfo({
          ...data,
          currentCallDuration: currentDurationSeconds,
        });
        
        // Handle warning messages for approaching limits
        if (data.warning) {
          console.log(`⚠️ Warning: ${data.warning.message}`, data.warning);
          
          // Show different warning types
          if (data.warning.type === 'user_limit_warning') {
            console.log(`🟡 User limit warning: ${data.warning.secondsRemaining}s remaining`);
          } else if (data.warning.type === 'system_limit_warning') {
            console.log(`🟡 System limit warning: ${data.warning.secondsRemaining}s remaining`);
          }
        }
      }

      return true;
    } catch (error) {
      console.error("Error checking active limits:", error);
      return true; // Continue call on error
    }
  };

  // Start periodic limit checking when call starts
  const startLimitMonitoring = () => {
    if (limitCheckInterval) {
      clearInterval(limitCheckInterval);
    }

    console.log("🔄 Starting limit monitoring - checking every 3 seconds");
    // Check every 3 seconds during active call for more aggressive limit enforcement
    const interval = setInterval(() => {
      // Log current call time for debugging
      if (callStartTime) {
        const elapsed = Math.floor((Date.now() - callStartTime.getTime()) / 1000);
        console.log(`📞 Call time: ${elapsed}s (${Math.floor(elapsed/60)}m ${elapsed%60}s)`);
      }
      checkActiveLimits();
    }, 3000);
    setLimitCheckInterval(interval);
  };

  // Start periodic limit checking with explicit start time
  const startLimitMonitoringWithTime = (startTime: Date, callLogId?: number) => {
    if (limitCheckInterval) {
      clearInterval(limitCheckInterval);
    }

    console.log("🔄 Starting limit monitoring with explicit time - checking every 1 second, startTime:", startTime, "callLogId:", callLogId);
    // Check every 1 second during active call for immediate feedback
    const interval = setInterval(async () => {
      // Continue monitoring as long as we have startTime - don't auto-stop
      // This ensures force-end logic can trigger even if UI state is inconsistent
      console.log("🔄 Limit check running - state:", { isListening, status, conversationId: !!conversationId });
      
      // Log current call time for debugging
      const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);
      console.log(`📞 Call time: ${elapsed}s (${Math.floor(elapsed/60)}m ${elapsed%60}s)`);
      await checkActiveLimits(callLogId, startTime);
    }, 1000);
    setLimitCheckInterval(interval);
  };

  // Stop limit monitoring
  const stopLimitMonitoring = () => {
    console.log("🛑 Stopping limit monitoring - clearing interval");
    if (limitCheckInterval) {
      clearInterval(limitCheckInterval);
      setLimitCheckInterval(null);
    }
    setCallStartTime(null);
  };

  // Toggle mute/unmute microphone
  const toggleMute = () => {
    console.log("🔘 MUTE BUTTON CLICKED!", {
      conversation: !!conversation,
      isMuted,
      status,
      isListening,
      conversationId,
      currentMicMuted: conversation?.micMuted
    });
    
    const newMutedState = !isMuted;
    
    // Update UI state - this will automatically pass to ElevenLabs via micMuted prop
    setIsMuted(newMutedState);
    
    if (newMutedState) {
      console.log("🔇 Microphone muted via ElevenLabs micMuted property");
    } else {
      console.log("🎤 Microphone unmuted via ElevenLabs micMuted property");
    }
    
    console.log("🔄 State updated - isMuted:", newMutedState);
  };

  const startCallLog = async (conversationId: string, startTime?: Date) => {
    console.log("🆔 startCallLog called with conversationId:", conversationId);
    console.log("🆔 startCallLog called with userId:", userId);
    
    if (!userId) {
      console.error("❌ CRITICAL: No userId available for call logging!");
      throw new Error("No user data available for call logging");
    }

    console.log("📡 Making API call to start call log...");
    const now = startTime || new Date();
    const response = await fetch("/api/call/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: userId,
        conversationId,
        elevenLabsStartTime: now.toISOString(),
      }),
    });

    console.log("📡 Response status:", response.status, response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Failed to start call log:", response.status, errorText);
      throw new Error("Failed to start call log");
    }

    const data = await response.json();
    console.log("✅ API response data:", data);
    
    console.log("🔧 CRITICAL DEBUG: About to set state - callLogId:", data.callLogId, "startTime:", now);
    
    // CRITICAL FIX: Ensure state is set immediately and logged
    const logId = data.callLogId;
    const callStartTimeValue = now;
    
    // CRITICAL FIX: Use callback-based state updates to ensure immediate availability
    setCallLogId(logId);
    setCallStartTime(callStartTimeValue);
    
    console.log("🔧 CRITICAL DEBUG: State set completed - callLogId:", logId, "callStartTime:", callStartTimeValue);
    console.log("🔧 VERIFICATION: callLogId state should now be truthy for limit monitoring");
    
    // Return the actual values for immediate use since React state is async
    const immediateState = {
      callLogId: logId,
      callStartTime: callStartTimeValue
    };
    console.log("🔧 IMMEDIATE STATE: Returning values for immediate use:", immediateState);
    console.log("Call log started with ElevenLabs sync:", data);
    console.log("🆔 Set callLogId:", data.callLogId, "callStartTime:", now);
    console.log("🆔 State should now have callLogId and callStartTime for monitoring");

    return { callLogId: logId, startTime: callStartTimeValue, immediateState };
  };

  const endCallLog = async (endReason = "user_stop") => {
    // Stop limit monitoring first
    stopLimitMonitoring();

    if (!callLogId) {
      console.log("No call log ID to end");
      return;
    }

    try {
      const response = await fetch("/api/call/end", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          callLogId,
          userId: userId,
          elevenLabsEndTime: new Date().toISOString(),
          endReason,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Call log ended with ElevenLabs sync:", data);

        // Refresh total minutes after call ends
        if (userId) {
          fetchUserTotalMinutes(userId);
        }

        // No toast notification for call ended
      }
    } catch (error) {
      console.error("Error ending call log:", error);
    } finally {
      setCallLogId(null);
    }
  };

  const fetchUserTotalMinutes = async (userIdToUse: string) => {
    try {
      const response = await fetch(`/api/user/${userIdToUse}/total-minutes`);
      const data = await response.json();

      if (response.ok) {
        setTotalMinutesUsed(data.formattedTime);
      }
    } catch (error) {
      console.error("Error fetching total minutes:", error);
    }
  };

  const verifyTokenAndGetUserData = async (tokenToVerify?: string) => {
    const tokenToUse = tokenToVerify || token;
    if (!tokenToUse) {
      throw new Error("No token available");
    }

    try {
      console.log("Verifying token...");

      const response = await fetch("/api/verify-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: tokenToUse }),
      });

      const data = await response.json();

      if (!response.ok || !data.valid) {
        throw new Error(data.message || "Token verification failed");
      }

      console.log("Token verified successfully:", data.userData);
      setUserData(data.userData);
      const userIdStr = data.userData.user_id?.toString() || "";
      setUserId(userIdStr);
      setTokenVerified(true);

      // Fetch total minutes used by this user
      if (userIdStr) {
        fetchUserTotalMinutes(userIdStr);
        
        // Check call limits to get current daily user limit from backend
        setTimeout(() => {
          if (userIdStr) {
            checkCallLimitsForUser(userIdStr);
          }
        }, 1000); // Increased delay to ensure userId is set
        
        // Check for orphaned calls after user verification (in case of refresh during call)
        setTimeout(async () => {
          try {
            console.log(`🔍 Checking for orphaned calls for user ${userIdStr} after token verification...`);
            const response = await fetch('/api/call/cleanup-orphaned', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ maxDurationMinutes: 0.5 }) // Very aggressive for fresh page loads
            });
            
            if (response.ok) {
              const data = await response.json();
              if (data.cleanedCount > 0) {
                console.log(`🧹 Cleaned up ${data.cleanedCount} orphaned calls after page refresh/reload`);
              }
            }
          } catch (error) {
            console.error('Error cleaning up orphaned calls after token verification:', error);
          }
        }, 2000); // Wait 2 seconds after token verification
      }

      return data.userData;
    } catch (error) {
      console.error("Error verifying token:", error);
      throw error;
    }
  };

  const generateSignedUrl = async () => {
    try {
      if (!userData || !userData.user_id) {
        throw new Error("User data not available");
      }

      console.log(
        "Getting signed URL for agent ID:",
        ELEVENLABS_CONFIG.voiceAgentId,
      );
      console.log("Using user_id:", userId);

      const queryString = `agent_id=${ELEVENLABS_CONFIG.voiceAgentId}&user_id=${userId}`;
      console.log("Final query string:", queryString);

      const response = await fetch(
        `/api/elevenlabs/signed-url?${queryString}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Backend error:", errorData);
        throw new Error(errorData.error || "Failed to get signed URL");
      }

      const data = await response.json();
      console.log("Signed URL received:", data);

      // Store user data from response
      if (data.userData) {
        setUserData(data.userData);
        setUserId(data.userData.user_id?.toString() || "");
        setTokenVerified(true);
      }

      return data.signed_url;
    } catch (error) {
      console.error("Error generating signed URL:", error);
      throw error;
    }
  };

  const forceStopConversation = () => {
    // Clear any existing timeout
    if (stopTimeout) {
      clearTimeout(stopTimeout);
      setStopTimeout(null);
    }

    // Reset states immediately - don't wait for async operations
    setIsListening(false);
    setConversationId(null);
    setAudioLevel(0); // Tắt hiệu ứng wave khi force stop
    setIsMuted(false); // Reset mute state when force stopping

    // Try to end session in background without blocking UI
    try {
      conversation.endSession().catch((error) => {
        console.error("Background session end error:", error);
      });
    } catch (error) {
      console.error("Error calling endSession:", error);
    }
  };

  // Start real-time usage tracking
  const startUsageTracking = () => {
    console.log("📊 Starting real-time usage tracking...");
    setCurrentCallDuration(0);
    
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
    }
    
    trackingIntervalRef.current = setInterval(() => {
      if (callStartTime) {
        const currentDuration = Math.floor((Date.now() - callStartTime.getTime()) / 1000);
        setCurrentCallDuration(currentDuration);
        console.log(`📊 [Usage Tracking] Call time: ${currentDuration}s (${Math.floor(currentDuration / 60)}m ${currentDuration % 60}s)`);
        
        // Check if approaching user limit
        if (currentDuration % 15 === 0) { // Every 15 seconds
          console.log(`⏰ Usage check: ${currentDuration}s used, daily limit: ${dailyUserLimit * 60}s`);
        }
      }
    }, 3000); // Every 3 seconds
  };

  // Start real-time usage tracking with explicit start time
  const startUsageTrackingWithTime = (startTime: Date) => {
    console.log("📊 Starting real-time usage tracking with explicit time, startTime:", startTime);
    setCurrentCallDuration(0);
    
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
    }
    
    trackingIntervalRef.current = setInterval(() => {
      const currentDuration = Math.floor((Date.now() - startTime.getTime()) / 1000);
      setCurrentCallDuration(currentDuration);
      console.log(`📊 [Usage Tracking] Call time: ${currentDuration}s (${Math.floor(currentDuration / 60)}m ${currentDuration % 60}s)`);
      
      // Check if approaching user limit
      if (currentDuration % 15 === 0) { // Every 15 seconds
        console.log(`⏰ Usage check: ${currentDuration}s used, daily limit: ${dailyUserLimit * 60}s`);
      }
    }, 3000); // Every 3 seconds
  };

  // Stop usage tracking
  const stopUsageTracking = () => {
    console.log("📊 Stopping real-time usage tracking...");
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }
    setCurrentCallDuration(0);
  };

  const toggleListening = async () => {
    console.log("🔘 CRITICAL DEBUG: Toggle listening function called - entry point");
    console.log(
      "🔘 CRITICAL DEBUG: Toggle listening called - isListening:",
      isListening,
      "status:",
      status,
      "isSpeaking:",
      isSpeaking,
    );
    console.log("🔘 CRITICAL DEBUG: conversationId:", conversationId);
    console.log("🔘 CRITICAL DEBUG: isProcessing:", isProcessing);
    console.log("🔘 CRITICAL DEBUG: ElevenLabs conversation status:", conversation?.status);
    console.log("🔘 CRITICAL DEBUG: Will go to STOP branch if:", isListening || conversationId, "(isListening OR conversationId)");

    // Prevent concurrent operations
    if (isProcessing) {
      console.log("🚫 Operation already in progress, ignoring click");
      return;
    }

    console.log("🔘 Setting isProcessing to true");
    setIsProcessing(true);

    // If currently listening/connected, stop it
    if (isListening || conversationId) {
      console.log("🛑 Stopping conversation - forcing disconnect");

      // Reset UI state IMMEDIATELY when user clicks stop
      setIsListening(false);
      setConversationId(null);
      setAudioLevel(0); // Tắt hiệu ứng wave ngay lập tức
      setIsMuted(false); // Reset mute state

      try {
        // Stop all tracking first
        stopUsageTracking();
        stopLimitMonitoring();
        
        // End call logging
        await endCallLog("user_stop");

        // Force end ElevenLabs session
        await conversation.endSession();
        console.log("ElevenLabs session ended successfully");
      } catch (error) {
        console.error("Error stopping conversation:", error);
      } finally {
        setIsProcessing(false);
      }

      return;
    }

    console.log("🔍 CRITICAL: About to start conversation section");
    
    // Start conversation
    try {
      console.log("🚀 Starting conversation process...");

      // Check if token is verified
      if (!tokenVerified || !userData) {
        throw new Error(
          "Token not verified yet. Please wait for app initialization.",
        );
      }

      console.log("🔑 Using verified user data:", userData);

      // Run limits check and signed URL generation in parallel
      const [limitsOk, signedUrl] = await Promise.all([
        checkCallLimits(),
        generateSignedUrl(),
      ]);

      if (!limitsOk) {
        console.log("Call limits exceeded");
        setIsProcessing(false);
        return;
      }

      // Create session options with user data as dynamic variables
      const sessionOptions: any = {
        signedUrl: signedUrl,
        dynamicVariables: {
          userid: userData.user_id,
          userId: userData.user_id,
          user_email: userData.user_email,
          user_name: userData.user_name,
          token_valid: userData.token_valid,
          limit_call_duration_per_day: userData.limit_call_duration_per_day,
          called_duration_per_day: userData.called_duration_per_day,
          TOTAL_CALL_DURATION_PER_DAY: userData.TOTAL_CALL_DURATION_PER_DAY,
          greeting_message: userData.greeting_message,
          env: userData.env,
          language: language,
        },
        overrides: {
          agent: {
            firstMessage: currentContent.firstMessage,
          },
        },
      };

      console.log("Starting ElevenLabs session...");
      console.log("Session options:", JSON.stringify(sessionOptions, null, 2));
      
      console.log("🔍 DEBUG: About to call conversation.startSession");
      const newConversationId = await conversation.startSession(sessionOptions);
      console.log("🔍 DEBUG: startSession completed, returned:", newConversationId);
      console.log("ElevenLabs startSession returned:", newConversationId);

      console.log("Conversation started with ID:", newConversationId);
      console.log("📍 Checkpoint 1: ElevenLabs session started successfully");
      console.log("📍 Checkpoint 1.5: About to proceed to call logging section");

      // CRITICAL: Start call logging BEFORE setting UI states to ensure monitoring starts immediately
      console.log("🚧 BEFORE startCallLog - newConversationId:", newConversationId);
      console.log("🚧 BEFORE startCallLog - userId:", userId);
      console.log("🚧 BEFORE startCallLog - userData:", userData);
      
      try {
        console.log("🚀 About to start call logging for conversation:", newConversationId);
        console.log("🚀 Current userId for logging:", userId);
        console.log("🚀 Starting conversation process");
        
        // Create start time here to use consistently
        const callStartNow = new Date();
        console.log("🕐 Call start time:", callStartNow);
        
        // Force immediate call logging execution with consistent time
        console.log("🚀 CRITICAL DEBUG: About to call startCallLog with:", { newConversationId, callStartNow });
        const callLogResult = await startCallLog(newConversationId, callStartNow);
        console.log("✅ CRITICAL DEBUG: Call logging completed successfully, result:", callLogResult);
        console.log("✅ CRITICAL DEBUG: callLogId should now be set, callStartTime should be initialized");
        
        // Use immediate state values for tracking instead of React state
        const { immediateState } = callLogResult;
        console.log("🔄 CRITICAL DEBUG: Using immediate state for tracking:", immediateState);
        
        // Start both tracking systems with immediate state values
        console.log("🔄 CRITICAL DEBUG: Starting usage tracking with immediate state");
        startUsageTrackingWithTime(immediateState.callStartTime);
        console.log("🔄 CRITICAL DEBUG: Usage tracking started with immediate state");
        
        console.log("🔄 CRITICAL DEBUG: Starting limit monitoring with immediate state");
        startLimitMonitoringWithTime(immediateState.callStartTime, immediateState.callLogId);
        console.log("🔄 CRITICAL DEBUG: Limit monitoring started with immediate state");
        console.log("🎯 CRITICAL DEBUG: Both tracking systems running with immediate values!");
      } catch (error) {
        console.error("❌ CRITICAL: Call logging failed:", error);
        console.error("❌ Error details:", error);
        console.error("❌ Error stack:", error instanceof Error ? error.stack : 'No stack');
        console.error("❌ Error message:", error instanceof Error ? error.message : 'Unknown error');
        console.error("❌ Error type:", typeof error);
        console.error("❌ Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
        
        // Don't throw error, continue but log the issue
        console.warn("⚠️ Continuing without call logging - this will break limit monitoring!");
        
        // Force fallback tracking to at least see logs
        console.log("🔄 FALLBACK: Starting tracking without call log");
        const fallbackStartTime = new Date();
        startUsageTrackingWithTime(fallbackStartTime);
        startLimitMonitoringWithTime(fallbackStartTime);
      }

      // Set states after call logging is set up
      setConversationId(newConversationId);
      setIsListening(true);
      setIsMuted(false); // Reset mute state for new conversation
      console.log("📍 Checkpoint 3: Set isListening to true after startSession and call logging");
      console.log("📍 Checkpoint 3: callLogId =", callLogId, "callStartTime =", callStartTime);
      console.log("🎉 CONVERSATION STARTED! Should see 3-second logs now...");
      
      // 🔥 DIRECT FIX: Start tracking immediately after conversation setup
      // Don't wait for onConnect callback since it's not reliable
      console.log("🚀 DIRECT: Starting tracking functions immediately...");
      if (callLogId && callStartTime) {
        console.log("🚀 DIRECT: Starting with logged time:", callStartTime);
        startUsageTrackingWithTime(callStartTime);
        startLimitMonitoringWithTime(callStartTime);
        console.log("🎯 DIRECT: Tracking started successfully!");
      } else {
        // Fallback with current time
        const directTime = new Date();
        console.log("🔄 DIRECT: Using current time for tracking:", directTime);
        startUsageTrackingWithTime(directTime);
        startLimitMonitoringWithTime(directTime);
        console.log("🔄 DIRECT: Fallback tracking started!");
      }
    } catch (error) {
      console.error("Error starting conversation:", error);

      // Reset state on error
      setIsListening(false);
      setConversationId(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // Get current language content
  const currentContent =
    LANGUAGE_CONTENT[language as keyof typeof LANGUAGE_CONTENT] ||
    LANGUAGE_CONTENT.vi;

  // Show error message if no token
  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
              {currentContent.tokenRequired}
            </h2>
            <p className="text-red-600 dark:text-red-300">
              {currentContent.tokenRequiredMessage}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-8 px-4">
      <div className="w-full max-w-2xl">
        {/* Avatar positioned */}
        <div className="flex justify-center mb-6">
          <VoiceAvatar
            isListening={isListening}
            isSpeaking={isSpeaking}
            onToggleListening={toggleListening}
            status={status}
            audioLevel={audioLevel}
            isProcessing={isProcessing}
            statusLabels={currentContent}
          />
        </div>

        {/* Debug logs for button visibility */}
        {(() => {
          console.log("🔍 Mute button visibility check:", {
            status,
            isListening, 
            conversationId,
            limitCheckInterval: !!limitCheckInterval,
            trackingInterval: !!trackingIntervalRef.current,
            shouldShow: (status === "connected" || isListening || conversationId || limitCheckInterval || trackingIntervalRef.current)
          });
          return null;
        })()}
        
        {/* Mute/Unmute Button - show when any conversation activity */}
        {(status === "connected" || isListening || conversationId || limitCheckInterval || trackingIntervalRef.current) && (
          <div className="flex justify-center mb-4 relative z-10">
            <button
              onClick={() => {
                console.log("🔘 BUTTON CLICK EVENT TRIGGERED!");
                toggleMute();
              }}
              onMouseDown={() => console.log("🔘 MOUSE DOWN EVENT")}
              onMouseUp={() => console.log("🔘 MOUSE UP EVENT")}
              type="button"
              style={{ pointerEvents: 'auto', zIndex: 999 }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all cursor-pointer relative ${
                isMuted
                  ? "bg-red-100 text-red-800 border border-red-300 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700"
                  : "bg-green-100 text-green-800 border border-green-300 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700"
              }`}
            >
              {isMuted ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.82L4.821 14H3a1 1 0 01-1-1V7a1 1 0 011-1h1.821l3.562-2.82a1 1 0 011.617.82zM2.828 2.828a1 1 0 011.415 0L17.657 16.243a1 1 0 01-1.414 1.414L2.828 4.243a1 1 0 010-1.415z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                </svg>
              )}
              {isMuted ? "Mở tiếng" : "Tắt tiếng"}
              {(() => {
                console.log("🔍 Button render - isMuted:", isMuted, "text:", isMuted ? "Mở tiếng" : "Tắt tiếng");
                return null;
              })()}
            </button>
          </div>
        )}

        {/* Noise Filter Controls */}
        <div className="flex justify-center mb-4 hidden">
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setNoiseFilterEnabled(!noiseFilterEnabled)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                  noiseFilterEnabled
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                }`}
              >
                <svg
                  className="w-3 h-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.82L4.821 14H3a1 1 0 01-1-1V7a1 1 0 011-1h1.821l3.562-2.82a1 1 0 011.617.82zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 11-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.983 5.983 0 01-1.757 4.243 1 1 0 01-1.415-1.414A3.983 3.983 0 0013 10a3.983 3.983 0 00-1.172-2.829 1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
                {noiseFilterEnabled ? "Lọc tiếng ồn: BẬT" : "Lọc tiếng ồn: TẮT"}
              </button>
            </div>

            {noiseFilterEnabled && (
              <select
                value={noiseSensitivity}
                onChange={(e) =>
                  setNoiseSensitivity(
                    e.target.value as "low" | "medium" | "high",
                  )
                }
                className="px-2 py-1 text-xs rounded border bg-background"
              >
                <option value="low">Nhẹ (môi trường yên tĩnh)</option>
                <option value="medium">Vừa (môi trường bình thường)</option>
                <option value="high">Mạnh (siêu thị, nơi ồn)</option>
              </select>
            )}
          </div>
        </div>

        {/* Real-time Call Duration Display - Hidden per user request */}
        {false && isListening && currentCallDuration > 0 && (
          <div className="flex justify-center mb-4">
            <div className="px-3 py-1 text-xs rounded border bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700">
              Thời gian gọi: {Math.floor(currentCallDuration / 60)}m {currentCallDuration % 60}s
            </div>
          </div>
        )}

        {/* Info Button below controls */}
        <div className="flex justify-center">
          <InfoModal content={currentContent} />
        </div>
      </div>

      {/* Total minutes used - positioned at bottom left */}
      {userId && (
        <div className="fixed bottom-4 left-4 z-40">
          <div className="text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded border">
            Tổng gọi hôm nay: {totalMinutesUsed} / {dailyUserLimit} phút
          </div>
        </div>
      )}

      {/* Warning notification - positioned at bottom center when active */}
      {callLimitsInfo && callLimitsInfo.warning && (
        <div className="fixed bottom-16 left-4 right-4 z-50 md:bottom-20 md:max-w-md md:mx-auto">
          <div className={`p-3 rounded-lg border backdrop-blur-sm text-center ${
            callLimitsInfo.warning.type === 'user_limit_warning' 
              ? 'bg-orange-50/90 border-orange-200 text-orange-800 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-200'
              : 'bg-yellow-50/90 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200'
          }`}>
            <p className="text-sm font-medium">⚠️ {callLimitsInfo.warning.message}</p>
          </div>
        </div>
      )}

      {/* Call limits info - positioned at bottom for mobile, inline for desktop - only show errors */}
      {callLimitsInfo && callLimitsInfo.error && (
        <div className="fixed bottom-4 left-4 right-4 z-50 md:relative md:bottom-auto md:left-auto md:right-auto md:mt-4 md:max-w-md md:mx-auto p-3 rounded-lg border backdrop-blur-sm bg-destructive/10 border-destructive/20 text-destructive">
          <p className="text-sm font-medium">{currentContent.callLimitError}</p>
          <div className="text-xs mt-1">{callLimitsInfo.errorMessage}</div>
        </div>
      )}
    </div>
  );
};

export default VoiceAgent;
