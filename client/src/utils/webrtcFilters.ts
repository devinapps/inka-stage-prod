/**
 * WebRTC-based Advanced Audio Filtering System - Optimized Chain B
 * Processing Order: Highpass → Notch → Noise Gate → Speech Enhancer → Lowpass → Compressor → Limiter
 */

export type NoiseFilterLevel = 'high';

interface WebRTCFilterConfig {
  echoCancellation: boolean;
  noiseSuppression: boolean;
  voiceIsolation: boolean;
  googEchoCancellation?: boolean;
  googNoiseSuppression?: boolean;
  googHighpassFilter?: boolean;
  googNoiseSuppression2?: boolean;
  googEchoCancellation2?: boolean;
  googTypingNoiseDetection?: boolean;
}

interface CalibrationData {
  noiseFloor: number;
  spectrumPeak: number;
  calibrated: boolean;
}

export class WebRTCAdvancedFilters {
  private audioContext: AudioContext;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private filterChain: AudioNode[] = [];
  private originalStream: MediaStream | null = null;
  private isInitialized = false;

  // Chain B filter nodes in order
  private highPassFilter: BiquadFilterNode | null = null;
  private notchFilter: BiquadFilterNode | null = null;
  private noiseGate: GainNode | null = null;
  private speechEnhancer: BiquadFilterNode | null = null;
  private lowPassFilter: BiquadFilterNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private outputNormalizer: GainNode | null = null;

  // Noise gate components
  private delayNode: DelayNode | null = null;
  private analyser: AnalyserNode | null = null;
  private gateProcessor: ScriptProcessorNode | null = null;

  // Calibration data
  private calibration: CalibrationData = {
    noiseFloor: 0.015,
    spectrumPeak: 2800,
    calibrated: false
  };

  // Gate parameters (high profile)
  private gateParams = {
    openThreshold: 0.015,
    closeThreshold: 0.009,
    holdTime: 250, // ms
    lookAhead: 8, // ms
    isOpen: false,
    holdCounter: 0
  };

  private isProcessing = false;

  constructor() {
    this.audioContext = new AudioContext();
    console.log('🎙️ WebRTC Advanced Audio Filters initialized');
  }

  private getWebRTCConstraints(): WebRTCFilterConfig {
    // High profile: no autoGainControl (compressor+limiter handle dynamics)
    const constraints: WebRTCFilterConfig = {
      echoCancellation: true,
      noiseSuppression: true,
      voiceIsolation: true,
      // Advanced Chrome constraints
      googEchoCancellation: true,
      googNoiseSuppression: true,
      googHighpassFilter: true,
      googNoiseSuppression2: true,
      googEchoCancellation2: true,
      googTypingNoiseDetection: true,
    };

    return constraints;
  }

  private createAdvancedFilterChain(): void {
    if (!this.audioContext || !this.sourceNode) return;

    // Clear previous chain
    this.filterChain = [];

    // 1. Highpass Filter (220 Hz, Q = 0.9)
    this.highPassFilter = this.audioContext.createBiquadFilter();
    this.highPassFilter.type = 'highpass';
    this.highPassFilter.frequency.value = 220;
    this.highPassFilter.Q.value = 0.9;
    this.filterChain.push(this.highPassFilter);

    // 2. Notch Filter (50/60 Hz hum removal, Q = 40)
    this.notchFilter = this.audioContext.createBiquadFilter();
    this.notchFilter.type = 'notch';
    this.notchFilter.frequency.value = 60; // Use 50 for EU, 60 for US
    this.notchFilter.Q.value = 40;
    this.filterChain.push(this.notchFilter);

    // 3. Delay for lookahead (8ms)
    this.delayNode = this.audioContext.createDelay();
    this.delayNode.delayTime.value = this.gateParams.lookAhead / 1000;
    this.filterChain.push(this.delayNode);

    // 4. Noise Gate with RMS analysis
    this.setupNoiseGate();
    if (this.noiseGate) {
      this.filterChain.push(this.noiseGate);
    }

    // 5. Speech Enhancer (2800 Hz, +4 dB, Q = 1.4)
    this.speechEnhancer = this.audioContext.createBiquadFilter();
    this.speechEnhancer.type = 'peaking';
    this.speechEnhancer.frequency.value = 2800;
    this.speechEnhancer.gain.value = 4;
    this.speechEnhancer.Q.value = 1.4;
    this.filterChain.push(this.speechEnhancer);

    // 6. Lowpass Filter (6000 Hz, Q = 0.8)
    this.lowPassFilter = this.audioContext.createBiquadFilter();
    this.lowPassFilter.type = 'lowpass';
    this.lowPassFilter.frequency.value = 6000;
    this.lowPassFilter.Q.value = 0.8;
    this.filterChain.push(this.lowPassFilter);

    // 7. Compressor (-20 dB threshold, 5:1 ratio, 2ms attack, 120ms release, 15 dB knee)
    this.compressor = this.audioContext.createDynamicsCompressor();
    this.compressor.threshold.value = -20;
    this.compressor.ratio.value = 5;
    this.compressor.attack.value = 0.002;
    this.compressor.release.value = 0.12;
    this.compressor.knee.value = 15;
    this.filterChain.push(this.compressor);

    // 8. Limiter (-3 dB threshold, 100ms release)
    this.limiter = this.audioContext.createDynamicsCompressor();
    this.limiter.threshold.value = -3;
    this.limiter.ratio.value = 20; // Hard limiting
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.1;
    this.limiter.knee.value = 0;
    this.filterChain.push(this.limiter);

    // 9. Output Normalizer (±1-2 dB adjustment)
    this.outputNormalizer = this.audioContext.createGain();
    this.outputNormalizer.gain.value = 1.0; // Adjusted during calibration
    this.filterChain.push(this.outputNormalizer);

    // Connect the chain
    this.connectFilterChain();
  }

