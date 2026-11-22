import type { PitchSeries } from '@/features/playback/lib/pitch/state';
import { freqToSemitone } from '@/features/playback/lib/pitch/state';
import type { Rgb } from '@/types/Rgb';

type CanvasLayout = {
  width: number;
  height: number;
  paddingX: number;
  paddingY: number;
  plotWidth: number;
  plotHeight: number;
  lineWidth: number;
  /** Lowest semitone at the bottom of the plot, and how many fit above it. */
  lowest: number;
  range: number;
  /** Where "now" sits across the plot: 0.5 is centred, smaller shows more of what is coming. */
  cursorRatio: number;
  stage: boolean;
};

type PlotPoint = {
  x: number;
  y: number;
  color: Rgb;
  alpha: number;
};

export type PitchGraphNotes = {
  reference: number | null;
  singers: { note: number; color?: Rgb }[];
};

export type PitchGraphPlayer = {
  series: PitchSeries;
  color: Rgb;
};

type RenderPitchGraphInput = {
  canvas: HTMLCanvasElement;
  windowHeight: number;
  windowWidth: number;
  scale: number;
  series: PitchSeries;
  players: PitchGraphPlayer[];
  notes: PitchGraphNotes;
  /** Party "game show" lane: wide, tall, notes as bars flowing to a yellow cursor. */
  stage?: boolean;
};

const BASE_DISPLAY_WIDTH = 400;
const BASE_DISPLAY_HEIGHT = 44;
const REFERENCE_HEIGHT = 1080;
const MIN_DISPLAY_SCALE = 0.85;

const LOWEST_VISIBLE_SEMITONE = 45;
const VISIBLE_SEMITONE_RANGE = 36;
const GRAPH_WINDOW_SECONDS = 3.3;
const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

const OLDEST_POINT_ALPHA = 0.25;
const NEWEST_POINT_ALPHA = 1.0;

const REF_LINE_COLOR: Rgb = { r: 0.5, g: 0.7, b: 1.0 };
const REF_LINE_ALPHA = 0.55;

const USER_BASE_COLOR: Rgb = { r: 0.85, g: 0.85, b: 1.0 };
const USER_ALPHA_WITHOUT_REF = 0.55;
const USER_ALPHA_MIN_WITH_REF = 0.35;
const USER_ALPHA_MAX_WITH_REF = 1.0;

const SIMILARITY_GOOD: Rgb = { r: 0.2, g: 0.9, b: 0.3 };
const SIMILARITY_OK: Rgb = { r: 0.95, g: 0.8, b: 0.1 };
const SIMILARITY_BAD: Rgb = { r: 0.9, g: 0.2, b: 0.2 };
const SIMILARITY_OK_THRESHOLD = 0.7;

function displayScale(windowHeight: number): number {
  return Math.max(MIN_DISPLAY_SCALE, windowHeight / REFERENCE_HEIGHT);
}

/** Party lane: a narrower note range so each note is a thick bar. */
const STAGE_SEMITONE_RANGE = 16;
const STAGE_CURSOR_RATIO = 0.22;
const STAGE_CURSOR_COLOR = '#FACC15';
const STAGE_BAR_COLOR = '#4A6BF7';
const STAGE_BAR_SUNG_COLOR = '#2B3FA8';
const STAGE_BAR_SHADOW = 'rgba(16,24,80,0.85)';

function computeStageLayout(windowHeight: number, windowWidth: number): CanvasLayout {
  const width = Math.max(240, Math.min(windowWidth - 48, 1800));
  const height = Math.min(280, Math.max(100, windowHeight * 0.22));
  const paddingX = 14;
  const paddingY = 12;
  return {
    width,
    height,
    paddingX,
    paddingY,
    plotWidth: width - paddingX * 2,
    plotHeight: height - paddingY * 2,
    lineWidth: Math.max(4, height / 36),
    lowest: LOWEST_VISIBLE_SEMITONE,
    range: STAGE_SEMITONE_RANGE,
    cursorRatio: STAGE_CURSOR_RATIO,
    stage: true,
  };
}

