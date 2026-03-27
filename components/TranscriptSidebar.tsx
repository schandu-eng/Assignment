"use client";

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type MouseEvent,
  type MutableRefObject,
  type RefObject,
} from "react";
import { burstSeekConfetti } from "@/lib/seekConfetti";
import {
  findActiveSpeechWordIndex,
  getSpeechWordIndices,
  isWordOverlappingSkip,
  transcriptWordElementSelector,
  TRANSCRIPT_WORD_INDEX_ATTR,
  wordIndicesToTimeRange,
} from "@/lib/transcript";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  addSkipRange,
  clearAllSkips,
  removeSkipAtPlaybackTime,
  setBorderRadius,
  setPadding,
} from "@/store/playerSlice";
import type { TimeRange, Transcript, Word } from "@/types/transcript";

const WORDS_PER_SCROLL_BLOCK = 40;
const WORD_INDEX_JUMP_FULL_SYNC = 20;

const HIGHLIGHT_SMOOTH_POSITION = 0.22;
const HIGHLIGHT_SMOOTH_WIDTH = 0.38;
const HIGHLIGHT_SMOOTH_OPACITY = 0.35;

type WordHighlightState = "skipped" | "space" | "active" | "past" | "future";

function classifyWordHighlightState(
  wordIndex: number,
  activeWordIndex: number,
  word: Word,
  isSkipped: boolean,
): WordHighlightState {
  if (isSkipped) return "skipped";
  if (word.type !== "word") return "space";
  if (activeWordIndex >= 0 && wordIndex === activeWordIndex) return "active";
  if (activeWordIndex >= 0 && wordIndex < activeWordIndex) return "past";
  return "future";
}

const WORD_SPAN_BASE =
  "relative z-10 cursor-pointer rounded px-1 py-0 font-medium align-baseline";

function classNameForHighlightState(state: WordHighlightState): string {
  switch (state) {
    case "skipped":
      return `${WORD_SPAN_BASE} text-zinc-400 line-through decoration-zinc-400`;
    case "space":
      return "relative z-10 select-none py-0 font-medium text-zinc-800";
    case "active":
      return `${WORD_SPAN_BASE} text-zinc-950`;
    case "past":
      return `${WORD_SPAN_BASE} text-violet-700`;
    default:
      return `${WORD_SPAN_BASE} text-zinc-800`;
  }
}

function updateWordSpanClass(
  element: HTMLElement | null,
  wordIndex: number,
  words: Word[],
  skippedRanges: TimeRange[],
  activeWordIndex: number,
) {
  if (!element) return;
  const word = words[wordIndex];
  if (!word) return;
  const skipped = isWordOverlappingSkip(word, skippedRanges);
  const state = classifyWordHighlightState(
    wordIndex,
    activeWordIndex,
    word,
    skipped,
  );
  element.className = classNameForHighlightState(state);
}

function refreshAllWordSpanClasses(
  scrollContainer: Element,
  words: Word[],
  skippedRanges: TimeRange[],
  activeWordIndex: number,
) {
  scrollContainer
    .querySelectorAll(`[${TRANSCRIPT_WORD_INDEX_ATTR}]`)
    .forEach((node) => {
      const index = Number((node as HTMLElement).dataset.wordIndex);
      if (!Number.isFinite(index)) return;
      updateWordSpanClass(
        node as HTMLElement,
        index,
        words,
        skippedRanges,
        activeWordIndex,
      );
    });
}

type HighlightMotion = {
  left: number;
  top: number;
  width: number;
  height: number;
  opacity: number;
};

const TranscriptWordSpan = memo(
  function TranscriptWordSpan({
    word,
    wordIndex,
    words,
    isSkipped,
    skippedRanges,
    onWordClick,
    activeWordIndexRef,
  }: {
    word: Word;
    wordIndex: number;
    words: Word[];
    isSkipped: boolean;
    skippedRanges: TimeRange[];
    onWordClick: (event: MouseEvent, word: Word) => void;
    activeWordIndexRef: MutableRefObject<number>;
  }) {
    const spanRef = useRef<HTMLSpanElement>(null);
    useLayoutEffect(() => {
      const el = spanRef.current;
      if (!el) return;
      updateWordSpanClass(
        el,
        wordIndex,
        words,
        skippedRanges,
        activeWordIndexRef.current,
      );
    }, [wordIndex, word, isSkipped, words, skippedRanges, activeWordIndexRef]);

    const state = classifyWordHighlightState(
      wordIndex,
      activeWordIndexRef.current,
      word,
      isSkipped,
    );
    return (
      <span
        ref={spanRef}
        data-word-index={wordIndex}
        className={classNameForHighlightState(state)}
        onClick={(event) => onWordClick(event, word)}
      >
        {word.text}
      </span>
    );
  },
  (prev, next) =>
    prev.word === next.word &&
    prev.wordIndex === next.wordIndex &&
    prev.isSkipped === next.isSkipped &&
    prev.onWordClick === next.onWordClick &&
    prev.activeWordIndexRef === next.activeWordIndexRef &&
    prev.words === next.words &&
    prev.skippedRanges === next.skippedRanges,
);

