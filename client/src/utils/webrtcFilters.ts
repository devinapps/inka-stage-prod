/**
 * WebRTC-based Advanced Audio Filtering System
 * Optimized for ElevenLabs Voice Agent conversations with configurable noise filtering levels
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
      voiceIsolation: false,
    };

    // Advanced Chrome constraints
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
          noiseSuppression: false,
          autoGainControl: false,
        };
      
      case 'medium':
        return {
          ...baseConstraints,
          ...advancedConstraints,
          googNoiseSuppression2: false,
          googAutoGainControl2: false,
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
        return {
          ...baseConstraints,
          ...advancedConstraints,
          voiceIsolation: true,
        };
    }
  }

  private createAdvancedFilterChain(level: NoiseFilterLevel): void {
    if (!this.audioContext) return;

    // Configure filters based on level
    const config = this.getFilterConfig(level);

    // 1. High-pass filter
    this.highPassFilter = this.audioContext.createBiquadFilter();
    this.highPassFilter.type = 'highpass';
    this.highPassFilter.frequency.value = config.highPassFreq;
    this.highPassFilter.Q.value = config.highPassQ;

    // 2. Notch filter for electrical hum elimination
    this.notchFilter = this.audioContext.createBiquadFilter();
    this.notchFilter.type = 'notch';
    this.notchFilter.frequency.value = 60; // 60Hz hum removal
    this.notchFilter.Q.value = config.notchQ;

    // 3. Speech enhancer
    this.speechEnhancer = this.audioContext.createBiquadFilter();
    this.speechEnhancer.type = 'peaking';
    this.speechEnhancer.frequency.value = config.speechFreq;
    this.speechEnhancer.Q.value = config.speechQ;
    this.speechEnhancer.gain.value = config.speechGain;

    // 4. Low-pass filter
    this.lowPassFilter = this.audioContext.createBiquadFilter();
    this.lowPassFilter.type = 'lowpass';
    this.lowPassFilter.frequency.value = config.lowPassFreq;
    this.lowPassFilter.Q.value = config.lowPassQ;

    // 5. Advanced compressor
    this.compressor = this.audioContext.createDynamicsCompressor();
    this.compressor.threshold.value = config.compressorThreshold;
    this.compressor.knee.value = config.compressorKnee;
    this.compressor.ratio.value = config.compressorRatio;
    this.compressor.attack.value = config.compressorAttack;
    this.compressor.release.value = config.compressorRelease;

    // 6. Noise gate
    this.noiseGate = this.audioContext.createGain();
    this.noiseGate.gain.value = 1;

    // 7. Final limiter to prevent clipping
    this.limiter = this.audioContext.createDynamicsCompressor();
    this.limiter.threshold.value = config.limiterThreshold;
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

  async getOptimizedStream(level: NoiseFilterLevel = 'high'): Promise<MediaStream> {
    try {
      console.log(`🎤 Requesting WebRTC optimized stream (level: ${level})`);

      // Get WebRTC constraints for specified level
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
      this.createAdvancedFilterChain(level);
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

  private getFilterConfig(level: NoiseFilterLevel): {
    highPassFreq: number;
    highPassQ: number;
    notchQ: number;
    speechFreq: number;
    speechQ: number;
    speechGain: number;
    lowPassFreq: number;
    lowPassQ: number;
    compressorThreshold: number;
    compressorKnee: number;
    compressorRatio: number;
    compressorAttack: number;
    compressorRelease: number;
    limiterThreshold: number;
    noiseGateThreshold: number;
  } {
    switch (level) {
      case 'low':
        return {
          highPassFreq: 80,
          highPassQ: 0.7,
          notchQ: 10,
          speechFreq: 1500,
          speechQ: 1.0,
          speechGain: 1,
          lowPassFreq: 8000,
          lowPassQ: 0.7,
          compressorThreshold: -24,
          compressorKnee: 12,
          compressorRatio: 2,
          compressorAttack: 0.003,
          compressorRelease: 0.25,
          limiterThreshold: -6,
          noiseGateThreshold: 0.005
        };
      case 'medium':
        return {
          highPassFreq: 120,
          highPassQ: 1.0,
          notchQ: 25,
          speechFreq: 2000,
          speechQ: 1.2,
          speechGain: 2,
          lowPassFreq: 7500,
          lowPassQ: 1.0,
          compressorThreshold: -20,
          compressorKnee: 8,
          compressorRatio: 3,
          compressorAttack: 0.002,
          compressorRelease: 0.15,
          limiterThreshold: -4,
          noiseGateThreshold: 0.01
        };
      case 'high':
        return {
          highPassFreq: 200,
          highPassQ: 2.0,
          notchQ: 50,
          speechFreq: 2800,
          speechQ: 1.8,
          speechGain: 4,
          lowPassFreq: 6500,
          lowPassQ: 1.5,
          compressorThreshold: -18,
          compressorKnee: 6,
          compressorRatio: 4,
          compressorAttack: 0.002,
          compressorRelease: 0.08,
          limiterThreshold: -3,
          noiseGateThreshold: 0.018
        };
      case 'aggressive':
        return {
          highPassFreq: 280,
          highPassQ: 3.0,
          notchQ: 100,
          speechFreq: 3200,
          speechQ: 2.5,
          speechGain: 6,
          lowPassFreq: 6000,
          lowPassQ: 2.0,
          compressorThreshold: -15,
          compressorKnee: 4,
          compressorRatio: 8,
          compressorAttack: 0.001,
          compressorRelease: 0.05,
          limiterThreshold: -2,
          noiseGateThreshold: 0.025
        };
      default:
        return this.getFilterConfig('high');
    }
  }

  private tuneFiltersForLevel(level: NoiseFilterLevel): void {
    const config = this.getFilterConfig(level);
    
    // Apply dynamic tuning based on level
    if (this.compressor) this.compressor.ratio.value = config.compressorRatio + 3;
    if (this.highPassFilter) this.highPassFilter.frequency.value = config.highPassFreq + 20;
    if (this.speechEnhancer) this.speechEnhancer.gain.value = config.speechGain + 1;
    if (this.lowPassFilter) this.lowPassFilter.frequency.value = config.lowPassFreq - 500;
    this.noiseGateThreshold = config.noiseGateThreshold;
    
    const levelDescriptions = {
      low: 'MINIMAL FILTERING - clean environment',
      medium: 'MODERATE FILTERING - normal environment', 
      high: 'CONVERSATION FOCUS - noisy environment',
      aggressive: 'MAXIMUM FILTERING - very noisy environment'
    };
    
    console.log(`🎚️ WebRTC filters tuned for ${levelDescriptions[level]}`);
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