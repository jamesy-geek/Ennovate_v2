'use client';

import React, { useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { STICKERS, LOGO_CONFIG, LID_NODE_NAME, StickerConfig } from '@/config/stickers';
import StickerDisc from './StickerDisc';

export interface StickerTourTarget {
  id: string;
  label: string;
  worldPos: THREE.Vector3;
  worldNormal: THREE.Vector3;
}

interface LaptopModelProps {
  activeStickerIndex?: number;
  onModelReady?: (data: {
    targets: StickerTourTarget[];
    lidWidth: number;
    backCenterPos: THREE.Vector3;
    frontCenterPos: THREE.Vector3;
  }) => void;
}

export default function LaptopModel({
  activeStickerIndex = -1,
  onModelReady,
}: LaptopModelProps) {
  // Load the glb placeholder model
  const { scene } = useGLTF('/models/laptop.glb');
  const notifiedRef = useRef(false);

  // Analyze lid mesh and extract transforms
  const {
    lidTransform,
    lidDimensions,
    discRadius,
    stickerPlacements,
    logoPlacement,
    tourTargets,
    backCenterPos,
    frontCenterPos,
  } = useMemo(() => {
    // 1. Locate lid node
    let lidNode: THREE.Object3D | null = null;
    scene.traverse((child) => {
      if (child.name === LID_NODE_NAME) {
        lidNode = child;
      }
      // Enable shadow reception/casting where applicable
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    if (!lidNode) {
      console.warn(`Node "${LID_NODE_NAME}" not found in model.`);
      return {
        lidTransform: {
          position: new THREE.Vector3(-1.1986, 0.096, 0),
          quaternion: new THREE.Quaternion(0, 0, -0.6366, 0.7712),
          scale: new THREE.Vector3(1, 1, 1),
        },
        lidDimensions: { minZ: -1.9832, maxZ: 1.9832, minX: -2.5633, maxX: 0, minY: -0.0741 },
        discRadius: 0.357,
        stickerPlacements: [],
        logoPlacement: null,
        tourTargets: [],
        backCenterPos: new THREE.Vector3(1.5, 1.2, 0),
        frontCenterPos: new THREE.Vector3(0, 0.9, 0),
      };
    }

    const lidMesh = lidNode as THREE.Mesh;
    if (lidMesh.geometry && !lidMesh.geometry.boundingBox) {
      lidMesh.geometry.computeBoundingBox();
    }

    const bbox = lidMesh.geometry?.boundingBox || new THREE.Box3(
      new THREE.Vector3(-2.5633, -0.0741, -1.9832),
      new THREE.Vector3(0, 0, 1.9832)
    );

    const minZ = bbox.min.z;
    const maxZ = bbox.max.z;
    const minX = bbox.min.x;
    const maxX = bbox.max.x;
    const minY = bbox.min.y;

    const lidWidth = maxZ - minZ;
    const lidHeight = maxX - minX;

    // Radius is ~18% of lid width (diameter = 0.18 * lidWidth)
    const discRadius = (lidWidth * 0.18) / 2;

    const lidPosition = lidMesh.position.clone();
    const lidQuaternion = lidMesh.quaternion.clone();
    const lidScale = lidMesh.scale.clone();

    // Base quaternion for sticker disc:
    // Right = (0, 0, 1), Up = (-1, 0, 0) (towards top edge), Normal = (0, -1, 0) (outer back panel)
    const mAlign = new THREE.Matrix4().set(
      0, -1,  0, 0,
      0,  0, -1, 0,
      1,  0,  0, 0,
      0,  0,  0, 1
    );
    const baseQuat = new THREE.Quaternion().setFromRotationMatrix(mAlign);

    // Compute placements for stickers
    const placements = STICKERS.map((st: StickerConfig, idx: number) => {
      // Local lid coords:
      // acrossPct: 0% = left edge (minZ), 100% = right edge (maxZ)
      const localZ = minZ + (st.acrossPct / 100) * lidWidth;
      // upPct: 0% = hinge (maxX), 100% = top edge (minX)
      const localX = maxX - (st.upPct / 100) * lidHeight;
      // slightly above outer back panel (minY - 0.005) to avoid z-fighting
      const localY = minY - 0.005;

      // Tilt around normal
      const qTilt = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        THREE.MathUtils.degToRad(st.tiltDeg)
      );
      const quat = baseQuat.clone().multiply(qTilt);

      return {
        sticker: st,
        index: idx,
        localPos: new THREE.Vector3(localX, localY, localZ),
        quaternion: quat,
      };
    });

    // Logo placement
    const logoZ = minZ + (LOGO_CONFIG.acrossPct / 100) * lidWidth;
    const logoX = maxX - (LOGO_CONFIG.upPct / 100) * lidHeight;
    const logoY = minY - 0.005;
    const logoPlacement = {
      localPos: new THREE.Vector3(logoX, logoY, logoZ),
      quaternion: baseQuat.clone(),
      innerRadius: discRadius * 0.45,
      outerRadius: discRadius * 0.85,
    };

    // Calculate tour targets in world coordinates when laptop is turned (rotation.y = PI)
    const rotPI = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    const lidMatrix = new THREE.Matrix4().compose(lidPosition, lidQuaternion, lidScale);
    const groupMatrix = new THREE.Matrix4().makeRotationY(Math.PI);
    const fullWorldMatrix = groupMatrix.clone().multiply(lidMatrix);

    const tourTargets: StickerTourTarget[] = placements.map((p) => {
      const worldPos = p.localPos.clone().applyMatrix4(fullWorldMatrix);
      const localNormal = new THREE.Vector3(0, -1, 0);
      const worldNormal = localNormal
        .clone()
        .applyQuaternion(lidQuaternion)
        .applyQuaternion(rotPI)
        .normalize();

      return {
        id: p.sticker.id,
        label: p.sticker.label,
        worldPos,
        worldNormal,
      };
    });

    // Center of the back lid when turned
    const centerLocal = new THREE.Vector3(
      maxX - 0.5 * lidHeight,
      minY - 0.005,
      minZ + 0.5 * lidWidth
    );
    const backCenterPos = centerLocal.clone().applyMatrix4(fullWorldMatrix);

    // Front center position (screen facing camera at rotY = 0)
    const frontLidMatrix = lidMatrix.clone();
    const screenCenterLocal = new THREE.Vector3(maxX - 0.5 * lidHeight, 0, minZ + 0.5 * lidWidth);
    const frontCenterPos = screenCenterLocal.clone().applyMatrix4(frontLidMatrix);

    return {
      lidTransform: {
        position: lidPosition,
        quaternion: lidQuaternion,
        scale: lidScale,
      },
      lidDimensions: { minZ, maxZ, minX, maxX, minY },
      discRadius,
      stickerPlacements: placements,
      logoPlacement,
      tourTargets,
      backCenterPos,
      frontCenterPos,
    };
  }, [scene]);

  // Notify parent component of targets once computed
  useEffect(() => {
    if (tourTargets.length > 0 && onModelReady && !notifiedRef.current) {
      notifiedRef.current = true;
      onModelReady({
        targets: tourTargets,
        lidWidth: lidDimensions.maxZ - lidDimensions.minZ,
        backCenterPos,
        frontCenterPos,
      });
    }
  }, [tourTargets, onModelReady, lidDimensions, backCenterPos, frontCenterPos]);

  return (
    <>
      {/* 3D Laptop Model from GLB */}
      <primitive object={scene} />

      {/* Stickers and logo parented to the lid's coordinate system */}
      <group
        position={lidTransform.position}
        quaternion={lidTransform.quaternion}
        scale={lidTransform.scale}
      >
        {/* Placeholder Sticker Discs */}
        {stickerPlacements.map((p) => (
          <StickerDisc
            key={p.sticker.id}
            sticker={p.sticker}
            index={p.index}
            radius={discRadius}
            position={[p.localPos.x, p.localPos.y, p.localPos.z]}
            quaternion={p.quaternion}
            isActive={activeStickerIndex === p.index}
          />
        ))}

        {/* Flat Orange Ring Placeholder for Club Logo */}
        {logoPlacement && (
          <mesh
            position={[
              logoPlacement.localPos.x,
              logoPlacement.localPos.y,
              logoPlacement.localPos.z,
            ]}
            quaternion={logoPlacement.quaternion}
          >
            <ringGeometry
              args={[logoPlacement.innerRadius, logoPlacement.outerRadius, 64]}
            />
            <meshStandardMaterial
              color="#f97316"
              roughness={0.35}
              metalness={0.2}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}
      </group>
    </>
  );
}

useGLTF.preload('/models/laptop.glb');
