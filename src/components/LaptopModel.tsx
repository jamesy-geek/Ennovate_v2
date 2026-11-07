'use client';

import React, { useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { STICKERS, LOGO_CONFIG, LID_NODE_NAME, StickerConfig } from '@/config/stickers';
import StickerDisc from './StickerDisc';
import type { RigModelData, StickerTourTarget } from '@/lib/cameraRig';

export type { StickerTourTarget };

interface LaptopModelProps {
  activeStickerIndex?: number;
  onModelReady?: (data: RigModelData) => void;
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
    bodyCenter,
    pivot,
  } = useMemo(() => {
    // 1. Locate lid node (checking both raw name and sanitized name)
    const sanitizedLidName = THREE.PropertyBinding.sanitizeNodeName(LID_NODE_NAME);
    const lidNode =
      scene.getObjectByName(LID_NODE_NAME) ||
      scene.getObjectByName(sanitizedLidName);

    // Enable shadows on meshes
    scene.traverse((child) => {
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
        backCenterPos: new THREE.Vector3(-1.5, 1.34, 0),
        frontCenterPos: new THREE.Vector3(-1.44, 1.35, 0),
        bodyCenter: new THREE.Vector3(-0.17, 1.24, 0),
        pivot: new THREE.Vector3(-0.17, 0, 0),
      };
    }

    const bbox = new THREE.Box3();
    lidNode.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).geometry) {
        const geom = (child as THREE.Mesh).geometry;
        geom.computeBoundingBox();
        if (geom.boundingBox) {
          bbox.union(geom.boundingBox);
        }
      }
    });

    const minZ = bbox.min.z;
    const maxZ = bbox.max.z;
    const minX = bbox.min.x;
    const maxX = bbox.max.x;
    const minY = bbox.min.y;

    const lidWidth = maxZ - minZ;
    const lidHeight = maxX - minX;

    // Radius is ~18% of lid width (diameter = 0.18 * lidWidth)
    const discRadius = (lidWidth * 0.18) / 2;

    const lidPosition = lidNode.position.clone();
    const lidQuaternion = lidNode.quaternion.clone();
    const lidScale = lidNode.scale.clone();

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

    // Tour targets in LAPTOP space (laptop un-turned). The camera rig applies the
    // turn around `pivot` (the laptop's own centre), so nothing here depends on how
    // the laptop is rotated.
    const lidMatrix = new THREE.Matrix4().compose(lidPosition, lidQuaternion, lidScale);
    const outerNormal = new THREE.Vector3(0, -1, 0)
      .applyQuaternion(lidQuaternion)
      .normalize();

    const tourTargets: StickerTourTarget[] = placements.map((p) => ({
      id: p.sticker.id,
      label: p.sticker.label,
      pos: p.localPos.clone().applyMatrix4(lidMatrix),
      normal: outerNormal.clone(),
    }));

    // Centre of the outer back panel
    const centerLocal = new THREE.Vector3(
      maxX - 0.5 * lidHeight,
      minY - 0.005,
      minZ + 0.5 * lidWidth
    );
    const backCenterPos = centerLocal.clone().applyMatrix4(lidMatrix);

    // Centre of the screen face
    const screenCenterLocal = new THREE.Vector3(maxX - 0.5 * lidHeight, 0, minZ + 0.5 * lidWidth);
    const frontCenterPos = screenCenterLocal.clone().applyMatrix4(lidMatrix);

    // The laptop turns IN PLACE around a vertical axis through the middle of its
    // own body. Its position never changes; only its yaw does.
    scene.updateMatrixWorld(true);
    const bodyBox = new THREE.Box3().setFromObject(scene);
    const bodyCenter = bodyBox.getCenter(new THREE.Vector3());
    const pivot = new THREE.Vector3(bodyCenter.x, 0, bodyCenter.z);

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
      bodyCenter,
      pivot,
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
        bodyCenter,
        pivot,
      });
    }
  }, [tourTargets, onModelReady, lidDimensions, backCenterPos, frontCenterPos, bodyCenter, pivot]);

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
