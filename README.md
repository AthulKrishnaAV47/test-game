# StickLab — Ultimate Physics Sandbox

A 2D stickman physics playground for the desktop browser. Real Matter.js bodies, articulated ragdolls, ~48 spawnable objects, ropes, springs, explosions, bendable gravity, 15 physics challenges, a build mode and a destruction arena — all drawn procedurally with vector art (no image assets, no backend, no accounts).

**Stack:** HTML/CSS/ESM · Phaser 3.90 · Matter.js 0.20 · Vite 7 · localStorage

---

## Install & run

Requires **Node ≥ 20.19**.

```bash
npm install
npm run dev          # dev server → http://localhost:5173/
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server on `0.0.0.0:5173` with hot reload |
| `npm run build` | Production bundle into `dist/` (~1.5 MB, 332 kB gzipped Phaser chunk) |
| `npm run preview` | Serve the built bundle → http://localhost:4173/ |
| `npm test` | Unit tests (Vitest, `tests/**/*.test.js`) |
| `npm run test:watch` | Unit tests in watch mode |

There is no build step needed for development and nothing to configure: open the URL and the menu appears. Progress, settings and saved layouts live in `localStorage`; no data leaves the browser.

The dev server binds to `0.0.0.0` with `allowedHosts: true` so it also works through a proxy/container host (e.g. a cloud IDE preview URL).

---

## Controls

| Input | Action |
| --- | --- |
| `A` / `D` (or `←` / `→`) | Walk the active ragdoll |
| `W` / `Space` | Jump |
| Left mouse | Use the active tool (select, grab, spawn, force, explode, rope, erase, draw) |
| Left drag | Grab & throw (Grab tool) or marquee-select (Select tool) |
| Shift + click | Add to selection |
| Right drag | Pan the camera |
| Wheel | Zoom (clamped 0.35× – 2.2×) |
| `1` … `0` | Select, Grab, Move, Spawn Ragdoll, Spawn Object, Apply Force, Explosion, Rope/Joint, Eraser, Draw Platform |
| `G` | Toggle gravity |
| `P` / `Esc` | Pause / resume (physics freezes, UI stays live) |
| `.` / `,` | Step exactly one physics frame |
| `R` | Reset the scene to its start state |
| `Z` / `Y` | Undo / redo |
| `Del` / `Backspace` | Delete selection |
| `Ctrl` + `D` | Duplicate selection |
| `Ctrl` + `S` | Save the current layout |
| `H` / `F` | Toggle clean HUD / fullscreen |

All of the above are remappable in **Settings → Controls** (stored locally). Shortcuts never fire while you are typing in a text field.

---

## Modes

- **Free Sandbox** — everything unlocked: all objects, forces, gravity presets, save/load, undo/redo and live property inspection.
- **Challenge Mode** — 15 puzzles (knock a ball into a target, launch a ragdoll onto a platform, build a crate bridge, swing on a rope, three targets with one explosion, obstacle course, lever platform, low-gravity puzzle, cannon to a goal, chain reaction, conveyor transport, pulley lift, moving platforms, ragdoll launcher, final playground). Each has an objective, a prepared level, retry/next and a 0–3 star score.
- **Build Mode** — grid snapping, duplication, joints, layout saving and a Test toggle that runs the physics and then returns you to the editor with the design intact.
- **Destruction Arena** — score driven by real simulation events: objects destroyed, biggest impact force, ragdolls launched, longest explosion chain.

---

## Features

**Ragdolls** — 15-part figures (head, torso, pelvis, upper/lower arms, thighs, shins) joined by 14 real constraints with per-preset stiffness, damping and joint limits. Stance control keeps them standing and walking through physics (gravity compensation + pose spring + relative joint-angle hold), never keyframes. Five presets (Lightweight, Heavyweight, Flexible, Stiff, Bouncy) plus limb grabbing and blast launches.

**Object library (~48)** — crates, metal boxes, balls, heavy spheres, planks, bricks, barrels, ice, platforms, ramps, walls, glass, springs, pendulums, seesaws, levers, pistons, conveyors, moving/rotating platforms, motor wheels, hinges, pulleys, ropes, chains, explosive barrels, bouncy pads, cannons, gravity wells, magnetic fields, wind generators, freeze zones, slow-motion fields, teleporters, breakable crates, spike hazards, goal zones and ragdolls. Every one is selectable, draggable, deletable and editable, and bodies are capped (300 soft / 480 hard) with debris, particle and ragdoll limits.

**Physics tooling** — push/pull/impulse/radial blast, a click-drag launch arrow that previews direction and magnitude (strength-limited and safety-capped), explosions with radius falloff, screen shake and optional chains, ropes/chains/springs between any two bodies, destructible objects with health, impact damage, debris and cleanup, per-object gravity participation and nine gravity presets (including reversed, sideways and zero-g).

**UI** — left toolbar with active highlighting, searchable object library with categories/favourites/recents and real previews, an inspector that only shows meaningful properties (mass, friction, bounciness, durability, velocity, angular velocity, gravity participation, colour, lock…) with immediate effect, a persistent simulation toolbar (play/pause/step/reset/clear/speed 0.25–2×/gravity/undo/redo/save/load), collapsible panels, status bar with body count and FPS, tooltips, confirmation dialogs and toast notifications.

**Audio & VFX** — procedural WebAudio SFX (impacts per material, wood, metal, springs, explosions, ragdoll hits, UI clicks) with throttling, a generated music loop, and a particle/effects layer (impact dust, sparks, cartoon explosion clouds, flashes, motion trails, optional screen shake). Every effect group can be disabled in Settings.

**Saving** — layouts serialise to versioned JSON (scene id, unique IDs, transforms, physics properties, colours/cosmetics, joints, gravity config, sim settings, custom platforms) with named saves, overwrite confirmation, export/import, strict validation before any body is created and a fallback scene if storage is corrupted. Imported JSON is data only and never executed.

**Achievements** — nine achievements (First Ragdoll, Physics Beginner, Master Builder, Explosion Expert, Chain Reaction, Gravity Explorer, Challenge Champion, Destruction Expert, Sandbox Architect) unlock ragdoll colours, hats, visors and themes. Local progress only: no ads, no logins, no purchases.

---

## Project layout

```
src/
  config/     gameConfig, objectCatalog, propSchema, levels, challenges, achievements
  core/       GameWorld (world assembly), services, SettingsManager, storage
  physics/    PhysicsManager, RagdollFactory, BodyShapes, Contraptions,
              ConstraintManager, ForceManager, CollisionManager, FieldBehaviors
  entities/   PhysicsObject, Prop, Ragdoll
  render/     Renderer (layered, culled drawing), drawers, CanvasGraphics
  systems/    ObjectSpawner, DestructionManager, EffectsManager, StatsManager,
              AchievementManager, CharacterManager, SelectionSystem,
              UndoRedoManager, SaveManager, CameraController, InputManager,
              ToolSystem, ChallengeManager, ArenaManager
  scenes/     Boot, Menu, Game (shared), Challenge, Arena, Build
  ui/         UIManager, HudUI, LibraryPanel, InspectorPanel, MenuScreen,
              modals, widgets, dom, icons, previews
  services/   SFX (procedural WebAudio)
  styles/     main.css (theme, HUD layout, responsive rules)
  utils/      mathUtils, validation, coordinateUtils, ids, events, colorUtils, device
