# JARVIS ECU Part Number Catalog

This is a separate, opt-in ECU part-number catalog. It does not change ECU tuning, KT200, Thinkdiag, coding, binary editing, or existing chat routes.

## Reference site

https://www.controlunits.info/partnumbers/

Seven sections are referenced: Bosch, Ford, Mazda, VAG (Volkswagen/Audi/Skoda/Seat), Peugeot, Citroen, MAN. Source details sometimes include ECU type, manufacturer, software part number, software version, brand, model and engine.

No full third-party website data is bundled, collected or auto-scraped. Public accessibility by itself does not establish database-reuse permission; secure bulk export permission before using third-party source data.

## Additive features

- Dedicated Cloudflare D1 table: ecu_part_catalog. Idempotent schema setup; no updates to existing tables.
- GET /api/ecu/partnumbers/stats: number of imported records.
- GET /api/ecu/partnumbers/search?q=0261200001&group=bosch: normalized part-number search or text lookup.
- POST /api/ecu/partnumbers/import: JSON with authorized=true, a descriptive rights_basis, and 1-200 records per batch. All records validated before DB batch.
- Separate catalog UI in desktop and mobile navigation. Filters, uploads authorized CSV or JSON, and links selected ECU metadata to the JARVIS chat input.
- Global frontend interface window.jarvisEcuParts.search(query,group) and custom event jarvis:ecu-part-selected are available for future ECU subsystem integrations.

## Input

CSV header fields: group,part_number,ecu_type,manufacturer,brand,model,engine,software_part_number,software_version,description,source_url,notes.

Minimal JSON file is an array of objects such as [{"group":"vag","part_number":"021906018A","ecu_type":"Bosch ME7.1"}].

The import API accepts: {"authorized":true,"rights_basis":"Documented permission or owned data","records":[{"group":"vag","part_number":"021906018A"}]}

## Quality and deployment

Run npm run check and npx wrangler deploy --dry-run on the feature branch, then manually verify search and import against a D1 preview database before merging. No external crawl, main merge, production deploy or secrets update is part of this change.

The catalog has zero initial records until authorized CSV/JSON data is supplied. Do not label it complete until its imported count is verified.

## Rollback

Remove the catalog import/wrapper/route from src/app-entry.js and its one script reference from public/index.html. No existing data/schema is changed. Catalog table can remain harmlessly unused.
