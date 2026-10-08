# 6006coding — isolated production source

This branch is **only** for the 6006 Performance site. JARVIS main is untouched.

## Build and validate

```bash
npm install
npm run build
```

The build downloads a pinned, SHA256-verified static release archive (586d1cd9eee85c7cb861c8dd03470ba97a1b7143d75b0b351beb0813cc236df0), extracts its `public/` contents, and validates:
- 5 pages;
- at least 18,000 DTC definitions;
- 17 component illustrations.

The archive is permanently stored in the site's Floot asset storage:
https://6006-performance.floot.app/_cdn/static/2e6d5cc2-19fa-4ff2-b7e3-e989b3788eed-6006coding-source-release.zip

## Automatic deployment with Render

Create a Render Static Site connected to this **GitHub repository**, selecting branch `6006coding-production`, build command `npm install && npm run build`, and Publish Directory `public`, with Auto Deploy ON.

Test the Render host first. Only then change `6006coding.de` DNS to the exact values Render shows, retaining MX, TXT and email-related records.

New releases: create a new full source archive, verify its SHA256, and update both `archiveUrl` and `expectedSha256` in `scripts/build.mjs`. Every push then triggers validation and Render deployment.

## Note

The static release is self-contained after a successful build, but **the pre-build source archive currently lives in Floot storage**. Move this archive into the repository or stable release storage when possible so the build has no external source dependency. Images are illustrative, not vehicle-specific OEM drawings. DTC source: Wal33D/dtc-database (MIT).

Never edit JARVIS main or change DNS as part of the build job.
