class ChatNoiseSuppressorProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.enabled = false;
    this.noiseFloor = 0.006;
    this.envelope = 0;
    this.gain = 1;
    this.holdSamples = 0;
    this.maxReduction = 0.18;
    this.openMultiplier = 3.2;
    this.closeMultiplier = 2.2;
    this.minOpenThreshold = 0.012;

    this.port.onmessage = (event) => {
      const data = event.data || {};
      if (data.type !== 'configure') return;
      this.enabled = Boolean(data.enabled);
      if (typeof data.maxReduction === 'number') {
        this.maxReduction = Math.max(0.05, Math.min(0.5, data.maxReduction));
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !output || input.length === 0) {
      return true;
    }

    const channelCount = Math.min(input.length, output.length);
    if (!this.enabled) {
      for (let channel = 0; channel < channelCount; channel += 1) {
        output[channel].set(input[channel]);
      }
      return true;
    }

    const frameCount = input[0].length;
    for (let sampleIndex = 0; sampleIndex < frameCount; sampleIndex += 1) {
      let mixedLevel = 0;
      for (let channel = 0; channel < channelCount; channel += 1) {
        mixedLevel += Math.abs(input[channel][sampleIndex] || 0);
      }
      mixedLevel /= channelCount || 1;

      const envelopeAlpha = mixedLevel > this.envelope ? 0.18 : 0.035;
      this.envelope += (mixedLevel - this.envelope) * envelopeAlpha;

      const likelyNoiseOnly = this.envelope < Math.max(this.noiseFloor * 2.4, 0.02);
      const floorAlpha = likelyNoiseOnly ? 0.0025 : 0.00015;
      this.noiseFloor += (mixedLevel - this.noiseFloor) * floorAlpha;
      this.noiseFloor = Math.max(0.0008, Math.min(this.noiseFloor, 0.04));

      const openThreshold = Math.max(this.noiseFloor * this.openMultiplier, this.minOpenThreshold);
      const closeThreshold = Math.max(this.noiseFloor * this.closeMultiplier, this.minOpenThreshold * 0.65);
      let targetGain = this.gain;

      if (this.envelope >= openThreshold) {
        this.holdSamples = Math.floor(sampleRate * 0.12);
        targetGain = 1;
      } else if (this.envelope <= closeThreshold && this.holdSamples <= 0) {
        const ratio = Math.max(0, Math.min(1, this.envelope / closeThreshold));
        targetGain = this.maxReduction + (1 - this.maxReduction) * ratio * ratio;
      } else {
        this.holdSamples -= 1;
        targetGain = 1;
      }

      const gainAlpha = targetGain > this.gain ? 0.12 : 0.018;
      this.gain += (targetGain - this.gain) * gainAlpha;

      for (let channel = 0; channel < channelCount; channel += 1) {
        output[channel][sampleIndex] = input[channel][sampleIndex] * this.gain;
      }
    }

    return true;
  }
}

registerProcessor('chat-noise-suppressor', ChatNoiseSuppressorProcessor);
