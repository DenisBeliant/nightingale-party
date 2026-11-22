import { PITCH_WINDOW_SAMPLES } from '@/features/playback/lib/pitch/constants';
import { createPitchDetector, detectPitchFromSamples } from '@/features/playback/lib/pitch/detect';

export class InsecurePageError extends Error {
  constructor() {
    super('insecure page');
    this.name = 'InsecurePageError';
  }
}

/**
 * The phone's microphone for party rounds. Pitch is detected on the phone
 * with the same detector as desktop scoring; only the frequency travels.
 */
export class PhoneMic {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private readonly samples = new Float32Array(PITCH_WINDOW_SAMPLES);
  private readonly detector = createPitchDetector();

  get ready(): boolean {
    return this.analyser !== null;
  }

  /** Must run from a tap: browsers only grant the microphone after a gesture. */
  async start(): Promise<void> {
    if (this.context !== null) {
      await this.context.resume();
      return;
    }
    if (!window.isSecureContext) {
      throw new InsecurePageError();
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
    });
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = PITCH_WINDOW_SAMPLES;
    context.createMediaStreamSource(this.stream).connect(analyser);
    this.context = context;
    this.analyser = analyser;
  }

  /** Current sung pitch in Hz, `null` when silent or unvoiced. */
  readPitch(): number | null {
    if (this.analyser === null || this.context === null) {
      return null;
    }
    this.analyser.getFloatTimeDomainData(this.samples);
    return detectPitchFromSamples(this.detector, this.samples, this.context.sampleRate);
  }

  /** Loudness 0–1 for the on-screen meter (uses the last read window). */
  level(): number {
    let sum = 0;
    for (const sample of this.samples) {
      sum += sample * sample;
    }
    return Math.min(1, Math.sqrt(sum / this.samples.length) * 6);
  }

  stop(): void {
    for (const track of this.stream?.getTracks() ?? []) {
      track.stop();
    }
    void this.context?.close();
    this.stream = null;
    this.context = null;
    this.analyser = null;
  }
}
