'use client';

import React, { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import LaptopModel from './LaptopModel';
import {
  buildRig,
  createRigFrame,
  RigModelData,
} from '@/lib/cameraRig';

interface SceneProps {
  /** Raw scroll progress 0..1, written by ScrollTrigger (never React state) */
  progressRef: React.MutableRefObject<number>;
  /** Called ONLY when the focused sticker changes */
  onActiveChange: (index: number) => void;
  activeStickerIndex: number;
}

// How quickly the camera catches up with the scroll. Higher = snappier.
const SCROLL_DAMPING = 5;

export default function Scene({
  progressRef,
  onActiveChange,
  activeStickerIndex,
}: SceneProps) {
  const turnGroupRef = useRef<THREE.Group>(null);
  const [modelData, setModelData] = useState<RigModelData | null>(null);

  const aspect = useThree((s) => s.size.width / s.size.height);

  const reducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  // Rebuilt only when the screen shape changes. Scroll position is untouched,
  // so resizing (or a phone's address bar sliding away) can never cause a jump.
  const rig = useMemo(
    () => (modelData ? buildRig(modelData, aspect, reducedMotion) : null),
    [modelData, aspect, reducedMotion]
  );

  const frame = useRef(createRigFrame());
  const smoothed = useRef(0);
  const started = useRef(false);
  const lastActive = useRef(-1);

  // The single warm lamp. Created once so the light exists on the very first
  // render (a ref-based target is null on first render and the light was missing).
  const lampTarget = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, 0.6, 0);
    return o;
  }, []);

  useFrame((state, dt) => {
    if (!rig) return;
    const step = Math.min(dt, 0.1); // tab was asleep? don't fly across the scene

    const goal = progressRef.current;
    if (!started.current) {
      smoothed.current = goal; // landing mid-page (refresh) must not fly in
      started.current = true;
    } else {
      smoothed.current = THREE.MathUtils.damp(
        smoothed.current,
        goal,
        reducedMotion ? 60 : SCROLL_DAMPING,
        step
      );
    }

    const f = rig.evaluate(smoothed.current * rig.duration, frame.current);

    // Camera, look-at and laptop turn all come from the same frame.
    if (turnGroupRef.current) turnGroupRef.current.rotation.y = f.yaw;
    state.camera.position.copy(f.pos);
    state.camera.lookAt(f.target);

    if (f.activeIndex !== lastActive.current) {
      lastActive.current = f.activeIndex;
      onActiveChange(f.activeIndex);
    }
  });

  const pivot = modelData?.pivot ?? new THREE.Vector3();

  return (
    <>
      {/* Dark background */}
      <color attach="background" args={['#08080a']} />

      {/* Very faint ambient light so nothing is pure black */}
      <ambientLight color="#1e2029" intensity={0.35} />

      {/* ONE warm spotlight from upper side: placeholder for the future lamp */}
      <primitive object={lampTarget} />
      <spotLight
        position={[3.5, 5.5, 2.5]}
        target={lampTarget}
        angle={0.65}
        penumbra={0.75}
        intensity={90}
        color="#ffecd1"
        castShadow
        shadow-bias={-0.0001}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      {/* Plain dark flat ground plane under the laptop */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.138, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#0b0c10" roughness={0.9} metalness={0.08} />
      </mesh>

      {/* Turn group sits ON the pivot (centre of the lid) and spins around it.
          The inner group shifts the laptop back so it stays where it was. */}
      <group ref={turnGroupRef} position={pivot}>
        <group position={[-pivot.x, -pivot.y, -pivot.z]}>
          <LaptopModel
            activeStickerIndex={activeStickerIndex}
            onModelReady={setModelData}
          />
        </group>
      </group>
    </>
  );
}