function computeLayout(windowHeight: number, windowWidth: number, userScale: number): CanvasLayout {
  const scale = displayScale(windowHeight) * userScale;
  const width = Math.min(BASE_DISPLAY_WIDTH * scale, Math.max(240, windowWidth - 32));
  const height = BASE_DISPLAY_HEIGHT * scale;
  const paddingX = 8 * scale;
  const paddingY = 6 * scale;

  return {
    width,
    height,
    paddingX,
    paddingY,
    plotWidth: width - paddingX * 2,
    plotHeight: height - paddingY * 2,
    lineWidth: Math.max(2.25, 2 * scale),
    lowest: LOWEST_VISIBLE_SEMITONE,
    range: VISIBLE_SEMITONE_RANGE,
    cursorRatio: 0.5,
    stage: false,
  };
}

function lerpRgb(from: Rgb, to: Rgb, t: number): Rgb {
  return {
    r: from.r + (to.r - from.r) * t,
    g: from.g + (to.g - from.g) * t,
    b: from.b + (to.b - from.b) * t,
  };
}

function similarityToColor(similarity: number): Rgb {
  if (similarity >= SIMILARITY_OK_THRESHOLD) {
    const t = (similarity - SIMILARITY_OK_THRESHOLD) / (1 - SIMILARITY_OK_THRESHOLD);
    return lerpRgb(SIMILARITY_OK, SIMILARITY_GOOD, t);
  }

  const t = Math.max(0, similarity / SIMILARITY_OK_THRESHOLD);
  return lerpRgb(SIMILARITY_BAD, SIMILARITY_OK, t);
}

function rgbaString({ r, g, b }: Rgb, alpha: number): string {
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${alpha})`;
}

function semitoneToY(semitone: number, layout: CanvasLayout): number {
  const normalized = Math.min(1, Math.max(0, (semitone - layout.lowest) / layout.range));

  return layout.paddingY + (1 - normalized) * layout.plotHeight;
}

function currentX(layout: CanvasLayout): number {
  return layout.paddingX + layout.plotWidth * layout.cursorRatio;
}

function timeToX(timeOffset: number, layout: CanvasLayout): number {
  const side = timeOffset < 0 ? layout.cursorRatio : 1 - layout.cursorRatio;
  return currentX(layout) + (timeOffset / GRAPH_WINDOW_SECONDS) * layout.plotWidth * side;
}

function ageAlpha(index: number, seriesLength: number): number {
  const t = index / Math.max(1, seriesLength - 1);

  return OLDEST_POINT_ALPHA + (NEWEST_POINT_ALPHA - OLDEST_POINT_ALPHA) * t;
}

function setupCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
): void {
  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.floor(layout.width * dpr);
  canvas.height = Math.floor(layout.height * dpr);
  canvas.style.width = `${layout.width}px`;
  canvas.style.height = `${layout.height}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, layout.width, layout.height);
}

function tracePath(ctx: CanvasRenderingContext2D, points: PlotPoint[]): void {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
}

