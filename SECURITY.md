# Security Policy

funworldmap is a static-site frontend with no user accounts and no user-submitted content. Its only server-side component is a small, optional analytics Worker (`cloudflare-worker/`, `POST funworldmap.com/api/event`) that ingests anonymous, cookieless event counts. The attack surface is small but not zero.

## In Scope

- Frontend vulnerabilities (XSS, prototype pollution, clickjacking)
- The analytics Worker endpoint (`POST /api/event`) — input validation, CORS origin allowlist, event-schema handling (`cloudflare-worker/index.ts`)
- Dependency CVEs reachable via the bundled code paths
- Incidents involving the basemap tile provider that affect this site
- Supply-chain concerns in `package.json` / `package-lock.json`

## Out of Scope

- Social-engineering of GitHub Pages / the custom domain registrar
- Issues in upstream MapLibre GL / React / Vite that are not reproducible here
- Rate limiting of GitHub Pages itself

## Reporting

Email: tobias.ens@docuware.com (subject line starting with `[funworldmap security]`).

This is a best-effort project with no SLA. I aim to acknowledge reports within seven days.

## Disclosure

Ninety-day coordinated disclosure. Credit will be given in the fix commit unless you prefer anonymity.
