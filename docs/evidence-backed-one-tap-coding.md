# Evidence-backed one-tap vehicle coding

JARVIS separates feature discovery from write execution.

## Research sources

A feature can be discovered from public factual sources such as:
- Ross-Tech Wiki / forum procedures
- GitHub vehicle-diagnostics research projects and logs
- model-specific owner forums
- Reddit experience reports
- JARVIS field captures from an actually connected car

Every normalized feature stores its source URL, source type and confidence. Public repositories are not bulk-copied when their license does not clearly permit redistribution; JARVIS stores independently normalized factual mappings and provenance instead.

## Applicability

Before a feature is offered as one-tap, JARVIS compares:
- VIN-derived brand/year
- model/platform identity read from the car
- installed control units
- ECU part number / hardware
- ECU software version
- detected equipment/options

A feature may be shown as:
- Uygun — applicability checks pass
- Kontrol gerekli — required identity/equipment data is missing
- Uygun değil — a hard requirement does not match

## One-tap write gate

A research feature is not automatically executable.

Each semantic operation (for example: 09-Cent.Elect / comfort blink cycles = 4) must resolve to an exact SemanticCodingMapping for the connected ECU part/software identity. That mapping contains a verified CodingRecipe.

Execution flow:
1. Read current value(s)
2. Save backup
3. Ask for user confirmation
4. Apply exact verified write recipe
5. Re-read and verify
6. Keep an audit log

If any exact mapping is missing, the UI can still explain the feature and sources but does not expose the write button.

## Initial researched seed

The first seed includes documented Passat B8/MQB convenience features:
- comfort turn-signal cycles
- lock/unlock acoustic feedback
- remote locking with ignition on
- passenger mirror dip in reverse
- instrument needle sweep

The catalog also contains lower-confidence discovery-only BMW convenience entries. BMW exact FDL mappings remain locked until a CAFD/version-specific mapping is verified.

## Expansion

The intended expansion loop is:
1. Search public sources for a model/platform
2. Normalize factual feature/channel/bit information
3. Corroborate with at least one additional source where possible
4. Capture module part/software identity on a real car
5. Verify read/write/rollback on that exact variant
6. Register a semantic mapping
7. One-tap becomes available only for matching vehicles

This architecture is designed to scale to VAG, BMW/MINI, Mercedes-Benz, Ford, Opel, Renault/Dacia, PSA/Stellantis, Toyota/Lexus, Hyundai/Kia and other manufacturer packs without hard-coding every vehicle into the UI.
