import type { TimeRange, Transcript, Word } from "@/types/transcript";

export const TRANSCRIPT_WORD_INDEX_ATTR = "data-word-index";

export function transcriptWordElementSelector(wordIndex: number): string {
  return `[${TRANSCRIPT_WORD_INDEX_ATTR}="${wordIndex}"]`;
}

export function getSpeechWordIndices(words: Word[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < words.length; i++) {
    if (words[i].type === "word") out.push(i);
  }
  return out;
}

export function findActiveSpeechWordIndex(
  words: Word[],
  speechIndices: number[],
  time: number,
): number {
  if (speechIndices.length === 0) return -1;
  let lo = 0;
  let hi = speechIndices.length - 1;
  let bestSpeechIdx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const wordIndex = speechIndices[mid];
    const w = words[wordIndex];
    if (w.start <= time) {
      bestSpeechIdx = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (bestSpeechIdx === -1) return -1;
  const wordIndex = speechIndices[bestSpeechIdx];
  const w = words[wordIndex];
  if (time >= w.start && time < w.end) return bestSpeechIdx;
  return -1;
}

export function mergeRanges(ranges: TimeRange[]): TimeRange[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const out: TimeRange[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = out[out.length - 1];
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

export function addSkippedRange(
  existing: TimeRange[],
  start: number,
  end: number,
): TimeRange[] {
  if (end <= start) return existing;
  return mergeRanges([...existing, { start, end }]);
}

export function removeRangeCoveringTime(
  ranges: TimeRange[],
  time: number,
): TimeRange[] {
  return ranges.filter((r) => !(time >= r.start && time < r.end));
}

export function findSkipRangeAtTime(
  ranges: TimeRange[],
  time: number,
): TimeRange | undefined {
  return ranges.find((r) => time >= r.start && time < r.end);
}

export function wordIndicesToTimeRange(words: Word[], indices: number[]): TimeRange | null {
  if (indices.length === 0) return null;
  let start = Infinity;
  let end = -Infinity;
  for (const i of indices) {
    const w = words[i];
    start = Math.min(start, w.start);
    end = Math.max(end, w.end);
  }
  if (!Number.isFinite(start) || end <= start) return null;
  return { start, end };
}

export function isWordOverlappingSkip(
  word: Word,
  ranges: TimeRange[],
): boolean {
  return ranges.some((r) => word.end > r.start && word.start < r.end);
}

export function transcriptFromJson(data: unknown): Transcript {
  const t = data as Transcript;
  if (!t || typeof t.text !== "string" || !Array.isArray(t.words)) {
    throw new Error("Invalid transcript payload");
  }
  return t;
}
