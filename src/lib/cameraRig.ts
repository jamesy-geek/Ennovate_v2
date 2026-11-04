import * as THREE from 'three';

/**
 * CAMERA RIG
 * ----------
 * One pure function of scroll progress drives EVERYTHING that moves:
 * the camera position, what the camera looks at, and the laptop's turn.
 * Because they all come from the same clock they can never drift apart,
 * which is what "the camera follows the laptop at all times" means in code.
 *
 * All model data is in LAPTOP SPACE (the laptop un-turned). The rig turns the
 * laptop around a vertical axis through the CENTRE OF THE LID (`pivot`), so the
 * lid stays put in the frame while the base swings around it.
 */

export interface StickerTourTarget {
  id: string;
  label: string;
  /** Sticker centre in laptop space */
  pos: THREE.Vector3;
  /** Outward normal of the lid's back panel in laptop space */
  normal: THREE.Vector3;
}

export interface RigModelData {
  targets: StickerTourTarget[];
  lidWidth: number;
  /** Centre of the outer back panel (laptop space) */
  backCenterPos: THREE.Vector3;
  /** Centre of the screen face (laptop space) */
  frontCenterPos: THREE.Vector3;
  /** Vertical axis the laptop turns around (y is ignored) */
  pivot: THREE.Vector3;
}

export interface RigFrame {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  /** Laptop yaw in radians (0 = screen faces the camera, PI = lid faces it) */
  yaw: number;
  /** Index of the sticker currently in focus, or -1 */
  activeIndex: number;
}

export interface Rig {
  /** Total length in "timeline units". Multiply progress (0..1) by this. */
  duration: number;
  evaluate(t: number, out: RigFrame): RigFrame;
}

/* ---- Tweakable feel (all in timeline units; scroll length is separate) ---- */
const FRONT_HOLD = 0.4;
const TURN = 2.2;
const BACK_PAUSE = 0.5;
const GLIDE = 1.6;
const HOLD = 1.2;
const RETURN = 2.2;
const END_HOLD = 0.6;

const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** Quintic ease in/out. Zero velocity AND acceleration at both ends. */
const smootherstep = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);

/** How far back the camera sits to frame one sticker, by screen shape. */
export function getStickerFramingDist(aspect: number): number {
  if (aspect < 1.0) {
    return Math.min(3.6, 1.9 / Math.max(0.48, aspect * 1.15));
  }
  return 1.9;
}

/** How far back the camera sits to frame the whole lid, by screen shape. */
export function getFullViewDist(aspect: number): number {
  if (aspect < 1.0) {
    const tanHalfFov = Math.tan((45 * Math.PI) / 360);
    return Math.max(5.2, (4.2 * 1.1) / (2 * tanHalfFov * aspect));
  }
  return 4.8;
}

interface Pose {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  yaw: number;
}

interface Segment {
  t0: number;
  t1: number;
  a: Pose;
  b: Pose;
  /** Sticker in focus during this segment (-1 = none) */
  sticker: number;
  /** Only report the sticker as active after this fraction of the segment */
  activeFrom: number;
}

const clonePose = (p: Pose): Pose => ({
  pos: p.pos.clone(),
  target: p.target.clone(),
  yaw: p.yaw,
});

export function buildRig(
  data: RigModelData,
  aspect: number,
  reducedMotion: boolean
): Rig {
  const fullDist = getFullViewDist(aspect);
  const stickerDist = getStickerFramingDist(aspect);
  const pivot = data.pivot;

  // Laptop-space -> world-space once the laptop has turned by PI about the pivot.
  const turnedPoint = (v: THREE.Vector3) =>
    v.clone().sub(pivot).applyAxisAngle(Y_AXIS, Math.PI).add(pivot);
  const turnedDir = (v: THREE.Vector3) =>
    v.clone().applyAxisAngle(Y_AXIS, Math.PI).normalize();

  // 1. Front pose: laptop un-turned, camera on the screen side.
  const front: Pose = {
    pos: new THREE.Vector3(
      data.frontCenterPos.x + fullDist + 1.4,
      1.25,
      data.frontCenterPos.z
    ),
    target: data.frontCenterPos.clone(),
    yaw: 0,
  };

  // 2. Back pose: laptop turned, lid facing the camera, camera stays on its side.
  const backTarget = turnedPoint(data.backCenterPos);
  const back: Pose = {
    pos: new THREE.Vector3(backTarget.x + fullDist, 1.35, backTarget.z),
    target: backTarget,
    yaw: Math.PI,
  };

  // 3. One pose per sticker (laptop already turned).
  const stickerPoses: Pose[] = data.targets.map((t) => {
    const target = turnedPoint(t.pos);
    const normal = turnedDir(t.normal);
    return {
      pos: target.clone().add(normal.multiplyScalar(stickerDist)),
      target,
      yaw: Math.PI,
    };
  });

  // Reduced motion: the camera never moves, only the highlighted sticker does.
  const still = (p: Pose): Pose => (reducedMotion ? clonePose(back) : p);

  const segments: Segment[] = [];
  let t = 0;
  const add = (
    dur: number,
    a: Pose,
    b: Pose,
    sticker = -1,
    activeFrom = 0
  ) => {
    segments.push({ t0: t, t1: t + dur, a, b, sticker, activeFrom });
    t += dur;
  };

  add(FRONT_HOLD, front, front);
  add(TURN, front, back); // laptop turns, camera + target glide together
  add(BACK_PAUSE, back, back);

  let prev = back;
  stickerPoses.forEach((sp, i) => {
    const pose = still(sp);
    add(GLIDE, prev, pose, i, 0.375); // active from ~0.6 units into the glide
    add(HOLD, pose, pose, i, 0);
    prev = pose;
  });

  add(RETURN, prev, back);
  add(END_HOLD, back, back);

  const duration = t;

  return {
    duration,
    evaluate(time, out) {
      const tt = Math.min(Math.max(time, 0), duration);
      let seg = segments[segments.length - 1];
      for (const s of segments) {
        if (tt <= s.t1) {
          seg = s;
          break;
        }
      }
      const span = seg.t1 - seg.t0;
      const raw = span > 0 ? (tt - seg.t0) / span : 1;
      const k = smootherstep(Math.min(Math.max(raw, 0), 1));

      out.pos.lerpVectors(seg.a.pos, seg.b.pos, k);
      out.target.lerpVectors(seg.a.target, seg.b.target, k);
      out.yaw = seg.a.yaw + (seg.b.yaw - seg.a.yaw) * k;
      out.activeIndex =
        seg.sticker >= 0 && raw >= seg.activeFrom ? seg.sticker : -1;
      return out;
    },
  };
}

export function createRigFrame(): RigFrame {
  return {
    pos: new THREE.Vector3(),
    target: new THREE.Vector3(),
    yaw: 0,
    activeIndex: -1,
  };
}
