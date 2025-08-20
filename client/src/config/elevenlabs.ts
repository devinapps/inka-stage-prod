// ElevenLabs configuration
export const ELEVENLABS_CONFIG = {
  voiceAgentId: import.meta.env.VITE_ELEVENLABS_AGENT_ID || 'agent_6901k23r8bv7em3td68g3gey5w7q',
  // API endpoint for signed URL generation
  baseUrl: 'https://api.elevenlabs.io/v1/convai/conversation'
} as const;