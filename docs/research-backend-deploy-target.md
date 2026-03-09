# Research: Backend Deployment Target

**Task:** 56b41854-227a-4d2a-b126-d87b0e851cfc  
**Date:** 2026-03-09  
**Author:** Neo (neo-worker)

## Platform Comparison

| Criteria | Railway | Fly.io | Render |
|----------|---------|--------|--------|
| **API/CLI Automation** | ✅ GraphQL API + CLI | ✅ REST API + CLI (`flyctl`) | ⚠️ Limited API, mostly Git-push |
| **Cost** | $5/mo Hobby ($5 credit) | $5/mo Hobby ($5 credit) | Free tier sleeps after 15min; Pro $19/user/mo |
| **Docker Support** | ✅ Native + Nixpacks | ✅ Native Dockerfile | ✅ Native Dockerfile |
| **GitHub Integration** | ✅ Auto-deploy from repo | ⚠️ Manual via GitHub Actions | ✅ Auto-deploy from repo |
| **Deploy Speed** | ~30-90s | ~60-120s | ~120-300s |
| **Simplicity** | ✅ Minimal config, GraphQL API | ⚠️ Requires fly.toml config | ⚠️ Requires render.yaml or dashboard setup |
| **Programmatic Deploy** | ✅ GraphQL mutations | ✅ Machines API | ⚠️ Deploy hooks only |

## Decision: **Railway**

### Why Railway wins:
1. **Best API for automation** — GraphQL API with mutations to create projects, trigger deploys, and check status. Perfect for our deploy handler pattern.
2. **Simplest setup** — No config files needed. Connects to GitHub repo, auto-detects framework (Nixpacks), deploys.
3. **Cost-effective** — $5/mo Hobby plan with $5 usage credit covers small services.
4. **GitHub native** — Auto-deploy on push, or trigger via API.
5. **Docker + Nixpacks** — Supports our existing Dockerfiles, or auto-builds without one.

### Why not the others:
- **Fly.io**: Great platform but requires `fly.toml` config per app, more complex API (Machines API), not as clean for automated project creation.
- **Render**: Free tier sleeps services after 15min inactivity (unusable for APIs). Pro plan is $19/user/mo. Deploy API is limited to webhooks.
- **Coolify**: Self-hosted adds ops burden. We already have K8s for that use case.
- **DigitalOcean App Platform**: Limited API, higher cost, less developer-friendly.

## Implementation

- New `deploy_target` value: `railway`
- Railway GraphQL API endpoint: `https://backboard.railway.com/graphql/v2`
- Auth: `RAILWAY_TOKEN` env var (API token from Railway dashboard)
- Flow: Create project from GitHub repo → trigger deploy → poll for status → capture deployment URL
