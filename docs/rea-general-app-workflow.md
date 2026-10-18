# General reverse-engineering-to-app workflow

The user-supplied Brick Institute post illustrates a **method**: an AI agent inspects a software or device interface, determines how its behavior works, then builds a distinct application suited to the user's needs. Climate-control, smart-home, video and car examples are demonstrations only, not a fixed feature list.

## Pipeline
Target -> authorization and inventory -> passive observation -> screen/feature/state map -> API/protocol evidence -> original architecture -> independent implementation -> mock tests -> authorized hardware tests -> delivery.

## Suggested task record
```json
{
  "target": {"category": "mobile-app|desktop-app|web-app|device", "name": "", "model": "", "version": ""},
  "authorization": {"scope": "", "approved": false},
  "evidence": [],
  "features": [],
  "state_transitions": [],
  "interfaces": [{"name": "", "status": "observed|documented|hypothesis|tested"}],
  "deliverable": {"platform": "web|ios|android|windows|macos", "original_design": true},
  "tests": {"mock": "pending", "device": "pending"}
}
```

## Execution rule
REA skill and MCP server are optional tools in a separate authorized runtime. If unavailable, use source inspection and documented interfaces where possible, and mark limitations. Do not claim a device app was built merely because an analysis skill exists.
