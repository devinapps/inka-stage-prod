// Audio filtering utilities for noise reduction and enhancement
export class AudioFilters {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private noiseGateNode: AudioWorkletNode | AudioNode | null = null;
  private gainNode: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  
  // Additional noise filtering nodes
  private lowPassNode: BiquadFilterNode | null = null;
  private bandPassNode: BiquadFilterNode | null = null;
  private notchNode: BiquadFilterNode | null = null;
  
  constructor() {}
  
  async initializeAudioContext(): Promise<AudioContext> {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Resume context if suspended (required by browsers)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
    }
    return this.audioContext;
  }
  
  /**
   * Get microphone access with native noise suppression enabled
   */
  async getFilteredMicrophoneStream(): Promise<MediaStream> {
    try {
      // Request microphone with aggressive native noise suppression
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Enable all native browser noise suppression features
          noiseSuppression: { exact: true },
          echoCancellation: { exact: true },
          autoGainControl: { exact: true },
          // Optimize for voice with better quality
          sampleRate: { ideal: 48000 },
          channelCount: { exact: 1 }
        } as any
      });
      
      console.log('✅ Microphone stream acquired with aggressive noise suppression');
      return await this.applyAdvancedFilters(stream);
      
    } catch (error) {
      console.error('❌ Error with advanced constraints, trying fallback:', error);
      // Fallback to basic but reliable constraints
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ 
          audio: { 
            noiseSuppression: true,
            echoCancellation: true,
            autoGainControl: true,
            sampleRate: 44100,
            channelCount: 1
          } 
        });
        console.log('✅ Fallback microphone stream acquired');
        return await this.applyAdvancedFilters(fallbackStream);
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError);
        // Final fallback - basic stream without processing
        return navigator.mediaDevices.getUserMedia({ audio: true });
      }
    }
  }
  
  /**
   * Apply advanced audio filters to the stream
   */
  private async applyAdvancedFilters(inputStream: MediaStream): Promise<MediaStream> {
    const audioContext = await this.initializeAudioContext();
    
    // Create audio nodes
    this.sourceNode = audioContext.createMediaStreamSource(inputStream);
    this.gainNode = audioContext.createGain();
    this.filterNode = audioContext.createBiquadFilter();
    this.compressorNode = audioContext.createDynamicsCompressor();
    this.destinationNode = audioContext.createMediaStreamDestination();
    
    // Additional filtering nodes
    this.lowPassNode = audioContext.createBiquadFilter();
    this.bandPassNode = audioContext.createBiquadFilter();
    this.notchNode = audioContext.createBiquadFilter();
    
    // Configure high-pass filter to remove low-frequency noise
    this.filterNode.type = 'highpass';
    this.filterNode.frequency.value = 200; // Remove frequencies below 200Hz (traffic, AC noise, hum)
    this.filterNode.Q.value = 2; // Sharper cutoff
    
    // Configure compressor for dynamic range control and noise suppression
    this.compressorNode.threshold.value = -18; // Lower threshold for better noise control
    this.compressorNode.knee.value = 15; // Softer knee for smoother compression
    this.compressorNode.ratio.value = 8; // Moderate compression ratio
    this.compressorNode.attack.value = 0.001; // Faster attack to catch transients
    this.compressorNode.release.value = 0.1; // Faster release for responsiveness
    
    // Configure additional filters
    this.setupAdvancedFilters();
    
    // Configure gain (volume normalization)
    this.gainNode.gain.value = 1.2; // Slight boost for voice clarity
    
    try {
      // Try to add custom noise gate if supported
      await this.addNoiseGate(audioContext);
    } catch (error) {
      console.log('Custom noise gate not supported, using basic filters only');
    }
    
    // Connect the audio chain
    this.connectAudioChain();
    
    console.log('🎚️ Advanced audio filters applied');
    return this.destinationNode.stream;
  }
  
  /**
   * Add custom noise gate using modern AudioWorklet or fallback to GainNode
   */
  private async addNoiseGate(audioContext: AudioContext): Promise<void> {
    try {
      // Try to use AudioWorklet for modern browsers
      if ('audioWorklet' in audioContext) {
        await this.createAudioWorkletNoiseGate(audioContext);
      } else {
        // Fallback to simple gain-based noise gate for older browsers
        this.createSimpleNoiseGate(audioContext);
      }
      
      console.log('🚪 Noise gate enabled');
      
    } catch (error) {
      console.log('Could not create noise gate, using simple gain control:', error);
      // Final fallback - just use gain control
      this.createSimpleNoiseGate(audioContext);
    }
  }

  /**
   * Create AudioWorklet-based noise gate (modern approach)
   */
  private async createAudioWorkletNoiseGate(audioContext: AudioContext): Promise<void> {
    try {
      // Create inline AudioWorklet processor
      const workletCode = `
        class NoiseGateProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this.threshold = 0.005; // Lower threshold for more aggressive gating
            this.ratio = 0.05; // More aggressive noise reduction
            this.holdTime = 0;
            this.attackTime = 32; // samples
            this.releaseTime = 1024; // samples
            this.gateState = 0; // 0 = closed, 1 = open
            this.envelope = 0;
          }
          
          process(inputs, outputs) {
            const input = inputs[0];
            const output = outputs[0];
            
            if (input.length > 0 && output.length > 0) {
              const inputChannel = input[0];
              const outputChannel = output[0];
              
              for (let i = 0; i < inputChannel.length; i++) {
                const sample = inputChannel[i];
                const amplitude = Math.abs(sample);
                
                // Smooth gate operation with attack/release
                if (amplitude > this.threshold) {
                  this.gateState = 1;
                  this.holdTime = this.releaseTime;
                } else if (this.holdTime > 0) {
                  this.holdTime--;
                } else {
                  this.gateState = 0;
                }
                
                // Smooth envelope for gate
                const targetEnvelope = this.gateState;
                if (this.envelope < targetEnvelope) {
                  this.envelope += 1 / this.attackTime;
                } else if (this.envelope > targetEnvelope) {
                  this.envelope -= 1 / this.releaseTime;
                }
                this.envelope = Math.max(0, Math.min(1, this.envelope));
                
                // Apply gate with smooth envelope
                const gateGain = this.envelope + (1 - this.envelope) * this.ratio;
                outputChannel[i] = sample * gateGain;
              }
            }
            
            return true;
          }
        }
        
        registerProcessor('noise-gate', NoiseGateProcessor);
      `;
      
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      
      await audioContext.audioWorklet.addModule(workletUrl);
      this.noiseGateNode = new AudioWorkletNode(audioContext, 'noise-gate');
      
      // Clean up the blob URL
      URL.revokeObjectURL(workletUrl);
      
    } catch (error) {
      throw new Error('AudioWorklet not supported: ' + error);
    }
  }

  /**
   * Create simple gain-based noise gate (fallback)
   */
  private createSimpleNoiseGate(audioContext: AudioContext): void {
    // Use a simple gain node as noise gate fallback
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0.8; // Slight noise reduction
    this.noiseGateNode = gainNode as any;
  }
  
  /**
   * Setup advanced filtering parameters
   */
  private setupAdvancedFilters(): void {
    if (!this.lowPassNode || !this.bandPassNode || !this.notchNode) return;
    
    // Low-pass filter to remove high-frequency noise (like electronics hiss)
    this.lowPassNode.type = 'lowpass';
    this.lowPassNode.frequency.value = 8000; // Remove frequencies above 8kHz
    this.lowPassNode.Q.value = 1;
    
    // Band-pass filter to focus on human voice frequencies
    this.bandPassNode.type = 'bandpass';
    this.bandPassNode.frequency.value = 1000; // Center frequency for voice
    this.bandPassNode.Q.value = 0.5; // Wide band for natural voice
    
    // Notch filter to remove 50/60Hz electrical hum
    this.notchNode.type = 'notch';
    this.notchNode.frequency.value = 60; // 60Hz electrical hum (US)
    this.notchNode.Q.value = 30; // Very narrow notch
  }

  /**
   * Connect all audio nodes in the processing chain
   */
  private connectAudioChain(): void {
    if (!this.sourceNode || !this.destinationNode) return;
    
    let currentNode = this.sourceNode;
    
    // Notch filter first (remove electrical hum)
    if (this.notchNode) {
      currentNode.connect(this.notchNode);
      currentNode = this.notchNode as any;
    }
    
    // High-pass filter (remove low-frequency noise)
    if (this.filterNode) {
      currentNode.connect(this.filterNode);
      currentNode = this.filterNode as any;
    }
    
    // Low-pass filter (remove high-frequency noise)
    if (this.lowPassNode) {
      currentNode.connect(this.lowPassNode);
      currentNode = this.lowPassNode as any;
    }
    
    // Noise gate (if available)
    if (this.noiseGateNode) {
      currentNode.connect(this.noiseGateNode);
      currentNode = this.noiseGateNode as any;
    }
    
    // Compressor (dynamic range control)
    if (this.compressorNode) {
      currentNode.connect(this.compressorNode);
      currentNode = this.compressorNode as any;
    }
    
    // Gain control
    if (this.gainNode) {
      currentNode.connect(this.gainNode);
      currentNode = this.gainNode as any;
    }
    
    // Final destination
    currentNode.connect(this.destinationNode);
    
    console.log('🔗 Advanced audio processing chain connected');
  }
  
  /**
   * Adjust noise gate sensitivity based on environment
   */
  adjustNoiseSensitivity(level: 'low' | 'medium' | 'high'): void {
    if (!this.gainNode || !this.filterNode || !this.compressorNode) return;
    
    const settings = {
      low: { 
        gain: 1.3, 
        threshold: 0.003,
        highPassFreq: 150,
        compressorThreshold: -20
      },      // Quiet environments - more sensitive
      medium: { 
        gain: 1.2, 
        threshold: 0.008,
        highPassFreq: 200,
        compressorThreshold: -18
      },    // Normal environments  
      high: { 
        gain: 1.0, 
        threshold: 0.015,
        highPassFreq: 300,
        compressorThreshold: -15
      }       // Noisy environments - less sensitive
    };
    
    const setting = settings[level];
    this.gainNode.gain.value = setting.gain;
    this.filterNode.frequency.value = setting.highPassFreq;
    this.compressorNode.threshold.value = setting.compressorThreshold;
    
    // Adjust low-pass filter based on environment
    if (this.lowPassNode) {
      const lowPassFreq = level === 'high' ? 6000 : level === 'medium' ? 7000 : 8000;
      this.lowPassNode.frequency.value = lowPassFreq;
    }
    
    console.log(`🎛️ Noise sensitivity set to ${level} (gain: ${setting.gain}, threshold: ${setting.threshold}, filters optimized)`);
  }
  
  /**
   * Get audio levels for visualization (using persistent analyser)
   */
  getAudioLevel(): number {
    if (!this.audioContext || !this.gainNode) return 0;
    
    // Create analyser once and reuse
    if (!this.analyser) {
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      
      // Connect to the audio chain
      if (this.gainNode) {
        this.gainNode.connect(this.analyser);
      }
      
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
    }
    
    if (!this.dataArray) return 0;
    
    // Get frequency data
    this.analyser.getByteFrequencyData(this.dataArray);
    
    // Calculate average amplitude
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    
    return sum / this.dataArray.length / 255; // Normalize to 0-1
  }
  
  /**
   * Cleanup resources
   */
  dispose(): void {
    try {
      if (this.sourceNode) {
        this.sourceNode.disconnect();
        this.sourceNode = null;
      }
      
      if (this.noiseGateNode) {
        this.noiseGateNode.disconnect();
        this.noiseGateNode = null;
      }
      
      if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
      }
      
      if (this.filterNode) {
        this.filterNode.disconnect();
        this.filterNode = null;
      }
      
      if (this.compressorNode) {
        this.compressorNode.disconnect();
        this.compressorNode = null;
      }
      
      if (this.lowPassNode) {
        this.lowPassNode.disconnect();
        this.lowPassNode = null;
      }
      
      if (this.bandPassNode) {
        this.bandPassNode.disconnect();
        this.bandPassNode = null;
      }
      
      if (this.notchNode) {
        this.notchNode.disconnect();
        this.notchNode = null;
      }
      
      if (this.analyser) {
        this.analyser.disconnect();
        this.analyser = null;
      }
      
      if (this.destinationNode) {
        this.destinationNode.disconnect();
        this.destinationNode = null;
      }
      
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }
      
      // Close audio context last
      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext.close();
        this.audioContext = null;
      }
      
      // Clear data array
      this.dataArray = null;
      
      console.log('🗑️ Audio filters disposed');
    } catch (error) {
      console.error('Error disposing audio filters:', error);
    }
  }
}

export default AudioFilters;