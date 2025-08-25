/**
 * WebRTC-based Advanced Audio Filtering System
 * Optimized for ElevenLabs Voice Agent conversations
 */

export type NoiseFilterLevel = 'low' | 'medium' | 'high' | 'aggressive';

interface WebRTCFilterConfig {
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  voiceIsolation: boolean;
  googEchoCancellation?: boolean;
  googNoiseSuppression?: boolean;
  googAutoGainControl?: boolean;
  googHighpassFilter?: boolean;
  googNoiseSuppression2?: boolean;
  googEchoCancellation2?: boolean;
  googAutoGainControl2?: boolean;
  googTypingNoiseDetection?: boolean;
}

export class WebRTCAdvancedFilters {
  private audioContext: AudioContext;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private filterChain: AudioNode[] = [];
  private currentLevel: NoiseFilterLevel = 'medium';
  private originalStream: MediaStream | null = null;
  private isInitialized = false;

  // Advanced filter nodes
  private compressor: DynamicsCompressorNode | null = null;
  private highPassFilter: BiquadFilterNode | null = null;
  private lowPassFilter: BiquadFilterNode | null = null;
  private notchFilter: BiquadFilterNode | null = null;
  private speechEnhancer: BiquadFilterNode | null = null;
  private noiseGate: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;

  // WebRTC-specific parameters
  private noiseGateThreshold = 0.01;
  private compressionRatio = 4;
  private isProcessing = false;

  constructor() {
    this.audioContext = new AudioContext();
    console.log('🎙️ WebRTC Advanced Audio Filters initialized');
  }

  private getWebRTCConstraints(level: NoiseFilterLevel): WebRTCFilterConfig {
    const baseConstraints: WebRTCFilterConfig = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      voiceIsolation: true,
    };

    // Advanced Chrome constraints optimized for conversation focus
    const advancedConstraints = {
      googEchoCancellation: true,
      googNoiseSuppression: true,
      googAutoGainControl: true,
      googHighpassFilter: true,
      googNoiseSuppression2: true,
      googEchoCancellation2: true,
      googAutoGainControl2: true,
      googTypingNoiseDetection: true,
    };

