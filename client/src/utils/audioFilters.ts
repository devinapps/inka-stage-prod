// Audio filtering utilities for noise reduction and enhancement
export class AudioFilters {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private noiseGateNode: AudioWorkletNode | null = null;
  private gainNode: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  
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
      // Request microphone with built-in noise suppression
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Enable native browser noise suppression
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
          // Optimize for voice
          sampleRate: 44100,
          channelCount: 1
        }
      });
      
      console.log('✅ Microphone stream acquired with native noise suppression');
      return await this.applyAdvancedFilters(stream);
      
    } catch (error) {
      console.error('❌ Error getting microphone with filters:', error);
      // Fallback to basic microphone access
      return navigator.mediaDevices.getUserMedia({ 
        audio: { 
          noiseSuppression: true,
          echoCancellation: true 
        } 
      });
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
    
    // Configure high-pass filter to remove low-frequency noise
    this.filterNode.type = 'highpass';
    this.filterNode.frequency.value = 85; // Remove frequencies below 85Hz (traffic, AC noise)
    this.filterNode.Q.value = 1;
    
    // Configure compressor for dynamic range control
    this.compressorNode.threshold.value = -24;
    this.compressorNode.knee.value = 30;
    this.compressorNode.ratio.value = 12;
    this.compressorNode.attack.value = 0.003;
    this.compressorNode.release.value = 0.25;
    
    // Configure gain (volume normalization)
    this.gainNode.gain.value = 1.0;
    
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
   * Add custom noise gate using ScriptProcessor (fallback for older browsers)
   */
  private async addNoiseGate(audioContext: AudioContext): Promise<void> {
    try {
      // Create script processor for custom noise gate
      const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
      const threshold = 0.01; // Noise gate threshold (adjust based on environment)
      const ratio = 0.1; // Amount to reduce noise by when below threshold
      
      scriptProcessor.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer.getChannelData(0);
        const outputBuffer = event.outputBuffer.getChannelData(0);
        
        for (let i = 0; i < inputBuffer.length; i++) {
          const sample = inputBuffer[i];
          const amplitude = Math.abs(sample);
          
          if (amplitude > threshold) {
            // Above threshold - pass through
            outputBuffer[i] = sample;
          } else {
            // Below threshold - reduce gain (noise gate)
            outputBuffer[i] = sample * ratio;
          }
        }
      };
      
      // Insert noise gate into chain
      this.noiseGateNode = scriptProcessor as any;
      console.log('🚪 Noise gate enabled');
      
    } catch (error) {
      console.log('Could not create noise gate:', error);
    }
  }
  
  /**
   * Connect all audio nodes in the processing chain
   */
  private connectAudioChain(): void {
    if (!this.sourceNode || !this.destinationNode) return;
    
    let currentNode = this.sourceNode;
    
    // High-pass filter (remove low-frequency noise)
    if (this.filterNode) {
      currentNode.connect(this.filterNode);
      currentNode = this.filterNode as any;
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
    
    console.log('🔗 Audio processing chain connected');
  }
  
  /**
   * Adjust noise gate sensitivity based on environment
   */
  adjustNoiseSensitivity(level: 'low' | 'medium' | 'high'): void {
    if (!this.gainNode) return;
    
    const settings = {
      low: { gain: 1.2, threshold: 0.005 },      // Quiet environments
      medium: { gain: 1.0, threshold: 0.01 },    // Normal environments  
      high: { gain: 0.8, threshold: 0.02 }       // Noisy environments (supermarket, etc)
    };
    
    const setting = settings[level];
    this.gainNode.gain.value = setting.gain;
    
    console.log(`🎛️ Noise sensitivity set to ${level} (gain: ${setting.gain}, threshold: ${setting.threshold})`);
  }
  
  /**
   * Get audio levels for visualization
   */
  getAudioLevel(): number {
    if (!this.audioContext || !this.gainNode) return 0;
    
    // Create analyser for level detection
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 256;
    
    if (this.gainNode) {
      this.gainNode.connect(analyser);
    }
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);
    
    // Calculate average amplitude
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    
    return sum / bufferLength / 255; // Normalize to 0-1
  }
  
  /**
   * Cleanup resources
   */
  dispose(): void {
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
    
    if (this.destinationNode) {
      this.destinationNode.disconnect();
      this.destinationNode = null;
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    console.log('🗑️ Audio filters disposed');
  }
}

export default AudioFilters;