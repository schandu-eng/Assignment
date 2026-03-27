"use client";

import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { SceneContent } from "./SceneContent";

export interface ScenePlayerProps {
  videoElement: HTMLVideoElement;
  backgroundSrc: string;
  padding: number;
  borderRadius: number;
  className?: string;
}

export function ScenePlayer({
  videoElement,
  backgroundSrc,
  padding,
  borderRadius,
  className,
}: ScenePlayerProps) {
  return (
    <div className={className ?? "h-full w-full min-h-[280px]"}>
      <Canvas
        className="!h-full !w-full block bg-transparent"
        gl={{
          antialias: true,
          alpha: true,
          depth: true,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        camera={{ position: [0, 0, 5], fov: 50, near: 0.1, far: 100 }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
      >
        <SceneContent
          video={videoElement}
          backgroundUrl={backgroundSrc}
          padding={padding}
          borderRadius={borderRadius}
        />
      </Canvas>
    </div>
  );
}
