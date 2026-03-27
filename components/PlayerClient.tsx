"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { PlaybackBar } from "@/components/PlaybackBar";
import { TranscriptSidebar } from "@/components/TranscriptSidebar";
import { useSkipDuringPlayback } from "@/hooks/useSkipDuringPlayback";
import { useAppSelector } from "@/store/hooks";
import type { Transcript } from "@/types/transcript";

const ScenePlayer = dynamic(
  () =>
    import("@/components/ScenePlayer/ScenePlayer").then((m) => m.ScenePlayer),
  { ssr: false },
);

export default function PlayerClient() {
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [media, setMedia] = useState<{
    videoUrl: string;
    backgroundUrl: string;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(
    null,
  );
  const [metaReady, setMetaReady] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const padding = useAppSelector((s) => s.player.padding);
  const borderRadius = useAppSelector((s) => s.player.borderRadius);
  const skippedRanges = useAppSelector((s) => s.player.skippedRanges);

  useSkipDuringPlayback(videoElement, skippedRanges);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [transcriptResponse, mediaResponse] = await Promise.all([
          fetch("/api/transcript", { cache: "no-store" }),
          fetch("/api/media-metadata", { cache: "no-store" }),
        ]);
        if (!transcriptResponse.ok || !mediaResponse.ok) {
          throw new Error("Request failed");
        }
        const { transcript: nextTranscript } =
          (await transcriptResponse.json()) as { transcript: Transcript };
        const mediaPayload = (await mediaResponse.json()) as {
          videoUrl?: string;
          backgroundUrl?: string;
        };
        if (cancelled) return;
        setTranscript(nextTranscript);
        setMedia({
          videoUrl: mediaPayload.videoUrl?.trim() || "/video.mp4",
          backgroundUrl:
            mediaPayload.backgroundUrl?.trim() || "/background.jpg",
        });
      } catch {
        if (!cancelled) setLoadError("Could not load transcript or media metadata.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const video = videoElement;
    if (!video || !media) return;
    setVideoError(null);
    video.src = media.videoUrl;
    video.load();
    setMetaReady(false);
  }, [videoElement, media]);

  useEffect(() => {
    const video = videoElement;
    if (!video) return;
    const onMeta = () => setMetaReady(true);
    const onError = () => {
      const err = video.error;
      const unsupported =
        err?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED;
      setVideoError(
        unsupported
          ? "This browser cannot decode the video (use MP4 with H.264 video and AAC audio)."
          : "Could not load the video file. Check that /video.mp4 exists and returns 200.",
      );
      setMetaReady(false);
    };
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("error", onError);
    return () => {
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("error", onError);
    };
  }, [videoElement]);

  if (loadError) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-red-400">
        {loadError}
      </div>
    );
  }

  if (!transcript || !media) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-zinc-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-zinc-100 text-zinc-900">
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <TranscriptSidebar
          transcript={transcript}
          videoElement={videoElement}
          videoRef={videoRef}
        />
        <div className="flex min-h-[240px] min-w-0 flex-1 flex-col lg:min-h-0">
          <div className="relative min-h-0 flex-1 bg-zinc-100 p-3 sm:p-4 md:p-5">
            <video
              ref={(node) => {
                videoRef.current = node;
                setVideoElement(node);
              }}
              className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
              playsInline
              preload="metadata"
              crossOrigin={
                media.videoUrl.startsWith("http") ? "anonymous" : undefined
              }
              aria-hidden
            />
            <div className="h-full min-h-[280px] overflow-hidden rounded-none bg-zinc-200 shadow-sm ring-1 ring-zinc-200/80">
              {videoError && (
                <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 p-6 text-center text-sm text-red-600">
                  <p>{videoError}</p>
                  <p className="text-zinc-500">
                    DevTools → Network: confirm GET {media.videoUrl} is 200.
                  </p>
                </div>
              )}
              {!videoError && metaReady && videoElement && (
                <ScenePlayer
                  videoElement={videoElement}
                  backgroundSrc={media.backgroundUrl}
                  padding={padding}
                  borderRadius={borderRadius}
                  className="h-full w-full min-h-[280px]"
                />
              )}
              {!videoError && !metaReady && (
                <div className="flex h-full min-h-[240px] items-center justify-center text-sm text-zinc-500">
                  Loading video metadata…
                </div>
              )}
            </div>
          </div>
          <PlaybackBar videoRef={videoRef} />
        </div>
      </div>
    </div>
  );
}
