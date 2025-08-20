import { useState, useCallback, useRef } from 'react';

interface SpeechSynthesisOptions {
  voice?: SpeechSynthesisVoice | null;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export const useSpeechSynthesis = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load available voices
  const loadVoices = useCallback(() => {
    const availableVoices = speechSynthesis.getVoices();
    setVoices(availableVoices);
    return availableVoices;
  }, []);

  // Speak text with options
  const speak = useCallback((
    text: string, 
    options: SpeechSynthesisOptions = {}
  ) => {
    if (!text.trim()) return;

    // Cancel any ongoing speech
    speechSynthesis.cancel();

    // Small delay to ensure cancellation is processed
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;

      // Set voice options
      const availableVoices = voices.length > 0 ? voices : speechSynthesis.getVoices();
      
      // Try to find a good English voice for better AI assistant feel
      const preferredVoice = availableVoices.find(voice => 
        voice.lang.includes('en') && voice.name.toLowerCase().includes('female')
      ) || availableVoices.find(voice => 
        voice.lang.includes('en') && (
          voice.name.toLowerCase().includes('samantha') ||
          voice.name.toLowerCase().includes('karen') ||
          voice.name.toLowerCase().includes('victoria') ||
          voice.name.toLowerCase().includes('allison')
        )
      ) || availableVoices.find(voice => voice.lang.startsWith('en'));

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.rate = options.rate || 0.9;
      utterance.pitch = options.pitch || 1.0;
      utterance.volume = options.volume || 0.8;

      // Event handlers
      utterance.onstart = () => {
        console.log('Speech synthesis started');
        setIsSpeaking(true);
      };

      utterance.onend = () => {
        console.log('Speech synthesis ended');
        setIsSpeaking(false);
        utteranceRef.current = null;
      };

      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        setIsSpeaking(false);
        utteranceRef.current = null;
      };

      // Start speaking
      console.log('Starting speech synthesis with text:', text);
      speechSynthesis.speak(utterance);
    }, 100);
  }, [voices]);

  // Stop speaking
  const stop = useCallback(() => {
    speechSynthesis.cancel();
    setIsSpeaking(false);
    utteranceRef.current = null;
  }, []);

  // Pause speaking
  const pause = useCallback(() => {
    if (speechSynthesis.speaking && !speechSynthesis.paused) {
      speechSynthesis.pause();
    }
  }, []);

  // Resume speaking
  const resume = useCallback(() => {
    if (speechSynthesis.paused) {
      speechSynthesis.resume();
    }
  }, []);

  return {
    speak,
    stop,
    pause,
    resume,
    isSpeaking,
    voices,
    loadVoices,
    isSupported: 'speechSynthesis' in window
  };
};