  private setupNoiseGate(): void {
    if (!this.audioContext) return;

    // Create analyser for RMS calculation (300-4000 Hz weighted)
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.3;

    // Gate gain node
    this.noiseGate = this.audioContext.createGain();
    this.noiseGate.gain.value = 0; // Start closed

    // Create processor for gate logic
    if (this.audioContext.createScriptProcessor) {
      this.gateProcessor = this.audioContext.createScriptProcessor(512, 1, 1);
      this.gateProcessor.onaudioprocess = this.processNoiseGate.bind(this);
    }
  }

  private processNoiseGate(event: AudioProcessingEvent): void {
    if (!this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate RMS weighted for 300-4000 Hz band
    const sampleRate = this.audioContext.sampleRate;
    const binSize = sampleRate / (2 * bufferLength);
    const startBin = Math.floor(300 / binSize);
    const endBin = Math.floor(4000 / binSize);

    let sum = 0;
    let count = 0;
    for (let i = startBin; i < Math.min(endBin, bufferLength); i++) {
      const value = dataArray[i] / 255.0;
      sum += value * value;
      count++;
    }

    const rms = count > 0 ? Math.sqrt(sum / count) : 0;

    // Gate logic with hysteresis
    const currentlyOpen = this.gateParams.isOpen;
    const threshold = currentlyOpen ? this.gateParams.closeThreshold : this.gateParams.openThreshold;

    if (rms > threshold && !currentlyOpen) {
      // Open gate
      this.gateParams.isOpen = true;
      this.gateParams.holdCounter = 0;
      if (this.noiseGate) {
        this.noiseGate.gain.setTargetAtTime(1.0, this.audioContext.currentTime, 0.01);
      }
    } else if (rms <= threshold && currentlyOpen) {
      // Start hold timer
      this.gateParams.holdCounter += event.inputBuffer.length / this.audioContext.sampleRate * 1000;
      
      if (this.gateParams.holdCounter >= this.gateParams.holdTime) {
        // Close gate after hold time
        this.gateParams.isOpen = false;
        this.gateParams.holdCounter = 0;
        if (this.noiseGate) {
          this.noiseGate.gain.setTargetAtTime(0.0, this.audioContext.currentTime, 0.05);
        }
      }
    } else if (currentlyOpen && rms > threshold) {
      // Reset hold counter if signal returns above threshold
      this.gateParams.holdCounter = 0;
    }
  }

  private connectFilterChain(): void {
    if (!this.sourceNode || !this.destinationNode || this.filterChain.length === 0) return;

    // Connect source to first filter
    this.sourceNode.connect(this.filterChain[0]);

    // Connect filters in sequence
    for (let i = 0; i < this.filterChain.length - 1; i++) {
      this.filterChain[i].connect(this.filterChain[i + 1]);
    }

    // Special connection for noise gate analysis
    if (this.delayNode && this.analyser && this.gateProcessor) {
      this.delayNode.connect(this.analyser);
      this.analyser.connect(this.gateProcessor);
      this.gateProcessor.connect(this.audioContext.destination);
    }

    // Connect last filter to destination
    this.filterChain[this.filterChain.length - 1].connect(this.destinationNode);

    console.log('🔗 WebRTC advanced filter chain created with 7 stages');
  }

  private async performAutoCalibration(): Promise<void> {
    if (!this.analyser || this.calibration.calibrated) return;

    console.log('🔬 Starting auto-calibration...');

    return new Promise((resolve) => {
      let samples = 0;
      const targetSamples = Math.floor(800 / (512 / this.audioContext.sampleRate * 1000)); // 800ms worth
      let noiseSum = 0;

      const calibrationProcessor = this.audioContext.createScriptProcessor(512, 1, 1);
      
      calibrationProcessor.onaudioprocess = (event) => {
        const bufferLength = this.analyser!.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser!.getByteFrequencyData(dataArray);

        // Calculate noise floor
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          const value = dataArray[i] / 255.0;
          sum += value * value;
        }
        const rms = Math.sqrt(sum / bufferLength);
        noiseSum += rms;
        samples++;

        if (samples >= targetSamples) {
          const avgNoiseFloor = noiseSum / samples;
          this.calibration.noiseFloor = avgNoiseFloor;
          this.calibration.calibrated = true;

          // Adjust parameters based on noise floor
          if (avgNoiseFloor > 0.02) {
            // High noise environment
            this.gateParams.openThreshold = Math.min(0.025, avgNoiseFloor * 1.5);
            this.gateParams.closeThreshold = Math.min(0.015, avgNoiseFloor * 1.2);
            if (this.highPassFilter) {
              this.highPassFilter.frequency.value = 250; // Increase cutoff
            }
            console.log('🔧 High noise calibration applied');
          } else if (avgNoiseFloor < 0.005) {
            // Low noise environment
            this.gateParams.openThreshold = Math.max(0.008, avgNoiseFloor * 2);
            this.gateParams.closeThreshold = Math.max(0.004, avgNoiseFloor * 1.5);
            if (this.highPassFilter) {
              this.highPassFilter.frequency.value = 180; // Decrease cutoff
            }
            console.log('🔧 Low noise calibration applied');
          }

          // Adjust output normalizer
          if (this.outputNormalizer) {
            const gainAdjust = avgNoiseFloor > 0.015 ? 0.9 : 1.1; // -1dB or +1dB
            this.outputNormalizer.gain.value = gainAdjust;
          }

          calibrationProcessor.disconnect();
          console.log(`✅ Auto-calibration complete. Noise floor: ${avgNoiseFloor.toFixed(4)}`);
          resolve();
        }
      };

      if (this.sourceNode) {
        this.sourceNode.connect(calibrationProcessor);
        calibrationProcessor.connect(this.audioContext.destination);
      }
    });
  }

