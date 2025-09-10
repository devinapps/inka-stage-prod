import { useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VoiceAvatarProps {
  isListening: boolean;
  isSpeaking: boolean;
  onToggleListening: () => void;
  status: string;
  audioLevel?: number;
  isProcessing?: boolean;
  statusLabels?: {
    calling: string;
    connected: string;
    disconnected: string;
  };
}

const VoiceAvatar = ({ isListening, isSpeaking, onToggleListening, status, audioLevel = 0, isProcessing = false, statusLabels }: VoiceAvatarProps) => {
  console.log('[VoiceAvatar] Props:', { isListening, isSpeaking, status, isProcessing });
  
  // Override isSpeaking if status is disconnected to prevent stuck waves
  const actuallyListening = isListening && status !== 'disconnected';
  const actuallySpeaking = isSpeaking && status !== 'disconnected';
  
  return (
    <div className="flex flex-col items-center justify-center space-y-8">
      {/* Avatar Container */}
      <div className="relative">
        {/* Animated Rings for Voice Activity - synced with audio level, behind button */}
        {(actuallyListening || actuallySpeaking) && (
          <>
            <div 
              className="absolute inset-0 w-64 h-64 md:w-80 md:h-80 rounded-full border-2 border-primary/40 animate-ping transition-all duration-500 ease-in-out z-0" 
              style={{ 
                borderColor: actuallySpeaking ? `rgba(34, 197, 94, ${0.4 + audioLevel * 0.2})` : undefined,
                transform: `scale(${1 + audioLevel * 0.03})` 
              }}
            />
            <div 
              className="absolute inset-0 w-72 h-72 md:w-88 md:h-88 rounded-full border-2 border-primary/30 animate-ping animation-delay-300 transition-all duration-700 ease-in-out z-0" 
              style={{ 
                borderColor: actuallySpeaking ? `rgba(34, 197, 94, ${0.3 + audioLevel * 0.15})` : undefined,
                transform: `scale(${1 + audioLevel * 0.05})` 
              }}
            />
            <div 
              className="absolute inset-0 w-80 h-80 md:w-96 md:h-96 rounded-full border-2 border-primary/20 animate-ping animation-delay-600 transition-all duration-900 ease-in-out z-0" 
              style={{ 
                borderColor: actuallySpeaking ? `rgba(34, 197, 94, ${0.2 + audioLevel * 0.1})` : undefined,
                transform: `scale(${1 + audioLevel * 0.07})` 
              }}
            />
          </>
        )}
        
        {/* Enhanced glow effect for speaking - synced with audio level, behind button */}
        {actuallySpeaking && (
          <>
            <div 
              className="absolute inset-0 w-64 h-64 md:w-80 md:h-80 rounded-full bg-green-500/20 animate-pulse blur-xl transition-all duration-600 ease-in-out z-0" 
              style={{ 
                opacity: 0.2 + audioLevel * 0.2,
                transform: `scale(${1 + audioLevel * 0.06})` 
              }}
            />
            <div 
              className="absolute inset-0 w-72 h-72 md:w-88 md:h-88 rounded-full bg-green-500/15 animate-pulse blur-2xl animation-delay-200 transition-all duration-800 ease-in-out z-0" 
              style={{ 
                opacity: 0.15 + audioLevel * 0.15,
                transform: `scale(${1 + audioLevel * 0.08})` 
              }}
            />
          </>
        )}
        
        {/* Listening glow effect - behind button */}
        {actuallyListening && (
          <>
            <div className="absolute inset-0 w-64 h-64 md:w-80 md:h-80 rounded-full bg-red-500/20 animate-pulse blur-xl z-0" />
            <div className="absolute inset-0 w-72 h-72 md:w-88 md:h-88 rounded-full bg-red-500/15 animate-pulse blur-2xl animation-delay-200 z-0" />
          </>
        )}
        
        <div 
          className={cn(
            "relative w-64 h-64 md:w-80 md:h-80 rounded-full overflow-hidden border-4 transition-all duration-500",
            actuallyListening && "border-primary shadow-lg shadow-primary/50 scale-105",
            actuallySpeaking && "border-green-500 shadow-lg shadow-green-500/50 scale-105",
            !actuallyListening && !actuallySpeaking && "border-primary/30"
          )}
        >
          <img
            src="/inka-avatar.png"
            alt="Inka AI Voice Agent"
            className="w-full h-full object-cover object-center"
          />
          
          {/* Voice Activity Overlay */}
          {actuallyListening && (
            <div className="absolute inset-0 bg-primary/20 animate-pulse rounded-full" />
          )}
          {actuallySpeaking && (
            <div className="absolute inset-0 bg-green-500/20 animate-pulse rounded-full" />
          )}
          
          {/* Sound wave effect for speaking - synced with audio level */}
          {actuallySpeaking && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex space-x-1">
                <div 
                  className="w-1 bg-green-500/60 rounded-full animate-bounce transition-all duration-400 ease-in-out" 
                  style={{ height: `${Math.max(8, 8 + audioLevel * 15)}px` }}
                />
                <div 
                  className="w-1 bg-green-500/60 rounded-full animate-bounce animation-delay-100 transition-all duration-400 ease-in-out" 
                  style={{ height: `${Math.max(12, 12 + audioLevel * 18)}px` }}
                />
                <div 
                  className="w-1 bg-green-500/60 rounded-full animate-bounce animation-delay-200 transition-all duration-400 ease-in-out" 
                  style={{ height: `${Math.max(6, 6 + audioLevel * 12)}px` }}
                />
                <div 
                  className="w-1 bg-green-500/60 rounded-full animate-bounce animation-delay-300 transition-all duration-400 ease-in-out" 
                  style={{ height: `${Math.max(10, 10 + audioLevel * 16)}px` }}
                />
                <div 
                  className="w-1 bg-green-500/60 rounded-full animate-bounce animation-delay-400 transition-all duration-400 ease-in-out" 
                  style={{ height: `${Math.max(8, 8 + audioLevel * 14)}px` }}
                />
                <div 
                  className="w-1 bg-green-500/60 rounded-full animate-bounce animation-delay-500 transition-all duration-400 ease-in-out" 
                  style={{ height: `${Math.max(14, 14 + audioLevel * 22)}px` }}
                />
                <div 
                  className="w-1 bg-green-500/60 rounded-full animate-bounce animation-delay-600 transition-all duration-400 ease-in-out" 
                  style={{ height: `${Math.max(7, 7 + audioLevel * 13)}px` }}
                />
              </div>
            </div>
          )}
          
          {/* Listening indicator - rotating dots */}
          {actuallyListening && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-16 h-16">
                <div className="absolute top-0 left-1/2 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                <div className="absolute top-1/2 right-0 w-2 h-2 bg-red-500 rounded-full animate-ping animation-delay-200" />
                <div className="absolute bottom-0 left-1/2 w-2 h-2 bg-red-500 rounded-full animate-ping animation-delay-400" />
                <div className="absolute top-1/2 left-0 w-2 h-2 bg-red-500 rounded-full animate-ping animation-delay-600" />
              </div>
            </div>
          )}
        </div>
        
        {/* Enhanced Voice Button - Higher z-index to stay on top */}
        <Button
          onClick={() => {
            console.log('Voice button clicked - isListening:', isListening, 'isSpeaking:', isSpeaking, 'status:', status);
            onToggleListening();
          }}
          disabled={isProcessing}
          className={cn(
            "absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-16 h-16 rounded-full transition-all duration-300 z-50 pointer-events-auto",
            actuallyListening && !actuallySpeaking && "bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/50 scale-110",
            actuallySpeaking && "bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/50 scale-110",
            !actuallyListening && !actuallySpeaking && "bg-primary hover:bg-primary/80 shadow-lg shadow-primary/30",
            isProcessing && "opacity-50 cursor-not-allowed"
          )}
          size="lg"
          style={{ pointerEvents: 'auto' }}
        >
          {actuallyListening ? (
            <MicOff className="h-6 w-6" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </Button>
        
        {/* Microphone pulse effect when listening - Lower z-index to stay behind button */}
        {actuallyListening && (
          <>
            <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-16 h-16 rounded-full bg-red-500/30 animate-ping z-10 pointer-events-none" />
            <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-20 h-20 rounded-full bg-red-500/20 animate-ping animation-delay-300 z-10 pointer-events-none" />
            <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-24 h-24 rounded-full bg-red-500/10 animate-ping animation-delay-600 z-10 pointer-events-none" />
          </>
        )}
        
        {/* Speaking pulse effect - Lower z-index to stay behind button */}
        {actuallySpeaking && (
          <>
            <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-16 h-16 rounded-full bg-green-500/30 animate-ping z-10 pointer-events-none" />
            <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-20 h-20 rounded-full bg-green-500/20 animate-ping animation-delay-200 z-10 pointer-events-none" />
            <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-24 h-24 rounded-full bg-green-500/15 animate-ping animation-delay-400 z-10 pointer-events-none" />
          </>
        )}
      </div>

      {/* Status Indicator */}
      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          {isProcessing 
            ? (statusLabels?.calling || 'Calling...') 
            : (status === 'connected' 
              ? (statusLabels?.connected || 'Connected') 
              : (statusLabels?.disconnected || 'Disconnected')
            )
          }
        </p>
        <div className="flex items-center justify-center space-x-2">
          {(actuallyListening || actuallySpeaking) ? (
            <>
              <div 
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  status === 'connected' ? 'bg-primary' : 'bg-muted-foreground'
                )}
              />
              <span className="text-xs text-muted-foreground">
                {actuallyListening ? 'Listening...' : 'Speaking...'}
              </span>
            </>
          ) : null}
        
        </div>
      </div>
    </div>
  );
};

export default VoiceAvatar;