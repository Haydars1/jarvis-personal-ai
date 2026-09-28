# JARVIS iOS test-build policy

The iOS app is developed continuously on `feature/learning-engine`, but normal code pushes do **not** publish a new IPA.

## Why

Vehicle diagnostics work often spans several dependent pieces at once: Bluetooth transport, DTC parsing, manufacturer routing, offline data, coding safety, workshop UX, and regression tests. Installing an IPA after every small commit wastes time and makes it hard to tell whether a failure belongs to an unfinished feature or a finished one.

## Development loop

1. Implement a coherent batch of diagnostic/coding improvements.
2. Run repository tests continuously.
3. Run the native iOS compile workflow on iOS changes.
4. Keep iterating while a batch is incomplete.
5. Only when the batch is test-ready, manually run **Build JARVIS Workshop Beta IPA**.
6. That workflow first runs the full repository validation, then simulator compilation, then an iPhone Release compilation, and publishes one consolidated IPA artifact.

## Test-build rule

A new IPA should be requested only when at least one of these is true:

- a complete workshop workflow is ready for physical ThinkDiag validation;
- a real-device protocol assumption must be tested and cannot be verified in CI;
- a previous device test exposed a blocker that is fixed and the related regression checks pass;
- a milestone contains enough changes to justify reinstalling the app.

Small UI tweaks, catalog additions, backend research updates, source cleanup, and unit-test-only changes should not create a new IPA by themselves.

## Physical-device validation checklist

Before asking for another IPA install, the candidate should pass:

- `npm run check`;
- native simulator compile;
- native iPhone Release compile;
- offline DTC database loading;
- ThinkDiag reconnect/scan path compiles;
- protocol confirmation gate compiles;
- coding voltage preflight compiles;
- backup/write/verify paths compile;
- workshop report/session paths compile.

The remaining physical test should be a specific hardware question, not general trial-and-error.
