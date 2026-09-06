---
name: Publishing health probe
description: Confirmed health-check path used by this PesaMatrix deployment
---

The current PesaMatrix autoscale publisher probes `GET /api` during startup, so `/api` must remain an unauthenticated lightweight health response. Production must also listen on the internal port mapped to public port 80.

**Why:** The failed publish logs explicitly reported `healthcheck /api returned status 500` before the process was ready. Replit's configuration maps public port 80 to local port 5000, while the prior production command forced the server onto 8080.

**How to apply:** Preserve the `GET /api` response when changing route mounting, authentication, or deployment configuration, and keep the publishing command aligned with the local port mapped to external port 80. Keep detailed diagnostics on the dedicated health endpoints instead.