/**
 * WebRTC-based Advanced Audio Filtering System
 * Optimized for ElevenLabs Voice Agent conversations with real-time parameter adjustment
 */

export interface AudioFilterParams {
  // High-pass filter
  highPassFreq: number;
  highPassQ: number;
  
  // Speech enhancer
  speechFreq: number;
  speechQ: number;
  speechGain: number;
  
  // Low-pass filter
  lowPassFreq: number;
  lowPassQ: number;
  
  // Compressor
  compressorThreshold: number;
  compressorRatio: number;
  compressorAttack: number;
  compressorRelease: number;
  
  // Noise gate
  noiseGateThreshold: number;
}

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
  private isProcessing = false;
  
  // Configurable filter parameters optimized for human conversation
  public filterParams: AudioFilterParams = {
    highPassFreq: 150,        // Remove low-freq noise while preserving voice
    highPassQ: 1.2,           // Moderate rolloff
    speechFreq: 2500,         // Voice clarity enhancement frequency
    speechQ: 1.5,             // Clear enhancement
    speechGain: 3,            // Moderate voice boost
    lowPassFreq: 7000,        // Remove high-freq noise
    lowPassQ: 1.0,            // Smooth rolloff
    compressorThreshold: -20, // Gentle compression
    compressorRatio: 3,       // Moderate compression
    compressorAttack: 0.003,  // Natural attack
    compressorRelease: 0.1,   // Smooth release
    noiseGateThreshold: 0.015 // Balanced gate
  };

  constructor() {
    this.audioContext = new AudioContext();
    console.log('🎙️ WebRTC Advanced Audio Filters initialized');
  }

  private getWebRTCConstraints(): WebRTCFilterConfig {
    const baseConstraints: WebRTCFilterConfig = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      voiceIsolation: true,
    };

    // Advanced Chrome constraints for optimal human conversation
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

    return {
      ...baseConstraints,
      ...advancedConstraints,
    };
  }

  private createAdvancedFilterChain(): void {
    if (!this.audioContext) return;

    // 1. High-pass filter
    this.highPassFilter = this.audioContext.createBiquadFilter();
    this.highPassFilter.type = 'highpass';
    this.highPassFilter.frequency.value = this.filterParams.highPassFreq;
    this.highPassFilter.Q.value = this.filterParams.highPassQ;

    // 2. Notch filter for electrical hum elimination
    this.notchFilter = this.audioContext.createBiquadFilter();
    this.notchFilter.type = 'notch';
    this.notchFilter.frequency.value = 60; // 60Hz hum removal
    this.notchFilter.Q.value = 30; // Sharp notch

    // 3. Speech enhancer
    this.speechEnhancer = this.audioContext.createBiquadFilter();
    this.speechEnhancer.type = 'peaking';
    this.speechEnhancer.frequency.value = this.filterParams.speechFreq;
    this.speechEnhancer.Q.value = this.filterParams.speechQ;
    this.speechEnhancer.gain.value = this.filterParams.speechGain;

    // 4. Low-pass filter
    this.lowPassFilter = this.audioContext.createBiquadFilter();
    this.lowPassFilter.type = 'lowpass';
    this.lowPassFilter.frequency.value = this.filterParams.lowPassFreq;
    this.lowPassFilter.Q.value = this.filterParams.lowPassQ;

    // 5. Advanced compressor
    this.compressor = this.audioContext.createDynamicsCompressor();
    this.compressor.threshold.value = this.filterParams.compressorThreshold;
    this.compressor.knee.value = 6; // Smooth compression
    this.compressor.ratio.value = this.filterParams.compressorRatio;
    this.compressor.attack.value = this.filterParams.compressorAttack;
    this.compressor.release.value = this.filterParams.compressorRelease;

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
      const targetGain = rms > this.filterParams.noiseGateThreshold ? 1 : 0.02; // More aggressive gate
      const currentGain = this.noiseGate!.gain.value;
      const smoothGain = currentGain + (targetGain - currentGain) * 0.15; // Faster response
      
      this.noiseGate!.gain.setValueAtTime(smoothGain, this.audioContext.currentTime);

      requestAnimationFrame(processGate);
    };

    this.isProcessing = true;
    processGate();
    console.log('🚪 WebRTC advanced noise gate processor started');
  }

  async getOptimizedStream(): Promise<MediaStream> {
    try {
      console.log('🎤 Requesting WebRTC optimized stream for human conversation');

      // Get WebRTC constraints optimized for human conversation
      const constraints = this.getWebRTCConstraints();
      
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

      // Apply optimized tuning for human conversation
      console.log('🎚️ WebRTC filters optimized for HUMAN CONVERSATION');

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

  // Update filter parameters in real-time
  updateFilterParams(params: Partial<AudioFilterParams>): void {
    Object.assign(this.filterParams, params);
    
    if (this.isInitialized) {
      // Update filters in real-time
      if (this.highPassFilter && params.highPassFreq) {
        this.highPassFilter.frequency.value = params.highPassFreq;
      }
      if (this.highPassFilter && params.highPassQ) {
        this.highPassFilter.Q.value = params.highPassQ;
      }
      if (this.speechEnhancer && params.speechFreq) {
        this.speechEnhancer.frequency.value = params.speechFreq;
      }
      if (this.speechEnhancer && params.speechQ) {
        this.speechEnhancer.Q.value = params.speechQ;
      }
      if (this.speechEnhancer && params.speechGain) {
        this.speechEnhancer.gain.value = params.speechGain;
      }
      if (this.lowPassFilter && params.lowPassFreq) {
        this.lowPassFilter.frequency.value = params.lowPassFreq;
      }
      if (this.lowPassFilter && params.lowPassQ) {
        this.lowPassFilter.Q.value = params.lowPassQ;
      }
      if (this.compressor && params.compressorThreshold) {
        this.compressor.threshold.value = params.compressorThreshold;
      }
      if (this.compressor && params.compressorRatio) {
        this.compressor.ratio.value = params.compressorRatio;
      }
      if (this.compressor && params.compressorAttack) {
        this.compressor.attack.value = params.compressorAttack;
      }
      if (this.compressor && params.compressorRelease) {
        this.compressor.release.value = params.compressorRelease;
      }
      
      console.log('🔧 Filter parameters updated in real-time');
    }
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
        noiseFloor: this.filterParams.noiseGateThreshold,
        compressionGain: Math.abs(compressionGain),
        isGateOpen: gateGain > 0.5
      });
    });
  }
}

// Export singleton instance
export const webrtcFilters = new WebRTCAdvancedFilters();