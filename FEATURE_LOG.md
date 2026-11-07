# Feature Log

## Planned (Not Yet Built)
- CRT loading screen
- Movie-style credits ("from PESCE", "Under PESNEXT", InUnity credit, wording is placeholder)
- Animated Ennovate logo
- Zoom-out reveal that the intro plays on a laptop screen
- Click a sticker to open its section as a normal scrolling page
- Scrolling back up past the top glides back to the sticker
- Editable projects, achievements and members via admin login
- Dark moody desk scene lit by one lamp, green cutting mat, dark brown wooden desk

## Built in Phase 1
- Initial repository setup with Next.js App Router, TypeScript, Three.js, React Three Fiber, React Three Drei, and GSAP ScrollTrigger
- Placeholder laptop 3D model integration (`public/models/laptop.glb`) with configurable lid node name (`Cube.001`)
- Dark scene configuration with single warm spotlight, faint ambient, and dark flat ground plane
- Dynamic sticker positioning system (`src/config/stickers.ts`) computed from lid bounding box
- Disc placeholders (with numbers) and orange logo ring on lid outer back panel
- Scroll-driven 3D camera tour (front view -> turn -> sticker sequence -> back view). Camera rig lives in `src/lib/cameraRig.ts`: ONE clock drives camera position, look-at target and laptop turn together, so the camera always follows the laptop. The laptop turns around the centre of its lid (not the world origin). ScrollTrigger only reports a progress number; the 3D scene reads it every frame with damping. No timeline rebuilds on resize (phone address-bar safe), no React re-render per scroll tick.
- Fix: spotlight now exists on first render (was missing until first scroll)
- Fix: 3D stage is `position: fixed` (scroll only supplies distance), so it can't scroll away. Previously overflow-x:hidden on html+body broke `position: sticky`. No overflow hacks are used anywhere.
- Contract: the laptop NEVER moves; it only yaws in place around its own centre. All framing/zoom is done by the camera. Scroll is just the 0..1 timeline clock.
- Responsive framing (mobile, tablet, desktop, ultrawide) with DPR caps (1.5 mobile, 2 desktop)
- WebGL failure fallback showing styled section list
- Prefers-reduced-motion accessibility support

