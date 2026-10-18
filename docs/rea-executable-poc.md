# Executable REA proof of concept

This is the first **working code module**, not a fully connected reverse-engineering engine or device controller.

Run from repository root:
```bash
node --test tests/rea-analyze.test.js
```

The `analyzeTarget()` function accepts explicit authorization scope and evidence observations, outputs a feature matrix with uncertainty labels, and `generateAppStarter()` returns a runnable read-only Node HTTP mock service plus JSON evidence. It never asserts real hardware connectivity.

## Example
```js
import { analyzeTarget, generateAppStarter } from './scripts/rea/analyze.mjs';
const report=analyzeTarget({
  name:'My owned printer',platform:'device',
  authorization:{approved:true,scope:'local device inspection'},
  observations:[{source:'official manual',description:'Ink status',confidence:'verified'}]
});
const files=generateAppStarter(report);
```

Next engineering work: source adapters for documented HTTP/BLE/USB protocols, interactive UI scaffolding, packaging and actual hardware test harness. External REA MCP setup remains separate and is not yet active. The ChatGPT platform's built-in tool permissions cannot be modified by code in this repository.
