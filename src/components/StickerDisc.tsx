'use client';

import React, { useMemo, useState } from 'react';
import * as THREE from 'three';
import { StickerConfig } from '@/config/stickers';

interface StickerDiscProps {
  sticker: StickerConfig;
  index: number;
  radius: number;
  position: [number, number, number];
  quaternion: THREE.Quaternion;
  isActive?: boolean;
}

export default function StickerDisc({
  sticker,
  index,
  radius,
  position,
  quaternion,
  isActive = false,
}: StickerDiscProps) {
  const [hovered, setHovered] = useState(false);

  // Generate crisp canvas texture with the sticker number
  const texture = useMemo(() => {
    if (typeof document === 'undefined') return null;

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.clearRect(0, 0, size, size);

      // Outer blue circle
      ctx.fillStyle = '#2563eb'; // Royal blue
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 8, 0, Math.PI * 2);
      ctx.fill();

      // Clean bright border
      ctx.strokeStyle = '#93c5fd'; // Light blue accent
      ctx.lineWidth = 14;
      ctx.stroke();

      // Crisp inner white ring
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 32, 0, Math.PI * 2);
      ctx.stroke();

      // Bold number centered
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 240px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(index + 1), size / 2, size / 2 + 10);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, [index]);

  return (
    <group position={position} quaternion={quaternion}>
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
          setHovered(true);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'auto';
          setHovered(false);
        }}
        onClick={(e) => {
          e.stopPropagation();
          // Phase 1: Click does nothing yet
        }}
        scale={hovered ? [1.08, 1.08, 1.08] : isActive ? [1.04, 1.04, 1.04] : [1, 1, 1]}
      >
        <circleGeometry args={[radius, 48]} />
        <meshStandardMaterial
          map={texture || undefined}
          color={hovered ? '#ffffff' : '#e2e8f0'}
          emissive={hovered ? '#1d4ed8' : isActive ? '#1e40af' : '#000000'}
          emissiveIntensity={hovered ? 0.6 : isActive ? 0.35 : 0}
          roughness={0.25}
          metalness={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
