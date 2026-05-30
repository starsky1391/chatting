"use client";

type ToneStep = {
  frequency: number;
  duration: number;
  gain: number;
  delay?: number;
  type?: OscillatorType;
};

let audioContext: AudioContext | null = null;
let audioContextIdleTimer: number | null = null;
const lastPlayedAt: Record<string, number> = {};
const AUDIO_CONTEXT_IDLE_MS = 120_000;

function scheduleAudioContextIdleCleanup() {
  if (typeof window === 'undefined') return;
  if (audioContextIdleTimer) {
    window.clearTimeout(audioContextIdleTimer);
  }
  audioContextIdleTimer = window.setTimeout(() => {
    audioContextIdleTimer = null;
    const context = audioContext;
    audioContext = null;
    if (context && context.state !== 'closed') {
      void context.close().catch(() => {});
    }
  }, AUDIO_CONTEXT_IDLE_MS);
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) return null;
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContextConstructor();
  }
  scheduleAudioContextIdleCleanup();
  return audioContext;
}

function playPattern(name: string, steps: ToneStep[]) {
  const nowMs = Date.now();
  if (nowMs - (lastPlayedAt[name] || 0) < 250) return;
  lastPlayedAt[name] = nowMs;

  const context = getAudioContext();
  if (!context) return;

  if (context.state === 'suspended') {
    void context.resume().catch(() => {});
  }
  scheduleAudioContextIdleCleanup();

  let cursor = context.currentTime + 0.01;
  steps.forEach((step) => {
    cursor += step.delay || 0;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = step.type || 'sine';
    oscillator.frequency.setValueAtTime(step.frequency, cursor);

    gain.gain.setValueAtTime(0.0001, cursor);
    gain.gain.exponentialRampToValueAtTime(step.gain, cursor + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, cursor + step.duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(cursor);
    oscillator.stop(cursor + step.duration + 0.02);

    cursor += step.duration;
  });
}

export function unlockNotificationSounds() {
  const context = getAudioContext();
  if (!context) return;
  scheduleAudioContextIdleCleanup();
  if (context.state === 'suspended') {
    void context.resume().catch(() => {});
  }
}

export function playDirectMessageSound() {
  playPattern('direct-message', [
    { frequency: 880, duration: 0.07, gain: 0.045, type: 'triangle' },
    { frequency: 1175, duration: 0.09, gain: 0.038, delay: 0.035, type: 'triangle' },
  ]);
}

export function playVoiceJoinSound() {
  playPattern('voice-join', [
    { frequency: 520, duration: 0.08, gain: 0.04, type: 'sine' },
    { frequency: 660, duration: 0.08, gain: 0.035, delay: 0.025, type: 'sine' },
    { frequency: 784, duration: 0.11, gain: 0.03, delay: 0.025, type: 'sine' },
  ]);
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
