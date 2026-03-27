"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const CANVAS_BG = "#ececf0";

function resolveTextureUrl(path: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  if (typeof window === "undefined") return path;
  return path.startsWith("/") ? `${window.location.origin}${path}` : `${window.location.origin}/${path}`;
}

const ROUNDED_VIDEO_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ROUNDED_VIDEO_FRAG = `
  precision highp float;
  uniform sampler2D map;
  uniform vec2 uSize;
  uniform float uRadius;
  varying vec2 vUv;

  float sdRoundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main() {
    vec2 p = (vUv - 0.5) * uSize;
    vec2 b = max(0.5 * uSize - vec2(uRadius), vec2(1e-6));
    float d = sdRoundBox(p, b, uRadius);
    vec4 tex = texture2D(map, vUv);
    float aa = max(fwidth(d) * 1.75, 1e-5);
    float a = 1.0 - smoothstep(-aa, aa, d);
    if (a < 0.001) discard;
    gl_FragColor = vec4(tex.rgb, tex.a * a);
  }
`;

function useCoverPlaneSizeAtZ(planeZ: number) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const getCurrentViewport = useThree((s) => s.viewport.getCurrentViewport);
  return useMemo(() => {
    const target = new THREE.Vector3(0, 0, planeZ);
    const vp = getCurrentViewport(camera, target, size);
    const vw = vp.width;
    const vh = vp.height;
    const viewAspect = vw / vh;
    return (texAspect: number) => {
      let planeW: number;
      let planeH: number;
      if (texAspect > viewAspect) {
        planeH = vh;
        planeW = vh * texAspect;
      } else {
        planeW = vw;
        planeH = vw / texAspect;
      }
      return { planeW, planeH };
    };
  }, [camera, size, getCurrentViewport, planeZ]);
}

function SolidBackdropPlane({ z = -0.52 }: { z?: number }) {
  const cover = useCoverPlaneSizeAtZ(z);
  const { planeW, planeH } = cover(1);
  return (
    <mesh position={[0, 0, z]}>
      <planeGeometry args={[planeW, planeH]} />
      <meshBasicMaterial color={CANVAS_BG} />
    </mesh>
  );
}

function GradientBackgroundPlane() {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const g = ctx.createLinearGradient(0, 512, 512, 0);
    g.addColorStop(0, "#7c3aed");
    g.addColorStop(0.42, "#e11d48");
    g.addColorStop(1, "#38bdf8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  useEffect(() => {
    return () => {
      texture?.dispose();
    };
  }, [texture]);

  const cover = useCoverPlaneSizeAtZ(-0.5);
  const { planeW, planeH } = cover(1);

  if (!texture) return null;

  return (
    <mesh position={[0, 0, -0.5]}>
      <planeGeometry args={[planeW, planeH]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

function BackgroundImagePlane({ url }: { url: string }) {
  const gl = useThree((s) => s.gl);
  const glRef = useRef(gl);
  glRef.current = gl;
  const src = useMemo(() => resolveTextureUrl(url), [url]);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    let disposedEffect = false;
    let loaded: THREE.Texture | null = null;
    loader.load(
      src,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        const renderer = glRef.current;
        if (renderer && "initTexture" in renderer) {
          (renderer as THREE.WebGLRenderer).initTexture(tex);
        }
        if (disposedEffect) {
          tex.dispose();
          return;
        }
        loaded = tex;
        setTexture(tex);
      },
      undefined,
      () => {
        if (!disposedEffect) setTexture(null);
      },
    );
    return () => {
      disposedEffect = true;
      loaded?.dispose();
    };
  }, [src]);

  const cover = useCoverPlaneSizeAtZ(-0.5);
  if (!texture) return null;
  const image = texture.image as HTMLImageElement;
  const w = image.naturalWidth || image.width;
  const h = image.naturalHeight || image.height;
  if (!w || !h) return null;
  const { planeW, planeH } = cover(w / h);
  return (
    <mesh position={[0, 0, -0.5]}>
      <planeGeometry args={[planeW, planeH]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

function VideoMesh({
  video,
  padding,
  borderRadius,
}: {
  video: HTMLVideoElement;
  padding: number;
  borderRadius: number;
}) {
  const texture = useMemo(() => {
    const t = new THREE.VideoTexture(video);
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    return t;
  }, [video]);

  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  useFrame(() => {
    Reflect.set(texture, "needsUpdate", true);
  });

  const { viewport } = useThree();
  const [videoAspect, setVideoAspect] = useState(16 / 9);

  useEffect(() => {
    const onMeta = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setVideoAspect(video.videoWidth / video.videoHeight);
      }
    };
    onMeta();
    video.addEventListener("loadedmetadata", onMeta);
    return () => video.removeEventListener("loadedmetadata", onMeta);
  }, [video]);

  const vw = viewport.width;
  const vh = viewport.height;
  const padFrac = (padding / 100) * 0.35;
  const maxW = vw * (1 - 2 * padFrac);
  const maxH = vh * (1 - 2 * padFrac);
  let planeWidth: number;
  let planeHeight: number;
  if (maxW / maxH > videoAspect) {
    planeHeight = maxH;
    planeWidth = maxH * videoAspect;
  } else {
    planeWidth = maxW;
    planeHeight = maxW / videoAspect;
  }

  const maxCornerRadius = Math.min(planeWidth, planeHeight) / 2 - 1e-4;
  const cornerRadius = Math.min(
    (borderRadius / 100) * 0.2 * Math.min(planeWidth, planeHeight),
    maxCornerRadius,
  );

  const geometry = useMemo(
    () => new THREE.PlaneGeometry(planeWidth, planeHeight),
    [planeWidth, planeHeight],
  );

  const videoMat = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: texture },
        uSize: { value: new THREE.Vector2(planeWidth, planeHeight) },
        uRadius: { value: cornerRadius },
      },
      vertexShader: ROUNDED_VIDEO_VERT,
      fragmentShader: ROUNDED_VIDEO_FRAG,
      transparent: true,
      toneMapped: false,
      depthWrite: false,
      depthTest: true,
    });
    return mat;
  }, [texture, planeWidth, planeHeight, cornerRadius]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useEffect(() => {
    return () => {
      videoMat.dispose();
    };
  }, [videoMat]);

  return (
    <mesh
      geometry={geometry}
      material={videoMat}
      position={[0, 0, 0]}
      renderOrder={2}
    />
  );
}

export function SceneContent({
  video,
  backgroundUrl,
  padding,
  borderRadius,
}: {
  video: HTMLVideoElement;
  backgroundUrl: string;
  padding: number;
  borderRadius: number;
}) {
  const trimmed = backgroundUrl?.trim() ?? "";
  const useBuiltInGradient =
    trimmed === "/gradient" || trimmed === "__gradient__";
  const imageUrl = useBuiltInGradient ? "" : trimmed || "/background.jpg";

  return (
    <>
      {useBuiltInGradient ? (
        <GradientBackgroundPlane />
      ) : (
        <>
          <SolidBackdropPlane />
          <BackgroundImagePlane key={imageUrl} url={imageUrl} />
        </>
      )}
      <VideoMesh
        video={video}
        padding={padding}
        borderRadius={borderRadius}
      />
    </>
  );
}
