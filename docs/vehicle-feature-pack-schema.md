# JARVIS Vehicle Feature Pack v1

Vehicle Feature Packs extend JARVIS with manufacturer/ECU-specific diagnostic and coding recipes while keeping the core app generic.

## Principles

- Generic OBD-II diagnostics remain built into the app.
- Manufacturer-specific module scans, adaptations and coding are loaded from verified packs.
- Each write feature must have a read-current-value path, a write path and a verification path.
- JARVIS backs up the current value before enabling a write.
- Unsupported or unverified recipes remain visible as unavailable; JARVIS must not guess write bytes.
- Immobilizer/key programming, odometer manipulation and crash-data/SRS bypass recipes are not accepted.

## JSON shape

```json
{
  "schemaVersion": 1,
  "brand": "Volkswagen",
  "packVersion": "2026.09.1",
  "recipes": [
    {
      "id": "vag.comfortBlink.passat-b8",
      "featureID": "vag.comfortBlink",
      "brand": "Volkswagen",
      "module": "BCM",
      "protocolFamily": "UDS / ISO 14229",
      "readCurrentValueSteps": [
        {
          "operation": "readDataByIdentifier",
          "requestHex": "22XXXX",
          "expectedPositivePrefixHex": "62XXXX",
          "description": "Read current adaptation value"
        }
      ],
      "writeSteps": [],
      "verifySteps": []
    }
  ]
}
```

The example intentionally does not contain a vehicle-specific write command. Production write recipes must be verified against the exact ECU/module variant before registration.
