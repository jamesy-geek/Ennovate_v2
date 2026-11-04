'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Scene from './Scene';
import { STICKERS } from '@/config/stickers';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
  // Phones fire "resize" every time the address bar slides in or out.
  // Ignoring those stops the whole page from re-measuring (and jumping) mid-scroll.
  ScrollTrigger.config({ ignoreMobileResize: true });
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

export default function TourCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webGLSupported, setWebGLSupported] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [activeStickerIdx, setActiveStickerIdx] = useState<number>(-1);
  const [hintHidden, setHintHidden] = useState(false);

  // Scroll position as a plain number. The 3D scene reads it every frame.
  // Writing here does NOT re-render React, which is what keeps scrolling smooth.
  const progressRef = useRef(0);

  // Total scroll length is derived from the number of stickers
  const totalScrollHeightVh = (STICKERS.length + 3) * 120;

  useEffect(() => {
    setWebGLSupported(checkWebGLSupport());

    const updateMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    };
    updateMobile();
    window.addEventListener('resize', updateMobile);
    return () => window.removeEventListener('resize', updateMobile);
  }, []);

  // ONE scroll trigger, created once. It only reports progress.
  useEffect(() => {
    if (!containerRef.current) return;

    const st = ScrollTrigger.create({
      trigger: containerRef.current,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        progressRef.current = self.progress;
        const hide = self.progress > 0.05;
        setHintHidden((prev) => (prev === hide ? prev : hide)); // renders only on change
      },
    });
    progressRef.current = st.progress; // reload mid-page starts in the right place

    return () => st.kill();
  }, [webGLSupported]);

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
          style={{ opacity: hintHidden ? 0 : 0.8 }}
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
            camera={{ fov: 45, near: 0.1, far: 50, position: [6.2, 1.25, 0] }}
            gl={{
              antialias: true,
              powerPreference: 'high-performance',
            }}
            style={{ width: '100%', height: '100%', touchAction: 'pan-y' }}
          >
            <Scene
              progressRef={progressRef}
              onActiveChange={setActiveStickerIdx}
              activeStickerIndex={activeStickerIdx}
            />
          </Canvas>
        </div>
      </div>
    </div>
  );
}