scratch/      Node harnesses: ragdoll/control smoke tests, diag scripts,
              headless_boot.mjs (jsdom integration run of the real game)
```

---

## Testing

```bash
npm test                                    # unit tests (Vitest)
node scratch/smoke_ragdoll.mjs              # ragdoll physics smoke test
node scratch/smoke_control.mjs              # walk/jump/stance calibration
npx vite build --config scratch/vite.ssr.config.mjs   # bundle the game for Node
node scratch/headless_boot.mjs              # jsdom integration harness
```

The headless harness boots the **real** game (Phaser, Matter world, systems and DOM UI) inside jsdom with a stubbed canvas, then exercises gravity, spawning, ragdolls, forces, explosions, ropes, pause/single-step, undo/redo, save/load round-trips, malformed-import rejection and every game mode. It is the substitute for browser testing in environments without a GUI browser — interactive and visual checks still need a real browser.

---

## Notes

- Physics runs on a fixed 1/60 s step driven by `PhysicsManager`; the simulation speed changes how many steps happen per frame, never the step size, so behaviour is deterministic and tab suspension is clamped.
- Matter 0.20 has no per-body `gravityScale`, so objects that opt out of gravity get an exact counter-force each step.
- Nothing in `src/` imports the npm `matter-js` package: the runtime uses Phaser's bundled Matter (`import * as Phaser from 'phaser'`), while `matter-js` and `jsdom` are dev dependencies for the Node harnesses and tests.
