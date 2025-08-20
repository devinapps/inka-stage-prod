import { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';
import VoiceAvatar from './VoiceAvatar';

const DemoVoiceAgent = () => {
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState<'connected' | 'disconnected'>('disconnected');
  
  const { speak, stop, isSpeaking, isSupported, loadVoices } = useSpeechSynthesis();

  // Sample AI responses for demo
  const aiResponses = [
    "Hello! I'm your AI voice assistant. How can I help you today?",
    "I understand you're looking for assistance. What would you like to know?",
    "That's an interesting question. Let me think about that for you.",
    "I'm here to help with any questions or tasks you might have.",
    "Thank you for using the voice AI assistant. Is there anything else I can help you with?",
    "I appreciate you testing the voice functionality. Everything seems to be working well!",
    "Great! The voice synthesis is working perfectly. What else would you like to try?"
  ];

  // Initialize speech synthesis
  useEffect(() => {
    loadVoices();
    
    // Load voices when they become available
    const handleVoicesChanged = () => {
      loadVoices();
    };
    
    speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
    
    return () => {
      speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
    };
  }, [loadVoices]);

  // Simulate microphone permission request
  useEffect(() => {
    const requestMicrophoneAccess = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        
        if (isSupported) {
          toast({
            title: "Voice Ready",
            description: "Microphone and voice synthesis are ready!",
          });
        } else {
          toast({
            title: "Limited Support",
            description: "Voice synthesis not supported in this browser.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Microphone access denied:', error);
        toast({
          title: "Microphone Access Required",
          description: "Please allow microphone access to use voice features.",
          variant: "destructive",
        });
      }
    };

    requestMicrophoneAccess();
  }, [isSupported]);

  const toggleListening = async () => {
    try {
      if (!isListening) {
        // Stop any ongoing speech first
        stop();
        
        // Check if speech synthesis is supported
        if (!isSupported) {
          toast({
            title: "Voice Not Supported",
            description: "Speech synthesis is not supported in this browser.",
            variant: "destructive",
          });
          return;
        }
        
        // Simulate connection
        setStatus('connected');
        setIsListening(true);
        
        toast({
          title: "Listening...",
          description: "Speak now, AI will respond in a moment!",
        });

        // Simulate listening period (3 seconds)
        setTimeout(() => {
          setIsListening(false);
          
          // Get a random AI response
          const randomResponse = aiResponses[Math.floor(Math.random() * aiResponses.length)];
          
          // Debug log
          console.log('About to speak:', randomResponse);
          
          // Speak the AI response with a slight delay
          setTimeout(() => {
            speak(randomResponse, {
              rate: 0.9,
              pitch: 1.0,
              volume: 0.8
            });
            
            toast({
              title: "AI Responding",
              description: "Listen to the voice response!",
            });
          }, 500);
        }, 3000);

      } else {
        // End simulation
        stop(); // Stop any ongoing speech
        setStatus('disconnected');
        setIsListening(false);
        
        toast({
          title: "Stopped",
          description: "Voice interaction ended.",
        });
      }
    } catch (error) {
      console.error('Error in demo:', error);
      toast({
        title: "Demo Error",
        description: "Something went wrong with the demo.",
        variant: "destructive",
      });
      setIsListening(false);
      setStatus('disconnected');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <VoiceAvatar
          isListening={isListening}
          isSpeaking={isSpeaking}
          onToggleListening={toggleListening}
          status={status}
        />
        
        {/* Instructions */}
        <div className="mt-8 text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">
            <span className="font-bold text-primary">Inka</span> AI Assistant
          </h1>
          
          {/* AI Response section */}
          <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
            <p className="text-sm text-primary font-medium">
              AI Response
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              In production, the AI would respond to your voice here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoVoiceAgent;