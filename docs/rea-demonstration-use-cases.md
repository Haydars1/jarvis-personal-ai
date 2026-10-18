# REA use cases from supplied Brick Radar videos

The three videos are social-media demonstrations, **not** source code, MCP implementations or permission to control devices.

## 1. Video-to-interface analysis
Analyze an authorized video for typography, animation timing, layout, motion curves and scene transitions. Produce a storyboard and original implementation plan, not a copied proprietary application. Output: `ui_reverse_engineering_report` with time-coded evidence.

## 2. Remote-control-to-MCP adapter
For a user-owned air conditioner or remote, first identify manufacturer, model and supported documented protocol/API. Build an authenticated adapter with allowlisted actions (power, temperature, fan mode), status reads, confirmation for risky actions and no arbitrary network scanning. Output: an interface specification and mocked tests until real hardware is paired.

## 3. Home dashboard / 3D control
Combine authorized smart-home devices into a room dashboard; separate visualization from actual device commands. Require explicit device pairing, permission scoping, and state reconciliation. A 3D house mockup does not imply real device control.

## Implementation order
- First: REA research skill and evidence format (added in this PR).
- Next: adapter interfaces, tests and mock demo.
- Last: MCP runtime registration and actual device connections after explicit approval.

## Evidence
User-provided three short videos illustrate these concepts but do not establish product capabilities or API availability.
