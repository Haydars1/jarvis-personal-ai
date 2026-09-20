# Cloudflare Builds: validation without production deployment

## Diagnosis (2026-09-20)

At commit `9cb774ac15629e8e959feb8fb4dc82af70db7624`, no tracked file
contains `versions upload`. The supplied Cloudflare log executes
`npx wrangler versions upload` directly as its user deploy command.
GitHub also reports a separate failing `Workers Builds: jarvis-personal-ai`
check. This command comes from external Workers Builds configuration, not
the repository's package scripts or GitHub Actions.

Read-only dashboard verification confirmed these Settings > Builds values:

- Production branch: `main`.
- Build command: empty.
- Deploy command: `npx wrangler deploy`.
- Version command: `npx wrangler versions upload`.
- Builds for non-production branches: enabled.
- Root directory: `/`; watch include paths: `*`.

The failing build is for `feature/ecu-brain`, so its command originates in
the **Version command** field. A push to that branch triggers version upload,
not production deployment. The `/production/builds/` URL alone is not evidence
that a feature build deploys production. Settings may change; inspect them
again before subsequent pushes when their production effects are unknown.

- `.github/workflows/ecu-brain-ci.yml`: feature-branch tests and dry-run only.
- `.github/workflows/deploy-cloudflare.yml`: real deployment on `main` push
  or manual dispatch, including remote D1 writes and secret updates. Do not
  dispatch it or merge to `main` without explicit production approval.
- `.github/workflows/jarvis-self-update.yml`: PR auto-merge only for `jarvis/`
  branches; it does not match `feature/ecu-brain`.
- `.github/.github/workflows/`: nested copies, not active GitHub workflows.
- `package.json`: `deploy` is a real `wrangler deploy`; never use it for validation.
- `wrangler.jsonc`: `ecu-container-v1` creates the SQLite-backed
  `EcuComputeContainer`, bound as `ECU_COMPUTE_CONTAINER`.

## Safe repository validation

Install dependencies, then run:

```sh
npm run cloudflare:validate
```

This runs syntax checks, tests and
`wrangler deploy --dry-run --containers-rollout=none`. It bundles
locally into the ignored `.wrangler-dry/` directory. It does not upload a
version, apply remote migrations, update secrets, provision resources, or
deploy production. ECU Brain CI uses the same `check:cloudflare` command
after its test step and separately tests/builds the Python compute container.
Config regression tests check migration/binding/container consistency.
The `--containers-rollout=none` flag avoids requiring Docker for local Worker
validation; it is safe here because it is paired with `--dry-run`. Used alone,
it would still deploy Worker code and is not a substitute for `--dry-run`.

Dry-run success does **not** establish that the account's migration is applied,
that a container image can be deployed, or that production is healthy.

## Account-side configuration still required

In Workers & Pages > jarvis-personal-ai > Settings > Builds, inspect the
production branch, build command, deploy command, and non-production branch
deploy command before pushing if their production effects are unknown.
For validation-only feature builds, the recommended replacement for the
failing non-production **Version command** is:

```sh
npm run cloudflare:validate
```

Do not automatically replace `versions upload` with `wrangler deploy`.
That would apply migrations and change the live Worker. Repo scripts alone
cannot override a dashboard command that calls `npx wrangler` directly.
If the failing command is configured in the production slot, changing that
slot also needs deliberate account-side review; do not change it blindly.
No account setting is changed by this repository patch.

## Hard blocker: pending production Durable Object migration

The supplied build log explicitly rejects the pending migration. Applying it
requires a separately approved `wrangler deploy` against the intended Worker.
Until that production operation is approved and completed, version upload
remains blocked. Recheck account state before any later authorized deployment.
Never delete/rename the migration, remove the binding, or use a different
production namespace to make the upload pass. Container configuration/image
changes also require deploy; version upload alone is insufficient.

Reverting this commit reverses only the repository validation changes; it
does not reverse any future account-side Durable Object migration.

References:
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- https://developers.cloudflare.com/containers/guides/deploy/
- https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/
