import { useState, useEffect, useRef } from "react";
import { useConversation } from "@elevenlabs/react";
import { toast } from "@/hooks/use-toast";
import { ELEVENLABS_CONFIG } from "@/config/elevenlabs";
import VoiceAvatar from "./VoiceAvatar";
import InfoModal from "./InfoModal";
import AudioFilters from "@/utils/audioFilters";
import { webrtcFilters, type NoiseFilterLevel } from "@/utils/webrtcFilters";

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
      "Em chào anh {{user_name}}, em là INKA - một trợ lý cá nhân của anh. Anh muốn em giúp gì trong hôm nay?",
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
  const [noiseSensitivity, setNoiseSensitivity] =
    useState<NoiseFilterLevel>("medium");
  const audioFiltersRef = useRef<AudioFilters | null>(null);
  const [useWebRTC, setUseWebRTC] = useState(true); // Enable WebRTC by default

  // Extract token and language from URL on component mount
  const [token, setToken] = useState<string>("");
  const [userData, setUserData] = useState<any>(null);
  const [userId, setUserId] = useState<string>("");
  const [tokenVerified, setTokenVerified] = useState<boolean>(false);
  const [language, setLanguage] = useState<string>("vi"); // Default to Vietnamese

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
      // Cleanup WebRTC filters
      webrtcFilters.cleanup();
    };
  }, []);

  const conversation = useConversation({
    onConnect: () => {
      console.log("ElevenLabs: Connected to voice agent");
      // Set listening to true only when ElevenLabs is actually connected
      setIsListening(true);
      // No toast notification for connection
    },
    onDisconnect: () => {
      console.log("ElevenLabs: Disconnected from voice agent");

      // Stop limit monitoring
      stopLimitMonitoring();

      // Reset UI states on disconnect
      setIsListening(false);
      setConversationId(null);
      setAudioLevel(0); // Tắt hiệu ứng wave khi disconnect

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
      console.log("ElevenLabs: Status changed to:", status);
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

  // Request microphone access with WebRTC noise filtering on component mount
  useEffect(() => {
    const requestMicrophoneAccess = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          if (noiseFilterEnabled) {
            if (useWebRTC) {
              // Use WebRTC advanced filtering system
              console.log(
                "🎤 Initializing microphone with WebRTC noise filtering...",
              );
              const webrtcStream =
                await webrtcFilters.getOptimizedStream(noiseSensitivity);
              console.log("🎤 Microphone access granted with WebRTC filtering");

              // Log WebRTC audio metrics
              const metrics = await webrtcFilters.getAudioMetrics();
              console.log("🎛️ WebRTC audio metrics:", metrics);
            } else if (audioFiltersRef.current) {
              // Fallback to legacy audio filters
              console.log(
                "🎤 Initializing microphone with legacy noise filtering...",
              );
              const filteredStream =
                await audioFiltersRef.current.getFilteredMicrophoneStream();
              console.log("🎤 Microphone access granted with legacy filtering");

              // Set noise sensitivity based on environment (cast for legacy compatibility)
              audioFiltersRef.current.adjustNoiseSensitivity(
                noiseSensitivity === "aggressive"
                  ? "high"
                  : (noiseSensitivity as "low" | "medium" | "high"),
              );
            }
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
  }, [noiseFilterEnabled, noiseSensitivity, useWebRTC]);

  // Cleanup on unmount and handle page beforeunload
  useEffect(() => {
    const handleBeforeUnload = async () => {
      console.log("Page unloading, ending active call...");
      if (callLogId) {
        // Try to end call log before page unloads
        try {
          await fetch("/api/call/end", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              callLogId,
              userId: userData?.user_id?.toString() || "",
            }),
            keepalive: true, // Important for requests during page unload
          });
        } catch (error) {
          console.error("Error ending call on page unload:", error);
        }
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
  }, []); // Only run once on mount

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

  const checkCallLimits = async () => {
    if (!userId) {
      console.error("No user data available for call limits check");
      return false;
    }

    const response = await fetch("/api/call/check-limits", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: userId,
        // Không cần truyền userData nữa vì dùng fixed limits
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 429) {
        // Limits exceeded - show info in callLimitsInfo instead of toast
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
    console.log("Call limits check passed:", data);
    return true;
  };

  const checkActiveLimits = async () => {
    if (!userId || !callLogId || !callStartTime) {
      return;
    }

    // Calculate current call duration
    const currentDurationMs = Date.now() - callStartTime.getTime();
    const currentDurationSeconds = Math.floor(currentDurationMs / 1000);

    try {
      const response = await fetch("/api/call/check-active-limits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userId,
          callLogId,
          currentDurationSeconds,
        }),
      });

      const data = await response.json();

      if (!response.ok && response.status === 429) {
        // Limit exceeded during call
        console.log("🚨 Call limit exceeded during active call:", data);

        // Force disconnect immediately
        setIsListening(false);
        setConversationId(null);
        setAudioLevel(0);

        // Clear the interval
        if (limitCheckInterval) {
          clearInterval(limitCheckInterval);
          setLimitCheckInterval(null);
        }

        // Stop ElevenLabs session
        try {
          await conversation.endSession();
        } catch (error) {
          console.error("Error ending ElevenLabs session:", error);
        }

        // Update call limits info to show error
        setCallLimitsInfo({
          ...data,
          error: true,
          errorMessage: data.message,
          autoEnded: true,
        });

        // Clear call log ID since it's already ended by backend
        setCallLogId(null);
        setCallStartTime(null);

        return false;
      }

      // Update current usage info
      if (response.ok) {
        setCallLimitsInfo({
          ...data,
          currentCallDuration: currentDurationSeconds,
        });
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

    // Check every 10 seconds during active call
    const interval = setInterval(checkActiveLimits, 10000);
    setLimitCheckInterval(interval);
  };

  // Stop limit monitoring
  const stopLimitMonitoring = () => {
    if (limitCheckInterval) {
      clearInterval(limitCheckInterval);
      setLimitCheckInterval(null);
    }
    setCallStartTime(null);
  };

  const startCallLog = async (conversationId: string) => {
    if (!userId) {
      throw new Error("No user data available for call logging");
    }

    const now = new Date();
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

    if (!response.ok) {
      throw new Error("Failed to start call log");
    }

    const data = await response.json();
    setCallLogId(data.callLogId);
    setCallStartTime(now);
    console.log("Call log started with ElevenLabs sync:", data);

    // Start monitoring limits during call
    startLimitMonitoring();

    return data.callLogId;
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
        // No toast notification for call ended
      }
    } catch (error) {
      console.error("Error ending call log:", error);
    } finally {
      setCallLogId(null);
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
      setUserId(data.userData.user_id?.toString() || "");
      setTokenVerified(true);
      return data.userData;
    } catch (error) {
      console.error("Error verifying token:", error);
      throw error;
    }
  };

  const generateSignedUrl = async () => {
    try {
      // Use current userData or fallback
      const currentUserData = userData || {
        user_id: parseInt(userId) || 269,
        user_email: "test@example.com",
        user_name: "Test User",
      };

      const currentUserId =
        userId || currentUserData.user_id?.toString() || "269";

      console.log(
        "Getting signed URL for agent ID:",
        ELEVENLABS_CONFIG.voiceAgentId,
      );
      console.log("Using user_id:", currentUserId);

      const queryString = `agent_id=${ELEVENLABS_CONFIG.voiceAgentId}&user_id=${currentUserId}`;
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

    // Try to end session in background without blocking UI
    try {
      conversation.endSession().catch((error) => {
        console.error("Background session end error:", error);
      });
    } catch (error) {
      console.error("Error calling endSession:", error);
    }
  };

  const toggleListening = async () => {
    console.log(
      "Toggle listening called - isListening:",
      isListening,
      "status:",
      status,
      "isSpeaking:",
      isSpeaking,
    );

    // Prevent concurrent operations
    if (isProcessing) {
      console.log("Operation already in progress, ignoring click");
      return;
    }

    setIsProcessing(true);

    // If currently listening/connected, stop it
    if (isListening || conversationId) {
      console.log("Stopping conversation - forcing disconnect");

      // Reset UI state IMMEDIATELY when user clicks stop
      setIsListening(false);
      setConversationId(null);
      setAudioLevel(0); // Tắt hiệu ứng wave ngay lập tức

      try {
        // End call logging first
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

    // Start conversation
    try {
      console.log("Starting conversation process...");

      // Check if token is verified, or use fallback for testing
      if (!tokenVerified || !userData) {
        console.log("Token not verified, using fallback user data for testing");
        const fallbackUserData = {
          user_id: parseInt(userId) || 269,
          user_email: "test@example.com",
          user_name: "Test User",
          token_valid: true,
          limit_call_duration_per_day: 15,
          called_duration_per_day: 0,
          TOTAL_CALL_DURATION_PER_DAY: "120",
          env: "testing",
        };
        setUserData(fallbackUserData);
        setUserId(fallbackUserData.user_id.toString());
        console.log("Using fallback user data:", fallbackUserData);
      }

      console.log("Using user data:", userData || "fallback data");

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
      const currentUserData = userData || {
        user_id: parseInt(userId) || 269,
        user_email: "test@example.com",
        user_name: "Test User",
        token_valid: false,
        limit_call_duration_per_day: 15,
        called_duration_per_day: 0,
        TOTAL_CALL_DURATION_PER_DAY: "120",
        env: "testing",
      };

      const sessionOptions: any = {
        signedUrl: signedUrl,
        agentId: ELEVENLABS_CONFIG.voiceAgentId,
        connectionType: "webrtc", // Enable WebRTC connection for ElevenLabs
        dynamicVariables: {
          userid: currentUserData.user_id,
          userId: currentUserData.user_id,
          user_email: currentUserData.user_email,
          user_name: currentUserData.user_name,
          token_valid: currentUserData.token_valid,
          limit_call_duration_per_day:
            currentUserData.limit_call_duration_per_day,
          called_duration_per_day: currentUserData.called_duration_per_day,
          TOTAL_CALL_DURATION_PER_DAY:
            currentUserData.TOTAL_CALL_DURATION_PER_DAY,
          env: currentUserData.env,
          language: language,
          token: token,
        },
        overrides: {
          agent: {
            firstMessage: currentContent.firstMessage,
          },
        },
      };
      console.log("Using token:", token);
      console.log("Agent ID:", ELEVENLABS_CONFIG.voiceAgentId);
      console.log("Using language:", language);
      console.log("Using first message override:", currentContent.firstMessage);
      console.log("Session options:", JSON.stringify(sessionOptions, null, 2));
      console.log("Starting ElevenLabs session...");
      const newConversationId = await conversation.startSession(sessionOptions);

      console.log("Conversation started with ID:", newConversationId);

      // Set states immediately - don't wait for onConnect callback
      setConversationId(newConversationId);
      setIsListening(true);
      console.log("Set isListening to true after startSession");

      // Start call logging in background
      startCallLog(newConversationId).catch((e) =>
        console.error("Call logging error (non-blocking):", e),
      );
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
    <div className="flex flex-col items-center justify-start min-h-screen p-4 pt-32">
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

        {/* Noise Filter Controls */}
        <div className="flex justify-center mb-4">
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
              <>
                {/* WebRTC Toggle */}
                <button
                  onClick={() => setUseWebRTC(!useWebRTC)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                    useWebRTC
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                >
                  {useWebRTC ? "WebRTC: BẬT" : "WebRTC: TẮT"}
                </button>

                {/* Noise Sensitivity Levels */}
                <select
                  value={noiseSensitivity}
                  onChange={(e) =>
                    setNoiseSensitivity(e.target.value as NoiseFilterLevel)
                  }
                  className="px-2 py-1 text-xs rounded border bg-background"
                >
                  <option value="low">Nhẹ (yên tĩnh)</option>
                  <option value="medium">Vừa (bình thường)</option>
                  <option value="high">Mạnh (ồn ào)</option>
                  {useWebRTC && (
                    <option value="aggressive">Tối đa (cực ồn)</option>
                  )}
                </select>
              </>
            )}
          </div>
        </div>

        {/* Info Button below controls */}
        <div className="flex justify-center">
          <InfoModal content={currentContent} />
        </div>
      </div>

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
