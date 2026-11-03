'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Scene, { SceneAnimState } from './Scene';
import { StickerTourTarget } from './LaptopModel';
import { STICKERS } from '@/config/stickers';

// Register GSAP plugins safely
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// Utility: check WebGL availability
function checkWebGLSupport(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl') ||
        canvas.getContext('webgl2'))
    );
  } catch {
    return false;
  }
}

// Framing distance calculators based on aspect ratio
function getStickerFramingDist(aspect: number): number {
  if (aspect < 1.0) {
    // Mobile portrait: back up proportionally so sticker has comfortable margin
    return Math.min(3.6, 1.9 / Math.max(0.48, aspect * 1.15));
  }
  return 1.9;
}

function getFullViewDist(aspect: number): number {
  if (aspect < 1.0) {
    const tanHalfFov = Math.tan((45 * Math.PI) / 360);
    // Fit ~4.2 units laptop width with comfortable padding
    return Math.max(5.2, (4.2 * 1.1) / (2 * tanHalfFov * aspect));
  }
  return 4.8;
}

export default function TourCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webGLSupported, setWebGLSupported] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [activeStickerIdx, setActiveStickerIdx] = useState<number>(-1);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Targets received from LaptopModel
  const modelDataRef = useRef<{
    targets: StickerTourTarget[];
    lidWidth: number;
    backCenterPos: THREE.Vector3;
    frontCenterPos: THREE.Vector3;
  } | null>(null);

  // Mutable animation state read by Scene in useFrame
  const animState = useRef<SceneAnimState>({
    laptopRotationY: 0,
    camX: 4.8,
    camY: 1.25,
    camZ: 0,
    targetX: 0,
    targetY: 0.9,
    targetZ: 0,
    activeStickerIndex: -1,
  });

  // Calculate total scroll length derived from number of stickers
  // Formula: (STICKERS.length + 3) * 120 vh
  const totalScrollHeightVh = (STICKERS.length + 3) * 120;

  // WebGL & Mobile detector
  useEffect(() => {
    setWebGLSupported(checkWebGLSupport());

    const updateMobile = () => {
      const mobile = window.innerWidth < 768 || 'ontouchstart' in window;
      setIsMobile(mobile);
    };

    updateMobile();
    window.addEventListener('resize', updateMobile);
    return () => window.removeEventListener('resize', updateMobile);
  }, []);

  // Construct or rebuild GSAP ScrollTrigger timeline
  const setupTimeline = useCallback(() => {
    if (!containerRef.current || !modelDataRef.current) return;

    const data = modelDataRef.current;
    const aspect = window.innerWidth / window.innerHeight;
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    const fullDist = getFullViewDist(aspect);
    const stickerDist = getStickerFramingDist(aspect);

    // 1. Initial Front View
    const frontCam = new THREE.Vector3(fullDist, 1.25, 0);
    const frontTarget = data.frontCenterPos;

    // 2. Full Back View (outer lid facing camera after turn)
    const backCam = new THREE.Vector3(fullDist, 1.35, 0);
    const backTarget = data.backCenterPos;

    // Set initial values
    if (!prefersReducedMotion) {
      animState.current.laptopRotationY = 0;
      animState.current.camX = frontCam.x;
      animState.current.camY = frontCam.y;
      animState.current.camZ = frontCam.z;
      animState.current.targetX = frontTarget.x;
      animState.current.targetY = frontTarget.y;
      animState.current.targetZ = frontTarget.z;
    } else {
      // Reduced motion: start at back view directly
      animState.current.laptopRotationY = Math.PI;
      animState.current.camX = backCam.x;
      animState.current.camY = backCam.y;
      animState.current.camZ = backCam.z;
      animState.current.targetX = backTarget.x;
      animState.current.targetY = backTarget.y;
      animState.current.targetZ = backTarget.z;
    }

    // Clear previous triggers
    ScrollTrigger.getAll().forEach((t) => t.kill());

    const ctx = gsap.context(() => {
      const stickerWindows: Array<{ index: number; start: number; end: number }> = [];
      let curTime = 0;

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1, // Smooth scrubbed easing
          onUpdate: (self) => {
            setScrollProgress(self.progress);
            const time = tl.time();
            const active = stickerWindows.find(
              (w) => time >= w.start && time <= w.end
            );
            setActiveStickerIdx(active ? active.index : -1);
          },
        },
      });

      if (prefersReducedMotion) {
        // Reduced motion: highlight each sticker sequentially without camera move
        const durationPerSticker = 1.5;
        data.targets.forEach((tgt, idx) => {
          const start = curTime;
          const end = curTime + durationPerSticker;
          stickerWindows.push({ index: idx, start, end });
          tl.to({}, { duration: durationPerSticker });
          curTime = end;
        });
        tl.to({}, { duration: 0.5 });
        return;
      }

      // Step 1: Start front view hold
      tl.to({}, { duration: 0.4 });
      curTime += 0.4;

      // Step 2: Smoothly turn the laptop to show the back of the lid
      tl.to(animState.current, {
        laptopRotationY: Math.PI,
        camX: backCam.x,
        camY: backCam.y,
        camZ: backCam.z,
        targetX: backTarget.x,
        targetY: backTarget.y,
        targetZ: backTarget.z,
        duration: 2.2,
        ease: 'power2.inOut',
      });
      curTime += 2.2;

      // Brief pause at full back view
      tl.to({}, { duration: 0.5 });
      curTime += 0.5;

      // Step 3: Glide to sticker 1, hold, then 2, 3, 4 in order
      data.targets.forEach((target, i) => {
        const stickerCam = target.worldPos
          .clone()
          .add(target.worldNormal.clone().multiplyScalar(stickerDist));

        const glideDuration = 1.6;
        const holdDuration = 1.2;

        // Window where this sticker is actively in focus
        stickerWindows.push({
          index: i,
          start: curTime + 0.6,
          end: curTime + glideDuration + holdDuration + 0.2,
        });

        // Glide camera to sticker
        tl.to(animState.current, {
          camX: stickerCam.x,
          camY: stickerCam.y,
          camZ: stickerCam.z,
          targetX: target.worldPos.x,
          targetY: target.worldPos.y,
          targetZ: target.worldPos.z,
          duration: glideDuration,
          ease: 'power2.inOut',
        });
        curTime += glideDuration;

        // Hold on sticker
        tl.to({}, { duration: holdDuration });
        curTime += holdDuration;
      });

      // Step 4: Ease back to full back view
      tl.to(animState.current, {
        camX: backCam.x,
        camY: backCam.y,
        camZ: backCam.z,
        targetX: backTarget.x,
        targetY: backTarget.y,
        targetZ: backTarget.z,
        duration: 2.2,
        ease: 'power2.inOut',
      });
      curTime += 2.2;

      // End hold
      tl.to({}, { duration: 0.6 });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  // When model finishes computing target coordinates, initialize timeline
  const handleModelReady = useCallback(
    (data: {
      targets: StickerTourTarget[];
      lidWidth: number;
      backCenterPos: THREE.Vector3;
      frontCenterPos: THREE.Vector3;
    }) => {
      modelDataRef.current = data;
      setupTimeline();
    },
    [setupTimeline]
  );

  // Resize listener to re-evaluate framing
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setupTimeline();
      }, 150);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, [setupTimeline]);

  // Fallback for WebGL failure
  if (!webGLSupported) {
    return (
      <div className="fallback-container">
        <h1 className="fallback-title">Club Ennovate</h1>
        <p className="fallback-desc">
          WebGL is unavailable in your browser. Explore our sections directly:
        </p>
        <ul className="fallback-list">
          {STICKERS.map((s, idx) => (
            <li key={s.id}>
              <a href={s.href} className="fallback-link">
                {idx + 1}. {s.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const activeSticker =
    activeStickerIdx >= 0 && activeStickerIdx < STICKERS.length
      ? STICKERS[activeStickerIdx]
      : null;

  return (
    <div
      ref={containerRef}
      className="tour-container"
      style={{ height: `${totalScrollHeightVh}vh` }}
    >
      <div className="canvas-sticky">
        {/* Floating HUD */}
        <div className="tour-hud">
          <span className="tour-title">Club Ennovate</span>
          <span className="tour-subtitle">Interactive 3D Tour</span>
        </div>

        {/* Scroll indicator (fades as user scrolls) */}
        <div
          className="scroll-hint"
          style={{ opacity: scrollProgress > 0.05 ? 0 : 0.8 }}
        >
          <span>Scroll to explore</span>
          <div className="scroll-hint-arrow" />
        </div>

        {/* Active sticker indicator badge */}
        <div className={`sticker-pill ${activeSticker ? 'visible' : ''}`}>
          <span className="sticker-pill-badge">
            {activeStickerIdx >= 0 ? activeStickerIdx + 1 : ''}
          </span>
          <span>{activeSticker?.label}</span>
        </div>

        {/* 3D Canvas */}
        <div className="canvas-wrapper">
          <Canvas
            shadows
            dpr={isMobile ? [1, 1.5] : [1, 2]}
            camera={{ fov: 45, near: 0.1, far: 50, position: [4.8, 1.25, 0] }}
            gl={{
              antialias: true,
              powerPreference: 'high-performance',
            }}
            style={{ width: '100%', height: '100%', touchAction: 'pan-y' }}
          >
            <Scene
              animState={animState}
              onModelReady={handleModelReady}
              activeStickerIndex={activeStickerIdx}
            />
          </Canvas>
        </div>
      </div>
    </div>
  );
}
