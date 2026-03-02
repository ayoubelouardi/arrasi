# Release Readiness Guide (v1)

This guide defines reproducible release checks, deployment steps, and rollback actions for self-hosted deployments.

## Environment setup

- Node.js 22.x LTS and npm 10+
- Install dependencies:

```bash
npm ci
```

## Acceptance and regression gate

Run the full quality gate before a release candidate:

```bash
npm run acceptance
```

This command runs:
- `npm run typecheck`
- `npm run lint`
- `npm test -- --run`
- `npm run build`

### SRS 6.3 acceptance checklist

- [x] CRUD, reorder, duplicate, and cascade flows preserve referential integrity.
- [x] Workout start/resume/complete flows log progress correctly.
- [x] Export/import merge+replace validation is transactional and safe.
- [x] Offline queue replay works with retry/backoff and deterministic conflicts.
- [x] No analytics calls or outbound requests beyond configured Supabase endpoint.

## Deployment (static hosting)

1. Build production assets:

   ```bash
   npm run build
   ```

2. Deploy `dist/` to static hosting (Nginx, Caddy, Netlify, Cloudflare Pages, or any static file server).
3. Verify:
   - app loads without console errors,
   - Programs/Today/History/Settings routes render,
   - export backup flow succeeds.

## Rollback guidance

1. Keep versioned build artifacts per release (`dist` bundle snapshot).
2. If regression is detected, redeploy the previous artifact immediately.
3. Ask users to restore from their latest JSON backup if local data was overwritten during a failed replace/import operation.
4. Re-run `npm run acceptance` on the rollback candidate before promoting it again.

## Release candidate tagging

After acceptance passes:

```bash
git tag -a v1.0.0-rc.1 -m "Release candidate v1.0.0-rc.1"
git push origin v1.0.0-rc.1
```