const ScriptPanel = memo(function ScriptPanel({
  words,
  videoElement,
  videoRef,
}: {
  words: Word[];
  videoElement: HTMLVideoElement | null;
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  const dispatch = useAppDispatch();
  const skippedRanges = useAppSelector((s) => s.player.skippedRanges);

  const speechWordIndices = useMemo(
    () => getSpeechWordIndices(words),
    [words],
  );

  const activeWordIndexRef = useRef(-1);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textInnerRef = useRef<HTMLDivElement>(null);
  const readHighlightRef = useRef<HTMLDivElement>(null);
  const highlightMotionRef = useRef<HighlightMotion>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    opacity: 0,
  });

  const lastScrollBlockRef = useRef(-1);

  useEffect(() => {
    const video = videoElement;
    const scrollEl = scrollContainerRef.current;
    if (!video || !scrollEl) return;
    const speechIdx = findActiveSpeechWordIndex(
      words,
      speechWordIndices,
      video.currentTime,
    );
    const wordIndex = speechIdx < 0 ? -1 : speechWordIndices[speechIdx];
    activeWordIndexRef.current = wordIndex;
    lastScrollBlockRef.current =
      wordIndex >= 0 ? Math.floor(wordIndex / WORDS_PER_SCROLL_BLOCK) : -1;
    const frame = requestAnimationFrame(() => {
      refreshAllWordSpanClasses(
        scrollEl,
        words,
        skippedRanges,
        activeWordIndexRef.current,
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [videoElement, words, speechWordIndices, skippedRanges]);

  useEffect(() => {
    const scrollEl = scrollContainerRef.current;
    if (!scrollEl) return;
    refreshAllWordSpanClasses(
      scrollEl,
      words,
      skippedRanges,
      activeWordIndexRef.current,
    );
  }, [skippedRanges, words]);

  useEffect(() => {
    const scrollEl = scrollContainerRef.current;
    const textInner = textInnerRef.current;
    const highlightEl = readHighlightRef.current;
    const video = videoElement;
    if (!scrollEl || !textInner || !highlightEl || !video) return;

    const rafRef = { id: 0 };

    const tick = () => {
      const time = video.currentTime;
      const speechIdx = findActiveSpeechWordIndex(
        words,
        speechWordIndices,
        time,
      );
      const currentWordIndex =
        speechIdx < 0 ? -1 : speechWordIndices[speechIdx];
      const previousWordIndex = activeWordIndexRef.current;

      if (currentWordIndex !== previousWordIndex) {
        activeWordIndexRef.current = currentWordIndex;
        const largeJump =
          previousWordIndex < 0 ||
          currentWordIndex < 0 ||
          Math.abs(currentWordIndex - previousWordIndex) >
            WORD_INDEX_JUMP_FULL_SYNC;
        if (largeJump) {
          refreshAllWordSpanClasses(
            scrollEl,
            words,
            skippedRanges,
            currentWordIndex,
          );
        } else {
          if (previousWordIndex >= 0) {
            updateWordSpanClass(
              scrollEl.querySelector(
                transcriptWordElementSelector(previousWordIndex),
              ),
              previousWordIndex,
              words,
              skippedRanges,
              currentWordIndex,
            );
          }
          if (currentWordIndex >= 0) {
            updateWordSpanClass(
              scrollEl.querySelector(
                transcriptWordElementSelector(currentWordIndex),
              ),
              currentWordIndex,
              words,
              skippedRanges,
              currentWordIndex,
            );
          }
        }

        const blockIndex =
          currentWordIndex >= 0
            ? Math.floor(currentWordIndex / WORDS_PER_SCROLL_BLOCK)
            : -1;
        if (
          blockIndex >= 0 &&
          blockIndex !== lastScrollBlockRef.current
        ) {
          lastScrollBlockRef.current = blockIndex;
          const target = scrollEl.querySelector(
            transcriptWordElementSelector(currentWordIndex),
          ) as HTMLElement | null;
          target?.scrollIntoView({ block: "center", behavior: "instant" });
        }
      }

      const activeSpan =
        currentWordIndex >= 0
          ? (scrollEl.querySelector(
              transcriptWordElementSelector(currentWordIndex),
            ) as HTMLElement | null)
          : null;

      const motion = highlightMotionRef.current;
      let targetLeft = motion.left;
      let targetTop = motion.top;
      let targetWidth = motion.width;
      let targetHeight = motion.height;
      let targetOpacity = 0;

      if (
        currentWordIndex >= 0 &&
        activeSpan &&
        !isWordOverlappingSkip(words[currentWordIndex], skippedRanges)
      ) {
        const token = words[currentWordIndex];
        const tokenDuration = Math.max(0.02, token.end - token.start);
        const progressThroughWord = Math.min(
          1,
          Math.max(0, (time - token.start) / tokenDuration),
        );
        const innerRect = textInner.getBoundingClientRect();
        const spanRect = activeSpan.getBoundingClientRect();
        targetLeft = spanRect.left - innerRect.left;
        targetTop = spanRect.top - innerRect.top;
        targetWidth = Math.max(4, spanRect.width * progressThroughWord);
        targetHeight = Math.max(4, spanRect.height);
        targetOpacity = 1;
      }

      const wasHidden = motion.opacity < 0.05;
      if (wasHidden && targetOpacity === 1) {
        motion.left = targetLeft;
        motion.top = targetTop;
        motion.width = targetWidth;
        motion.height = targetHeight;
        motion.opacity = 1;
      } else {
        motion.left += (targetLeft - motion.left) * HIGHLIGHT_SMOOTH_POSITION;
        motion.top += (targetTop - motion.top) * HIGHLIGHT_SMOOTH_POSITION;
        motion.width += (targetWidth - motion.width) * HIGHLIGHT_SMOOTH_WIDTH;
        motion.height +=
          (targetHeight - motion.height) * HIGHLIGHT_SMOOTH_POSITION;
        motion.opacity +=
          (targetOpacity - motion.opacity) * HIGHLIGHT_SMOOTH_OPACITY;
      }

      highlightEl.style.opacity = String(motion.opacity);
      highlightEl.style.transform = `translate3d(${motion.left}px,${motion.top}px,0)`;
      highlightEl.style.width = `${motion.width}px`;
      highlightEl.style.height = `${motion.height}px`;

      rafRef.id = requestAnimationFrame(tick);
    };

    rafRef.id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.id);
  }, [videoElement, words, speechWordIndices, skippedRanges]);

  const onTextMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return;
    }
    const range = selection.getRangeAt(0);
    const container = scrollContainerRef.current;
    if (!container || !container.contains(range.commonAncestorContainer)) {
      return;
    }

    const coveredWordIndices: number[] = [];
    container.querySelectorAll(`[${TRANSCRIPT_WORD_INDEX_ATTR}]`).forEach(
      (element) => {
        const index = Number((element as HTMLElement).dataset.wordIndex);
        if (!Number.isFinite(index)) return;
        if (range.intersectsNode(element)) coveredWordIndices.push(index);
      },
    );
    if (coveredWordIndices.length === 0) return;

    const timeRange = wordIndicesToTimeRange(words, coveredWordIndices);
    if (timeRange) {
      dispatch(addSkipRange(timeRange.start, timeRange.end));
    }
    selection.removeAllRanges();
  }, [words, dispatch]);

  const seekVideoToTime = useCallback(
    (timeSec: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = timeSec;
    },
    [videoRef],
  );

  const onWordClick = useCallback(
    (event: MouseEvent, word: Word) => {
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) return;
      if (word.type !== "word") return;
      if (isWordOverlappingSkip(word, skippedRanges)) {
        dispatch(removeSkipAtPlaybackTime(word.start + 0.001));
        return;
      }
      event.preventDefault();
      burstSeekConfetti(event.clientX, event.clientY);
      seekVideoToTime(word.start);
    },
    [seekVideoToTime, skippedRanges, dispatch],
  );

  return (
    <div
      ref={scrollContainerRef}
      tabIndex={-1}
      className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
      onMouseUp={onTextMouseUp}
      aria-label="Script"
    >
      <div
        ref={textInnerRef}
        className="relative z-[2] w-full pr-1 text-sm leading-6 text-zinc-900"
      >
        <div
          ref={readHighlightRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 z-[1] rounded-md bg-amber-200 shadow-sm ring-1 ring-amber-400/45"
        />
        {words.map((word, wordIndex) => {
          const skipped = isWordOverlappingSkip(word, skippedRanges);
          return (
            <TranscriptWordSpan
              key={`${wordIndex}-${word.start}`}
              word={word}
              wordIndex={wordIndex}
              words={words}
              isSkipped={skipped}
              skippedRanges={skippedRanges}
              onWordClick={onWordClick}
              activeWordIndexRef={activeWordIndexRef}
            />
          );
        })}
      </div>
    </div>
  );
});

