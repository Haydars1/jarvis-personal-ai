# Manufacturer diagnostics pack v2

This pack format lets JARVIS support full-system ThinkDiag diagnostics without hard-coding one brand into the iOS app.

Each pack declares:
- brand and version
- module routes and ThinkDiag VCI opcode
- optional diagnostic-session / keep-alive frames
- module DTC read/clear commands
- identification and live-data DIDs
- verified coding/adaptation recipes

JARVIS can then:
1. connect directly to ThinkDiag
2. enter the module route
3. read module identification
4. read module DTCs
5. decode UDS negative responses
6. expose live-data DIDs
7. back up a coding/adaptation value
8. require confirmation before a write
9. write the verified recipe
10. re-read and verify

Unknown write commands are never synthesized. A feature remains unavailable until an exact module recipe is loaded.

## Minimal module example

```json
{
  "schemaVersion": 2,
  "brand": "Volkswagen",
  "packVersion": "2026.09.1",
  "supportedVINPrefixes": ["WVW", "WVG"],
  "modules": [
    {
      "id": "engine",
      "name": "Engine ECU",
      "address": "01",
      "protocolFamily": "UDS / ISO 14229",
      "transport": {
        "vciOpcode": 4097,
        "requestPrefixHex": null,
        "responsePrefixHex": null
      },
      "enterSessionHex": "1001",
      "keepAliveHex": "3E00",
      "readDtcHex": "1902FF",
      "clearDtcHex": "14FFFFFF",
      "identificationDIDs": [],
      "liveDataDIDs": []
    }
  ],
  "codingRecipes": []
}
```

The example is intentionally diagnostic-only. Real coding recipes must be verified against the exact module/software variant before use.