function strokeUniformSegment(
  ctx: CanvasRenderingContext2D,
  points: PlotPoint[],
  lineWidth: number,
): void {
  if (points.length < 2) {
    return;
  }

  tracePath(ctx, points);

  ctx.strokeStyle = rgbaString(points[0].color, points[0].alpha);
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function strokeGradientSegment(
  ctx: CanvasRenderingContext2D,
  points: PlotPoint[],
  lineWidth: number,
): void {
  if (points.length < 2) {
    return;
  }

  tracePath(ctx, points);

  const gradient = ctx.createLinearGradient(points[0].x, 0, points[points.length - 1].x, 0);
  for (let i = 0; i < points.length; i++) {
    gradient.addColorStop(i / (points.length - 1), rgbaString(points[i].color, points[i].alpha));
  }

  ctx.strokeStyle = gradient;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function buildSegments<T>(
  values: readonly (number | null)[],
  toPoint: (value: number, index: number) => T,
): T[][] {
  const segments: T[][] = [];
  let current: T[] = [];

  for (let i = 0; i < values.length; i++) {
    const value = values[i];

    if (value === null) {
      if (current.length >= 2) {
        segments.push(current);
      }
      current = [];
      continue;
    }

    current.push(toPoint(value, i));
  }

  if (current.length >= 2) {
    segments.push(current);
  }

  return segments;
}

function buildReferenceTrackPoint(
  hz: number,
  time: number,
  series: PitchSeries,
  layout: CanvasLayout,
): PlotPoint {
  return {
    x: timeToX(time - series.referenceTime, layout),
    y: semitoneToY(freqToSemitone(hz), layout),
    color: REF_LINE_COLOR,
    alpha: REF_LINE_ALPHA,
  };
}

function userPointStyle(
  similarity: number,
  hasRef: boolean,
  baseColor: Rgb,
): { color: Rgb; weight: number } {
  if (!hasRef) {
    return { color: baseColor, weight: USER_ALPHA_WITHOUT_REF };
  }

  return {
    color: lerpRgb(baseColor, similarityToColor(similarity), similarity),
    weight:
      USER_ALPHA_MIN_WITH_REF + similarity * (USER_ALPHA_MAX_WITH_REF - USER_ALPHA_MIN_WITH_REF),
  };
}

type UserPointInput = {
  displaySemitone: number;
  index: number;
  series: PitchSeries;
  layout: CanvasLayout;
  baseColor: Rgb;
};

function buildUserPoint({
  displaySemitone,
  index,
  series,
  layout,
  baseColor,
}: UserPointInput): PlotPoint {
  const seriesLength = series.userPitches.length;
  const refHz = series.refPitches[index];
  const similarity = series.similarities[index] ?? 0;
  const { color, weight } = userPointStyle(similarity, refHz !== null, baseColor);

  return {
    x: timeToX((series.times[index] ?? series.currentTime) - series.currentTime, layout),
    y: semitoneToY(displaySemitone, layout),
    color,
    alpha: weight * ageAlpha(index, seriesLength),
  };
}

type DrawPitchSeriesInput = {
  ctx: CanvasRenderingContext2D;
  layout: CanvasLayout;
  series: PitchSeries;
  baseColor?: Rgb;
  includeReference?: boolean;
};

function buildReferenceTrackSegments(series: PitchSeries, layout: CanvasLayout): PlotPoint[][] {
  const track = series.referenceTrack;
  if (!track) {
    return [];
  }

  const start = Math.max(
    0,
    Math.floor((series.referenceTime - GRAPH_WINDOW_SECONDS) / track.intervalSec),
  );
  const end = Math.min(
    track.pitches.length,
    Math.ceil((series.referenceTime + GRAPH_WINDOW_SECONDS) / track.intervalSec) + 1,
  );

  return buildSegments(track.pitches.slice(start, end), (hz, index) =>
    buildReferenceTrackPoint(hz, (start + index) * track.intervalSec, series, layout),
  );
}

function drawPitchSeries({
  ctx,
  layout,
  series,
  baseColor = USER_BASE_COLOR,
  includeReference = true,
}: DrawPitchSeriesInput): void {
  const firstVisibleTime = series.currentTime - GRAPH_WINDOW_SECONDS;
  const firstVisibleIndex = series.times.findIndex((time) => time >= firstVisibleTime);
  const historyStart = firstVisibleIndex < 0 ? 0 : firstVisibleIndex;
  const visibleSeries: PitchSeries = {
    refPitches: series.refPitches.slice(historyStart),
    userPitches: series.userPitches.slice(historyStart),
    displaySemitones: series.displaySemitones.slice(historyStart),
    similarities: series.similarities.slice(historyStart),
    times: series.times.slice(historyStart),
    referenceTrack: series.referenceTrack,
    referenceTime: series.referenceTime,
    currentTime: series.currentTime,
  };

  if (includeReference) {
    for (const segment of buildReferenceTrackSegments(series, layout)) {
      strokeUniformSegment(ctx, segment, layout.lineWidth);
    }
  }

  const userSegments = buildSegments(visibleSeries.displaySemitones, (displaySemitone, index) =>
    buildUserPoint({ displaySemitone, index, series: visibleSeries, layout, baseColor }),
  );

  for (const segment of userSegments) {
    strokeGradientSegment(ctx, segment, layout.lineWidth);
  }
}

export function pitchNoteIndex(hz: number): number {
  const semitone = Math.round(freqToSemitone(hz));

  return ((semitone % NOTE_NAMES.length) + NOTE_NAMES.length) % NOTE_NAMES.length;
}

function drawCurrentLine(ctx: CanvasRenderingContext2D, layout: CanvasLayout): void {
  ctx.beginPath();
  ctx.moveTo(currentX(layout), layout.paddingY / 2);
  ctx.lineTo(currentX(layout), layout.height - layout.paddingY / 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.72)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawNoteBadge(
  ctx: CanvasRenderingContext2D,
  note: number,
  color: Rgb,
  index: number,
): void {
  const x = 6 + index * 27;
  const y = 5;

  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.beginPath();
  ctx.roundRect(x, y, 23, 16, 4);
  ctx.fill();
  ctx.fillStyle = rgbaString(color, 1);
  ctx.font = '600 10px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(NOTE_NAMES[note], x + 11.5, y + 8);
}

function drawCurrentNotes(
  ctx: CanvasRenderingContext2D,
  { reference, singers }: PitchGraphNotes,
): void {
  const onlySinger = singers.length === 1 ? singers[0] : null;
  if (reference !== null && onlySinger?.note === reference) {
    drawNoteBadge(ctx, reference, SIMILARITY_GOOD, 0);
    return;
  }

  let badgeIndex = 0;
  if (reference !== null) {
    drawNoteBadge(ctx, reference, REF_LINE_COLOR, badgeIndex++);
  }
  for (const singer of singers) {
    drawNoteBadge(
      ctx,
      singer.note,
      reference === singer.note ? SIMILARITY_GOOD : (singer.color ?? USER_BASE_COLOR),
      badgeIndex++,
    );
  }
}

/** Index range of the reference track around now. */
function trackWindow(series: PitchSeries): { start: number; end: number } | null {
  const track = series.referenceTrack;
  if (!track) {
    return null;
  }
  return {
    start: Math.max(
      0,
      Math.floor((series.referenceTime - GRAPH_WINDOW_SECONDS) / track.intervalSec),
    ),
    end: Math.min(
      track.pitches.length,
      Math.ceil((series.referenceTime + GRAPH_WINDOW_SECONDS) / track.intervalSec) + 1,
    ),
  };
}

const roundedSemitone = (hz: number | null): number | null =>
  hz === null || hz <= 0 ? null : Math.round(freqToSemitone(hz));

/** Centres the party lane on the current melody, moving in whole semitones. */
function centreStageLayout(layout: CanvasLayout, series: PitchSeries): CanvasLayout {
  const range = trackWindow(series);
  const track = series.referenceTrack;
  if (range === null || track === null) {
    return layout;
  }
  const semitones = track.pitches
    .slice(range.start, range.end)
    .flatMap((hz) => {
      const semitone = roundedSemitone(hz);
      return semitone === null ? [] : [semitone];
    })
    .toSorted((a, b) => a - b);
  if (semitones.length === 0) {
    return layout;
  }
  const median = semitones[Math.floor(semitones.length / 2)];
  return { ...layout, lowest: Math.round(median - layout.range / 2) };
}

type NoteBar = { from: number; to: number; semitone: number };

/** Reference melody as note bars: runs of the same rounded semitone. */
function referenceBars(series: PitchSeries): NoteBar[] {
  const range = trackWindow(series);
  const track = series.referenceTrack;
  if (range === null || track === null) {
    return [];
  }
  const bars: NoteBar[] = [];
  let open: NoteBar | null = null;
  for (let i = range.start; i < range.end; i++) {
    const semitone = roundedSemitone(track.pitches[i] ?? null);
    const time = i * track.intervalSec;
    if (open !== null && semitone === open.semitone) {
      open.to = time + track.intervalSec;
      continue;
    }
    open = semitone === null ? null : { from: time, to: time + track.intervalSec, semitone };
    if (open !== null) {
      bars.push(open);
    }
  }
  return bars;
}

function drawStageLanes(ctx: CanvasRenderingContext2D, layout: CanvasLayout): void {
  ctx.strokeStyle = 'rgba(117,148,255,0.09)';
  ctx.lineWidth = 1;
  for (let step = 0; step <= layout.range; step += 2) {
    const y = semitoneToY(layout.lowest + step, layout);
    ctx.beginPath();
    ctx.moveTo(layout.paddingX, y);
    ctx.lineTo(layout.width - layout.paddingX, y);
    ctx.stroke();
  }
}

function drawStageBars(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  series: PitchSeries,
): void {
  const barHeight = Math.max(8, (layout.plotHeight / layout.range) * 0.85);
  for (const bar of referenceBars(series)) {
    const x = timeToX(bar.from - series.referenceTime, layout);
    const width = Math.max(barHeight, timeToX(bar.to - series.referenceTime, layout) - x);
    const y = semitoneToY(bar.semitone, layout) - barHeight / 2;
    ctx.fillStyle = STAGE_BAR_SHADOW;
    ctx.beginPath();
    ctx.roundRect(x, y + 3, width, barHeight, barHeight / 2);
    ctx.fill();
    ctx.fillStyle = bar.to < series.referenceTime ? STAGE_BAR_SUNG_COLOR : STAGE_BAR_COLOR;
    ctx.beginPath();
    ctx.roundRect(x, y, width, barHeight, barHeight / 2);
    ctx.fill();
  }
}

function drawStageCursor(ctx: CanvasRenderingContext2D, layout: CanvasLayout): void {
  ctx.save();
  ctx.shadowColor = STAGE_CURSOR_COLOR;
  ctx.shadowBlur = 12;
  ctx.fillStyle = STAGE_CURSOR_COLOR;
  ctx.fillRect(currentX(layout) - 2, 0, 4, layout.height);
  ctx.restore();
}

function drawSingers(
  ctx: CanvasRenderingContext2D,
  layout: CanvasLayout,
  { series, players }: Pick<RenderPitchGraphInput, 'series' | 'players'>,
): void {
  if (players.length === 0) {
    drawPitchSeries({ ctx, layout, series, includeReference: !layout.stage });
    return;
  }
  players.forEach((player, index) => {
    drawPitchSeries({
      ctx,
      layout,
      series: player.series,
      baseColor: player.color,
      includeReference: !layout.stage && index === 0,
    });
  });
}

function renderStage(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  input: RenderPitchGraphInput,
): void {
  const reference = input.players.at(0)?.series ?? input.series;
  const layout = centreStageLayout(
    computeStageLayout(input.windowHeight, input.windowWidth),
    reference,
  );
  setupCanvas(canvas, ctx, layout);
  drawStageLanes(ctx, layout);
  drawStageBars(ctx, layout, reference);
  drawSingers(ctx, layout, input);
  drawStageCursor(ctx, layout);
}

export function renderPitchGraph({
  canvas,
  windowHeight,
  windowWidth,
  scale,
  series,
  players,
  notes,
  stage,
}: RenderPitchGraphInput): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  if (stage === true) {
    renderStage(ctx, canvas, { canvas, windowHeight, windowWidth, scale, series, players, notes });
    return;
  }

  const layout = computeLayout(windowHeight, windowWidth, scale);
  setupCanvas(canvas, ctx, layout);
  drawSingers(ctx, layout, { series, players });
  drawCurrentLine(ctx, layout);
  drawCurrentNotes(ctx, notes);
}
