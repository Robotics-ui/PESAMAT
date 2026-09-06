---
name: Publishing health probe
description: Confirmed health-check path used by this PesaMatrix deployment
---

The current PesaMatrix autoscale publisher probes `GET /api` during startup, so `/api` must remain an unauthenticated lightweight health response.

**Why:** The failed publish logs explicitly reported `healthcheck /api returned status 500`; the existing `/api/healthz` endpoint was not sufficient for the publisher.

**How to apply:** Preserve the `GET /api` response when changing route mounting, authentication, or deployment configuration. Keep detailed diagnostics on the dedicated health endpoints instead.