  async initializeWebRTCStream(level: NoiseFilterLevel = 'high'): Promise<MediaStream> {
    try {
      console.log(`🎤 Requesting WebRTC optimized stream (level: ${level})`);
      
      const constraints = this.getWebRTCConstraints();
      
      // Enhanced getUserMedia constraints with ideal values
      const mediaConstraints: MediaStreamConstraints = {
        audio: {
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 48000 },
          // Remove autoGainControl for high profile
          ...(constraints.voiceIsolation && { voiceIsolation: true }),
          ...constraints
        }
      };

      this.originalStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      console.log('✅ WebRTC stream acquired with advanced constraints');

      await this.applyAdvancedFiltering();
      return this.getProcessedStream();

    } catch (error) {
      console.warn('⚠️ Advanced constraints failed, using fallback:', error);
      
      // Fallback constraints
      const fallbackConstraints: MediaStreamConstraints = {
        audio: {
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 48000 },
          echoCancellation: true,
          noiseSuppression: true
        }
      };

      this.originalStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      console.log('✅ Fallback WebRTC stream acquired');

      await this.applyAdvancedFiltering();
      return this.getProcessedStream();
    }
  }

  private async applyAdvancedFiltering(): Promise<void> {
    if (!this.originalStream || !this.audioContext) return;

    await this.audioContext.resume();

    this.sourceNode = this.audioContext.createMediaStreamSource(this.originalStream);
    this.destinationNode = this.audioContext.createMediaStreamDestination();

    this.createAdvancedFilterChain();

    // Perform auto-calibration
    await this.performAutoCalibration();

    this.isInitialized = true;
    console.log('🔗 WebRTC filter chain connected successfully');
    console.log('🚪 WebRTC advanced noise gate processor started');
    console.log('🎛️ WebRTC advanced filters fully initialized and active');
    console.log('🎚️ WebRTC filters tuned for CONVERSATION FOCUS - noisy environment');
  }

  getProcessedStream(): MediaStream {
    if (!this.destinationNode) {
      throw new Error('Filter chain not initialized');
    }
    return this.destinationNode.stream;
  }

  getAudioMetrics() {
    return {
      level: this.gateParams.isOpen ? 1 : 0,
      noiseFloor: this.calibration.noiseFloor,
      compressionGain: this.compressor?.reduction || 0,
      isGateOpen: this.gateParams.isOpen
    };
  }

  destroy(): void {
    this.filterChain.forEach(node => {
      try {
        node.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
    });

    if (this.gateProcessor) {
      this.gateProcessor.disconnect();
      this.gateProcessor = null;
    }

    if (this.originalStream) {
      this.originalStream.getTracks().forEach(track => track.stop());
      this.originalStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }

    this.isInitialized = false;
    console.log('🧹 WebRTC filters destroyed');
  }
}

// Global instance for the application
export const webrtcFilters = new WebRTCAdvancedFilters();