export function TranscriptSidebar({
  transcript,
  videoElement,
  videoRef,
}: {
  transcript: Transcript;
  videoElement: HTMLVideoElement | null;
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  const { words } = transcript;
  const dispatch = useAppDispatch();
  const padding = useAppSelector((s) => s.player.padding);
  const borderRadius = useAppSelector((s) => s.player.borderRadius);
  const skippedRanges = useAppSelector((s) => s.player.skippedRanges);

  const clampedPercent = (raw: string) =>
    Math.min(100, Math.max(0, Number(raw) || 0));

  return (
    <aside className="flex h-auto max-h-[min(52vh,520px)] min-h-0 w-full shrink-0 flex-col border-b border-zinc-200 bg-white shadow-sm sm:max-h-[min(48vh,560px)] lg:h-full lg:max-h-none lg:max-w-md lg:border-b-0 lg:border-r">
      <div className="border-b border-zinc-100 px-5 py-5">
        <h2 className="border-l-[3px] border-violet-600 pl-3 text-xl font-bold leading-none tracking-tight text-zinc-950 sm:text-2xl">
          Script
        </h2>
        <p className="mt-2.5 text-xs leading-relaxed text-zinc-500">
          Drag to select text to skip during playback. Click struck words to
          restore. Click a word to jump.
        </p>
      </div>

      <ScriptPanel
        words={words}
        videoElement={videoElement}
        videoRef={videoRef}
      />

      <div className="space-y-4 border-t border-zinc-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <label className="min-w-[4.5rem] text-xs font-medium text-zinc-600">
            Padding
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={padding}
            onChange={(e) => dispatch(setPadding(Number(e.target.value)))}
            className="range-slider-violet flex-1 cursor-pointer"
            style={
              { "--range-fill-pct": `${padding}%` } as CSSProperties
            }
          />
          <input
            type="number"
            min={0}
            max={100}
            value={padding}
            onChange={(e) =>
              dispatch(setPadding(clampedPercent(e.target.value)))
            }
            className="w-11 rounded-md border border-zinc-200 bg-white px-1 py-1 text-center text-xs tabular-nums text-zinc-800"
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="min-w-[4.5rem] text-xs font-medium text-zinc-600">
            Rounding
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={borderRadius}
            onChange={(e) =>
              dispatch(setBorderRadius(Number(e.target.value)))
            }
            className="range-slider-violet flex-1 cursor-pointer"
            style={
              { "--range-fill-pct": `${borderRadius}%` } as CSSProperties
            }
          />
          <input
            type="number"
            min={0}
            max={100}
            value={borderRadius}
            onChange={(e) =>
              dispatch(setBorderRadius(clampedPercent(e.target.value)))
            }
            className="w-11 rounded-md border border-zinc-200 bg-white px-1 py-1 text-center text-xs tabular-nums text-zinc-800"
          />
        </div>
        <div className="pt-1">
          <button
            type="button"
            onClick={() => dispatch(clearAllSkips())}
            disabled={skippedRanges.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:shadow-none"
          >
            Restore full script
            {skippedRanges.length > 0 ? (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium tabular-nums">
                {skippedRanges.length}{" "}
                {skippedRanges.length === 1 ? "section" : "sections"}
              </span>
            ) : null}
          </button>
          <p className="mt-2 text-center text-xs text-zinc-500">
            Removes every skipped range so playback uses the whole transcript
            again.
          </p>
        </div>
      </div>
    </aside>
  );
}
