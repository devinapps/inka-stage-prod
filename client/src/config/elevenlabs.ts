// ElevenLabs configuration
export const ELEVENLABS_CONFIG = {
  voiceAgentId:
    import.meta.env.VITE_ELEVENLABS_AGENT_ID ||
    "agent_01k09aphp2ep79jav963b4cr1c",
  // API endpoint for signed URL generation
  baseUrl: "https://api.elevenlabs.io/v1/convai/conversation",
} as const;
