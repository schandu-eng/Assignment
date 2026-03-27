"use client";

import { useEffect } from "react";
import { findSkipRangeAtTime } from "@/lib/transcript";
import type { TimeRange } from "@/types/transcript";

export function useSkipDuringPlayback(
  video: HTMLVideoElement | null,
  skipRanges: TimeRange[],
) {
  useEffect(() => {
    if (!video) return;

    const seekPastSkipIfInside = () => {
      const time = video.currentTime;
      const range = findSkipRangeAtTime(skipRanges, time);
      if (!range) return;
      const timelineEnd = Number.isFinite(video.duration)
        ? video.duration
        : range.end + 10;
      const jumpTo = Math.min(range.end + 0.02, timelineEnd);
      if (jumpTo > time) video.currentTime = jumpTo;
    };

    const onTimeUpdate = () => {
      if (video.seeking) return;
      seekPastSkipIfInside();
    };

    const onSeeked = () => seekPastSkipIfInside();

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("seeked", onSeeked);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("seeked", onSeeked);
    };
  }, [video, skipRanges]);
}
