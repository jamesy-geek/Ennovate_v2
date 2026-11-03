'use client';

import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import LaptopModel, { StickerTourTarget } from './LaptopModel';

export interface SceneAnimState {
  laptopRotationY: number;
  camX: number;
  camY: number;
  camZ: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  activeStickerIndex: number;
}

interface SceneProps {
  animState: React.MutableRefObject<SceneAnimState>;
  onModelReady?: (data: {
    targets: StickerTourTarget[];
    lidWidth: number;
    backCenterPos: THREE.Vector3;
    frontCenterPos: THREE.Vector3;
  }) => void;
  activeStickerIndex: number;
}

export default function Scene({
  animState,
  onModelReady,
  activeStickerIndex,
}: SceneProps) {
  const laptopGroupRef = useRef<THREE.Group>(null);
  const spotTargetRef = useRef<THREE.Object3D>(null);
  const tempLookAt = useRef(new THREE.Vector3());

  const { camera } = useThree();

  // Set initial camera setup
  useEffect(() => {
    camera.position.set(
      animState.current.camX,
      animState.current.camY,
      animState.current.camZ
    );
    tempLookAt.current.set(
      animState.current.targetX,
      animState.current.targetY,
      animState.current.targetZ
    );
    camera.lookAt(tempLookAt.current);
  }, [camera, animState]);

  // Frame update loop
  useFrame(() => {
    const s = animState.current;

    // 1. Update laptop group rotation
    if (laptopGroupRef.current) {
      laptopGroupRef.current.rotation.y = s.laptopRotationY;
    }

    // 2. Update camera position and lookAt target
    camera.position.set(s.camX, s.camY, s.camZ);
    tempLookAt.current.set(s.targetX, s.targetY, s.targetZ);
    camera.lookAt(tempLookAt.current);
  });

  return (
    <>
      {/* Dark background */}
      <color attach="background" args={['#08080a']} />

      {/* Very faint ambient light so nothing is pure black */}
      <ambientLight color="#1e2029" intensity={0.35} />

      {/* Target object for the spotlight */}
      <object3D ref={spotTargetRef} position={[0, 0.6, 0]} />

      {/* ONE warm spotlight from upper side as placeholder for future lamp */}
      {spotTargetRef.current && (
        <spotLight
          position={[3.5, 5.5, 2.5]}
          target={spotTargetRef.current}
          angle={0.65}
          penumbra={0.75}
          intensity={90}
          color="#ffecd1" // warm incandescent lamp glow
          castShadow
          shadow-bias={-0.0001}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
      )}

      {/* Plain dark flat ground plane under the laptop */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.138, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial
          color="#0b0c10"
          roughness={0.9}
          metalness={0.08}
        />
      </mesh>

      {/* Rotatable laptop group */}
      <group ref={laptopGroupRef}>
        <LaptopModel
          activeStickerIndex={activeStickerIndex}
          onModelReady={onModelReady}
        />
      </group>
    </>
  );
}
