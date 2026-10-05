# 6006 Fault Visual System v3 — Design

## Goal

Create a premium but easy-to-read fault-code experience for 6006 Performance. Every supported fault page should visually explain where the affected system is located and how its relevant parts connect, without looking busy or pretending to know a specific vehicle brand/model.

## Core UX

Each fault detail page keeps the current fault title, severity, driving guidance, meaning, causes, diagnosis and solutions. Between the metadata and the detailed text, add one focused visual workspace with two layers:

1. **Generic vehicle silhouette** — a brand-neutral technical vehicle outline. It is used only to show approximate system location. It must not resemble BMW, Mercedes, VW, Ford or any other recognizable model.
2. **Simplified system flow** — a 4–6 node diagram showing only the parts relevant to the current fault family.

Only the relevant region and relevant flow path receive visual emphasis. Everything else stays dim and calm.

## Visual Language

- Background: near-black / graphite.
- Primary text: ivory / warm white.
- Accent: bronze / amber.
- Critical faults may use restrained red.
- No blue-heavy neon aesthetic.
- No dense HUD overlays.
- No more than one dominant highlight at a time.
- Motion is subtle: slow path flow, soft pulse on the active region, small focus glow on the active node.
- Respect `prefers-reduced-motion`.

## Scene Families

Initial supported scene families:

- `boost`
- `dpf`
- `scr`
- `brakes`
- `oil`
- `cooling`

The architecture must allow additional scenes later without changing `FaultPage` layout.

## Scene Content

### Boost

Vehicle highlight: front engine / charge-air area.

Flow: `Intake → Turbo → Actuator / Control → Boost sensor → Engine`.

Typical faults: P0299 and other boost-control faults.

### DPF

Vehicle highlight: underbody exhaust path.

Flow: `Engine → Exhaust pre-treatment → DPF → Differential pressure / temperature sensing → Tailpipe`.

### SCR / AdBlue

Vehicle highlight: underbody SCR path and rear tank area.

Flow: `AdBlue tank → Pump / module → Dosing injector → SCR catalyst → NOx sensing`.

### Brakes / ABS

Vehicle highlight: wheel areas plus central ABS/ESC module.

Flow: `Wheel-speed sensors → ABS/ESC control → Hydraulic unit → Brake circuits`.

### Oil

Vehicle highlight: engine / lower lubrication area.

Flow: `Sump → Oil pump → Filter → Pressure sensor → Engine lubrication`.

### Cooling

Vehicle highlight: engine front / cooling circuit.

Flow: `Water pump → Engine → Thermostat → Radiator → Coolant temperature sensing`.

## Component Boundaries

### `src/domain/fault-scenes.ts`

Pure scene data. Contains scene IDs, localized labels, nodes, edges, vehicle highlight regions and tone metadata. No React code.

### `src/domain/fault-scene-resolver.ts`

Maps a fault record/code/system to a scene family. It must return `undefined` when a scene cannot be identified confidently; the UI must not invent a technical visualization for unknown faults.

### `src/components/GenericVehicleSilhouette.tsx`

Renders one generic SVG vehicle. Accepts only generic highlight regions such as `front-engine`, `center-underbody`, `rear-underbody`, `wheels`, `engine-lower` and `cooling-front`.

It must contain no brand badges, signature grilles, distinctive lamps or model-specific proportions.

### `src/components/FaultFlowDiagram.tsx`

Renders 4–6 relevant system nodes and their connections. The active/focus node is visually stronger; secondary nodes remain subdued. On small screens the flow becomes a horizontal scroll or stacked sequence without reducing legibility.

### `src/components/FaultVisualCard.tsx`

Composes the generic silhouette and flow diagram into the visual workspace. Provides localized heading/caption and a concise explanation that the vehicle image is schematic, not model-specific.

## FaultPage Integration

Order:

1. Fault hero
2. Metadata cards
3. **Fault visual workspace**
4. Meaning
5. Symptoms / causes / diagnosis / solutions
6. Safety note
7. Support chat

If the resolver returns no scene, the visual workspace is omitted. Existing content remains available.

## Interaction

- No vehicle selector on the public fault page.
- No model-specific drawing.
- Optional node selection may reveal a concise node description, but the default state must already be understandable without interaction.
- At most one node is selected/focused at a time.
- The visual area must not become a second diagnostic dashboard full of live values.

## Localization

All new visible labels must support German, Turkish and English using the existing language model. The current browser/phone language behavior remains unchanged.

## Mobile

- Silhouette remains visible but simplified.
- Flow nodes remain readable at phone width.
- No tiny labels placed directly over complex SVG geometry.
- Tap targets meet mobile usability expectations.
- Animations are lower-intensity than desktop.

## Testing

Add tests for:

- P0299 resolves to `boost`.
- DPF-related fault resolves to `dpf` when present in current data.
- SCR / AdBlue fault resolves to `scr` when present in current data.
- ABS / brake, oil and cooling scenes resolve from current representative records.
- Unknown code does not create an invented scene.
- `FaultPage` renders `data-fault-visual="true"` for a mapped fault.
- Public fault page contains no vehicle selector.
- Generic silhouette does not receive brand/model props.
- Existing DE/TR/EN behavior stays green.
- Existing Worker/backend tests remain unchanged and green.

## Non-goals for this phase

- ECU tuning catalogue.
- Stage 1 / Stage 2 horsepower and torque data.
- Vehicle-specific tuning gains.
- Brand/model-specific vehicle silhouettes.
- Live OBD telemetry.

Those belong to the later ECU/tuning phase after the fault-code experience is complete.

## Release Strategy

Implement on `feat/6006-fault-visual-v3` using tests first. Run the full existing 6006 test/typecheck/build suite. Open a PR into `6006-performance`. Production deployment occurs only after the feature branch is green and reviewed.