    switch (level) {
      case 'low':
        return {
          ...baseConstraints,
          noiseSuppression: true,
          autoGainControl: false,
        };
      case 'medium':
        return {
          ...baseConstraints,
          ...advancedConstraints,
        };
      case 'high':
        return {
          ...baseConstraints,
          ...advancedConstraints,
          voiceIsolation: true,
        };
      case 'aggressive':
        return {
          ...baseConstraints,
          ...advancedConstraints,
          voiceIsolation: true,
          noiseSuppression: true,
        };
      default:
        return baseConstraints;
    }
  }

  private createAdvancedFilterChain(): void {
    if (!this.audioContext) return;

    // 1. High-pass filter - aggressive for conversation focus
    this.highPassFilter = this.audioContext.createBiquadFilter();
    this.highPassFilter.type = 'highpass';
    this.highPassFilter.frequency.value = 200; // More aggressive cutoff for cleaner voice
    this.highPassFilter.Q.value = 2.0; // Sharper rolloff

    // 2. Notch filter for electrical hum elimination
    this.notchFilter = this.audioContext.createBiquadFilter();
    this.notchFilter.type = 'notch';
    this.notchFilter.frequency.value = 60; // 60Hz hum removal
    this.notchFilter.Q.value = 50; // Very sharp notch

    // 3. Speech enhancer - optimized for conversation clarity
    this.speechEnhancer = this.audioContext.createBiquadFilter();
    this.speechEnhancer.type = 'peaking';
    this.speechEnhancer.frequency.value = 2800; // Optimal speech intelligibility frequency
    this.speechEnhancer.Q.value = 1.8;
    this.speechEnhancer.gain.value = 4; // Stronger boost for clarity

    // 4. Low-pass filter - conversation focused
    this.lowPassFilter = this.audioContext.createBiquadFilter();
    this.lowPassFilter.type = 'lowpass';
    this.lowPassFilter.frequency.value = 6500; // Tighter focus on speech range
    this.lowPassFilter.Q.value = 1.5; // Sharper cutoff

    // 5. Advanced compressor - conversation optimized
    this.compressor = this.audioContext.createDynamicsCompressor();
    this.compressor.threshold.value = -18; // More aggressive threshold for conversation
    this.compressor.knee.value = 6; // Moderate knee for smooth compression
    this.compressor.ratio.value = this.compressionRatio;
    this.compressor.attack.value = 0.002; // Slightly slower for natural speech
    this.compressor.release.value = 0.08; // Longer release for smoother dynamics

    // 6. Noise gate
    this.noiseGate = this.audioContext.createGain();
    this.noiseGate.gain.value = 1;

    // 7. Final limiter to prevent clipping
    this.limiter = this.audioContext.createDynamicsCompressor();
    this.limiter.threshold.value = -3; // Prevent clipping
    this.limiter.knee.value = 0; // Hard knee
    this.limiter.ratio.value = 20; // Hard limiting
    this.limiter.attack.value = 0.0001; // Very fast attack
    this.limiter.release.value = 0.01; // Fast release

    // Build the filter chain
    this.filterChain = [
      this.highPassFilter,
      this.notchFilter,
      this.speechEnhancer,
      this.lowPassFilter,
      this.compressor,
      this.noiseGate,
      this.limiter
    ];

    console.log('🔗 WebRTC advanced filter chain created with 7 stages');
  }

  private connectFilterChain(): void {
    if (!this.sourceNode || !this.destinationNode || this.filterChain.length === 0) {
      console.error('❌ Cannot connect filter chain: missing nodes');
      return;
    }

    // Connect source to first filter
    this.sourceNode.connect(this.filterChain[0]);

    // Connect filters in sequence
    for (let i = 0; i < this.filterChain.length - 1; i++) {
      this.filterChain[i].connect(this.filterChain[i + 1]);
    }

    // Connect last filter to destination
    this.filterChain[this.filterChain.length - 1].connect(this.destinationNode);

    console.log('🔗 WebRTC filter chain connected successfully');
  }

  private startNoiseGateProcessor(): void {
    if (!this.noiseGate || !this.audioContext) return;

    // Create analyzer for noise gate
    const analyzer = this.audioContext.createAnalyser();
    analyzer.fftSize = 512;
    analyzer.smoothingTimeConstant = 0.8;

    // Connect analyzer before noise gate
    const analyzerIndex = this.filterChain.indexOf(this.noiseGate);
    if (analyzerIndex > 0) {
      this.filterChain[analyzerIndex - 1].connect(analyzer);
    }

    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const processGate = () => {
      if (!this.isProcessing) return;

      analyzer.getByteFrequencyData(dataArray);
      
      // Calculate RMS level
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / bufferLength) / 255;

      // Apply noise gate with enhanced conversation focus
      const targetGain = rms > this.noiseGateThreshold ? 1 : 0.02; // More aggressive gate
      const currentGain = this.noiseGate!.gain.value;
      const smoothGain = currentGain + (targetGain - currentGain) * 0.15; // Faster response
      
      this.noiseGate!.gain.setValueAtTime(smoothGain, this.audioContext.currentTime);

      requestAnimationFrame(processGate);
    };

    this.isProcessing = true;
    processGate();
    console.log('🚪 WebRTC advanced noise gate processor started');
  }

  async getOptimizedStream(level: NoiseFilterLevel = 'medium'): Promise<MediaStream> {
    try {
      this.currentLevel = level;
      console.log(`🎤 Requesting WebRTC optimized stream (level: ${level})`);

      // Get WebRTC constraints for the specified level
      const constraints = this.getWebRTCConstraints(level);
      
      // Request microphone with WebRTC optimizations
      this.originalStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Standard WebRTC constraints
          echoCancellation: constraints.echoCancellation,
          noiseSuppression: constraints.noiseSuppression,
          autoGainControl: constraints.autoGainControl,
          
          // Quality settings optimized for conversation
          sampleRate: { ideal: 48000 },
          channelCount: { exact: 1 },
          sampleSize: { ideal: 16 },
          
          // Advanced constraints (cast to any to bypass TypeScript)
          ...(constraints as any)
        } as any
      });

      console.log('✅ WebRTC stream acquired with advanced constraints');

      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Create source node from the WebRTC-optimized stream
      this.sourceNode = this.audioContext.createMediaStreamSource(this.originalStream);
      this.destinationNode = this.audioContext.createMediaStreamDestination();

      // Create and connect advanced filter chain
      this.createAdvancedFilterChain();
      this.connectFilterChain();

      // Start noise gate processing
      this.startNoiseGateProcessor();

      this.isInitialized = true;
      console.log('🎛️ WebRTC advanced filters fully initialized and active');

      // Apply level-specific tuning
      this.tuneFiltersForLevel(level);

      return this.destinationNode.stream;

    } catch (error) {
      console.error('❌ WebRTC filter initialization failed:', error);
      
      // Fallback to basic stream if WebRTC fails
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    }
  }

  private tuneFiltersForLevel(level: NoiseFilterLevel): void {
    switch (level) {
      case 'low':
        // Conversation focused - quiet environments
        if (this.compressor) this.compressor.ratio.value = 3;
        if (this.highPassFilter) this.highPassFilter.frequency.value = 180;
        if (this.speechEnhancer) this.speechEnhancer.gain.value = 3;
        this.noiseGateThreshold = 0.008;
        console.log('🎚️ WebRTC filters tuned for CONVERSATION FOCUS - quiet environment');
        break;

      case 'medium':
        // Conversation focused - normal environments
        if (this.compressor) this.compressor.ratio.value = 5;
        if (this.highPassFilter) this.highPassFilter.frequency.value = 200;
        if (this.speechEnhancer) this.speechEnhancer.gain.value = 4;
        this.noiseGateThreshold = 0.012;
        console.log('🎚️ WebRTC filters tuned for CONVERSATION FOCUS - normal environment');
        break;

      case 'high':
        // Conversation focused - noisy environments
        if (this.compressor) this.compressor.ratio.value = 7;
        if (this.highPassFilter) this.highPassFilter.frequency.value = 220;
        if (this.speechEnhancer) this.speechEnhancer.gain.value = 5;
        if (this.lowPassFilter) this.lowPassFilter.frequency.value = 6000;
        this.noiseGateThreshold = 0.018;
        console.log('🎚️ WebRTC filters tuned for CONVERSATION FOCUS - noisy environment');
        break;

      case 'aggressive':
        // Maximum conversation focus - very noisy environments
        if (this.compressor) this.compressor.ratio.value = 10;
        if (this.highPassFilter) this.highPassFilter.frequency.value = 250;
        if (this.speechEnhancer) this.speechEnhancer.gain.value = 6;
        if (this.lowPassFilter) this.lowPassFilter.frequency.value = 5500;
        this.noiseGateThreshold = 0.025;
        console.log('🎚️ WebRTC filters tuned for MAXIMUM CONVERSATION FOCUS - aggressive environment');
        break;
    }
  }

  setNoiseLevel(level: NoiseFilterLevel): void {
    if (!this.isInitialized) {
      console.warn('⚠️ WebRTC filters not initialized, cannot change noise level');
      return;
    }

    this.currentLevel = level;
    this.tuneFiltersForLevel(level);
    console.log(`🔄 WebRTC noise level changed to: ${level}`);
  }

  getCurrentLevel(): NoiseFilterLevel {
    return this.currentLevel;
  }

  cleanup(): void {
    this.isProcessing = false;
    
    if (this.originalStream) {
      this.originalStream.getTracks().forEach(track => track.stop());
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }

    this.sourceNode = null;
    this.destinationNode = null;
    this.filterChain = [];
    this.isInitialized = false;
    
    console.log('🧹 WebRTC advanced filters cleaned up');
  }

  // Get real-time audio metrics for monitoring
  getAudioMetrics(): Promise<{
    level: number;
    noiseFloor: number;
    compressionGain: number;
    isGateOpen: boolean;
  }> {
    return new Promise((resolve) => {
      if (!this.compressor || !this.noiseGate) {
        resolve({
          level: 0,
          noiseFloor: 0,
          compressionGain: 0,
          isGateOpen: false
        });
        return;
      }

      // Get compression reduction (how much compression is being applied)
      const compressionGain = this.compressor.reduction;
      const gateGain = this.noiseGate.gain.value;
      
      resolve({
        level: gateGain,
        noiseFloor: this.noiseGateThreshold,
        compressionGain: Math.abs(compressionGain),
        isGateOpen: gateGain > 0.5
      });
    });
  }
}

// Export singleton instance
export const webrtcFilters = new WebRTCAdvancedFilters();