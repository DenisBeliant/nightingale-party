/**
 * Arcade gauges for party rounds, fed by the same ticks as pitch scoring.
 *
 * - pitch: how close the sung note is, while the singer sings over vocals;
 * - lyrics: share of the vocal time during which the singer was singing;
 * - rhythm: vocal entries caught within a short window, and staying quiet
 *   in the gaps.
 *
 * Deliberately forgiving: the goal is a readable, fun score, not a judge.
 */

export type ArcadeGaugeValues = {
  pitch: number;
  rhythm: number;
  lyrics: number;
};

export const EMPTY_GAUGES: ArcadeGaugeValues = { pitch: 0, rhythm: 0, lyrics: 0 };

/** A voice stays "active" through short unvoiced bits (consonants, breaths). */
const HANGOVER_SEC = 0.25;
/** A vocal entry counts when the singer starts within this window. */
const ONSET_WINDOW_SEC = 0.35;
const MAX_TICK_SEC = 0.1;

const percent = (part: number, whole: number): number =>
  whole <= 0 ? 0 : Math.round(Math.min(1, Math.max(0, part / whole)) * 100);

export class ArcadeGauges {
  private lastTime = 0;
  private lastRefVoiced = Number.NEGATIVE_INFINITY;
  private lastUserVoiced = Number.NEGATIVE_INFINITY;
  private refWasActive = false;
  private userWasActive = false;
  private pendingOnset: number | null = null;
  private lastUserOnset = Number.NEGATIVE_INFINITY;
  private refTime = 0;
  private bothTime = 0;
  private userTime = 0;
  private gapTime = 0;
  private pitchEarned = 0;
  private onsets = 0;
  private onsetHits = 0;

  private trackOnsets(time: number, refActive: boolean, userActive: boolean): void {
    if (userActive && !this.userWasActive) {
      this.lastUserOnset = time;
      if (this.pendingOnset !== null && time - this.pendingOnset <= ONSET_WINDOW_SEC) {
        this.onsetHits += 1;
        this.pendingOnset = null;
      }
    }
    if (refActive && !this.refWasActive) {
      this.onsets += 1;
      if (time - this.lastUserOnset <= ONSET_WINDOW_SEC) {
        this.onsetHits += 1;
      } else {
        this.pendingOnset = time;
      }
    }
    if (this.pendingOnset !== null && time - this.pendingOnset > ONSET_WINDOW_SEC) {
      this.pendingOnset = null;
    }
    this.refWasActive = refActive;
    this.userWasActive = userActive;
  }

  accumulate(time: number, refVoiced: boolean, userVoiced: boolean, similarity: number): void {
    if (time <= this.lastTime) {
      // Seeking back or a repeated tick: keep what was earned so far.
      this.lastTime = Math.min(this.lastTime, time);
      return;
    }
    const dt = Math.min(MAX_TICK_SEC, time - this.lastTime);
    this.lastTime = time;
    if (refVoiced) {
      this.lastRefVoiced = time;
    }
    if (userVoiced) {
      this.lastUserVoiced = time;
    }
    const refActive = time - this.lastRefVoiced <= HANGOVER_SEC;
    const userActive = time - this.lastUserVoiced <= HANGOVER_SEC;
    // Brief unvoiced bits inside a note earn half: forgiving, not free.
    const tickSimilarity = refVoiced && userVoiced ? similarity : 0.5;
    this.addTime(dt, refActive, userActive, tickSimilarity);
    this.trackOnsets(time, refActive, userActive);
  }

  private addTime(dt: number, refActive: boolean, userActive: boolean, similarity: number): void {
    if (refActive) {
      this.refTime += dt;
    }
    if (userActive) {
      this.userTime += dt;
    }
    if (refActive && userActive) {
      this.bothTime += dt;
      this.pitchEarned += similarity * dt;
    }
    if (userActive && !refActive) {
      this.gapTime += dt;
    }
  }

  values(): ArcadeGaugeValues {
    const timing = percent(this.onsetHits, this.onsets);
    const discipline = 100 - percent(this.gapTime, this.userTime);
    const rhythm = this.userTime > 0 ? Math.round(timing * 0.7 + discipline * 0.3) : 0;
    return {
      pitch: percent(this.pitchEarned, this.bothTime),
      rhythm,
      lyrics: percent(this.bothTime, this.refTime),
    };
  }
}

/** Overall party score, 0–100. */
export const arcadeTotal = ({ pitch, rhythm, lyrics }: ArcadeGaugeValues): number =>
  Math.round(pitch * 0.45 + rhythm * 0.25 + lyrics * 0.3);

export const sameGauges = (a: ArcadeGaugeValues, b: ArcadeGaugeValues): boolean =>
  a.pitch === b.pitch && a.rhythm === b.rhythm && a.lyrics === b.lyrics;
