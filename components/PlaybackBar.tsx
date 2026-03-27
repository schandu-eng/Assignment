"use client";

import { useEffect, useMemo, useState } from "react";

function formatMinutesSeconds(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

const TICK_STEP = 15;

const SKIP_SECONDS = 10;

const PLAYBACK_RATES = [1, 1.5, 2] as const;

export function PlaybackBar({
  videoRef,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
}) {
  const [duration, setDuration] = useState(0);
  const [displayTime, setDisplayTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => {
      setDuration(v.duration || 0);
      setDisplayTime(v.currentTime);
      setPlaybackRate(v.playbackRate || 1);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => {
      if (!isScrubbing) setDisplayTime(v.currentTime);
    };
    const onRate = () => setPlaybackRate(v.playbackRate || 1);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("durationchange", onMeta);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("ratechange", onRate);
    onMeta();
    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("durationchange", onMeta);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("timeupdate", onTimeUpdate);
      v.removeEventListener("ratechange", onRate);
    };
  }, [videoRef, isScrubbing]);

  const tickLabels = useMemo(() => {
    if (!Number.isFinite(duration) || duration <= 0) return [0];
    const out: number[] = [];
    for (let t = 0; t < duration; t += TICK_STEP) {
      out.push(t);
    }
    const last = out[out.length - 1];
    if (last === undefined || duration - last > 0.5) {
      out.push(duration);
    }
    if (out.length > 10) {
      const step = Math.ceil(out.length / 9);
      const sparse = out.filter((_, i) => i % step === 0);
      if (sparse[sparse.length - 1] !== out[out.length - 1]) {
        sparse.push(out[out.length - 1]);
      }
      return sparse;
    }
    return out;
  }, [duration]);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else video.pause();
  };

  const skipBySeconds = (deltaSec: number) => {
    const video = videoRef.current;
    if (!video) return;
    const end = Number.isFinite(video.duration) ? video.duration : 0;
    const next = video.currentTime + deltaSec;
    video.currentTime =
      end > 0 ? Math.max(0, Math.min(end, next)) : Math.max(0, next);
    setDisplayTime(video.currentTime);
  };

  const setPlaybackSpeed = (rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const playedPercent =
    duration > 0 ? Math.min(100, (displayTime / duration) * 100) : 0;

  const controlBtn =
    "flex h-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-xs font-semibold text-zinc-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800 disabled:opacity-40";

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 bg-white px-3 py-3 sm:gap-3 sm:px-5 sm:py-4 md:gap-4">
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={togglePlayPause}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white shadow-md shadow-violet-600/25 transition hover:bg-violet-500"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
        {isPlaying ? (
          <span className="flex gap-0.5" aria-hidden>
            <span className="h-3.5 w-1 rounded-sm bg-white" />
            <span className="h-3.5 w-1 rounded-sm bg-white" />
          </span>
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="ml-0.5"
            aria-hidden
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
        </button>
        <button
          type="button"
          className={controlBtn}
          aria-label={`Back ${SKIP_SECONDS} seconds`}
          onClick={() => skipBySeconds(-SKIP_SECONDS)}
        >
          −{SKIP_SECONDS}s
        </button>
        <button
          type="button"
          className={controlBtn}
          aria-label={`Forward ${SKIP_SECONDS} seconds`}
          onClick={() => skipBySeconds(SKIP_SECONDS)}
        >
          +{SKIP_SECONDS}s
        </button>
      </div>

      <div className="min-w-[min(100%,12rem)] flex-1 basis-[200px]">
        <div className="relative mb-1 h-4 text-[10px] font-medium tabular-nums text-zinc-400">
          {tickLabels.map((t) => (
            <span
              key={`${t}-${duration}`}
              className="absolute shrink-0 -translate-x-1/2"
              style={{
                left: `${duration > 0 ? (t / duration) * 100 : 0}%`,
              }}
            >
              {formatMinutesSeconds(t)}
            </span>
          ))}
        </div>
        <div className="relative flex h-9 items-center">
          <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 rounded-full bg-zinc-200" />
          <div
            className="pointer-events-none absolute left-0 top-1/2 h-px max-w-full -translate-y-1/2 rounded-full bg-violet-600"
            style={{ width: `${playedPercent}%` }}
          />
          <div
            className="pointer-events-none absolute left-0 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-violet-600 shadow-md shadow-violet-600/30"
            style={{ left: `${playedPercent}%` }}
          />
          <input
            type="range"
            className="relative z-10 h-9 w-full cursor-pointer opacity-0"
            min={0}
            max={duration || 0}
            step={0.01}
            value={displayTime}
            aria-label="Seek"
            onPointerDown={() => setIsScrubbing(true)}
            onPointerUp={() => setIsScrubbing(false)}
            onPointerLeave={() => setIsScrubbing(false)}
            onChange={(e) => {
              const video = videoRef.current;
              if (!video) return;
              const time = parseFloat(e.target.value);
              video.currentTime = time;
              setDisplayTime(time);
            }}
          />
        </div>
      </div>

      <div
        className="flex shrink-0 items-center gap-0.5 rounded-lg border border-zinc-200 bg-zinc-100/80 p-0.5"
        role="group"
        aria-label="Playback speed"
      >
        {PLAYBACK_RATES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setPlaybackSpeed(r)}
            className={`rounded-md px-2 py-1.5 text-xs font-semibold tabular-nums transition sm:px-2.5 ${
              playbackRate === r
                ? "bg-white text-violet-700 shadow-sm ring-1 ring-violet-200"
                : "text-zinc-600 hover:bg-white/80 hover:text-zinc-900"
            }`}
            aria-pressed={playbackRate === r}
            aria-label={`${r} times speed`}
          >
            {r}×
          </button>
        ))}
      </div>

      <span className="shrink-0 tabular-nums text-sm font-medium text-zinc-600">
        {formatMinutesSeconds(displayTime)} / {formatMinutesSeconds(duration)}
      </span>
    </div>
  );
}
