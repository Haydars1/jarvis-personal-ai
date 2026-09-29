# ECU bridge smoke test without a vehicle

The mock adapter lets you verify the entire JARVIS cloud → local bridge → adapter → result path without connecting a car.

## 1. Start the mock adapter

```powershell
node .\local-bridge\mock-adapter.mjs
```

It listens on `http://127.0.0.1:8765` and advertises **read-only** simulated capabilities:
- read DTC
- read live data
- read long coding
- read adaptation

Every result contains `"simulated": true`. It never touches a vehicle.

## 2. Register a bridge in JARVIS

Open **ECU Studio → CİHAZ → YENİ BRIDGE TOKEN** and copy the one-time token.

## 3. Start the local bridge

```powershell
$env:JARVIS_URL="https://haydojarvis.workers.dev"
$env:JARVIS_BRIDGE_TOKEN="<token>"
$env:ECU_ADAPTER_URL="http://127.0.0.1:8765"
node .\local-bridge\ecu-bridge.mjs
```

## 4. Queue a read job

Use ECU Studio → CİHAZ or the ECU chat channel:
- “DTC arıza kodlarını oku”
- “canlı veriyi göster”
- “long coding oku”
- “adaptasyon değerlerini göster”

The cloud job should move `pending → running → completed` and its result should contain `simulated: true`.

## Adding real hardware

Copy `local-bridge/adapter-template.mjs` and implement only capabilities that the actual device API or driver supports. Do not advertise unsupported capabilities; JARVIS refuses to dispatch those jobs to that adapter.
