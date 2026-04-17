# Security Policy

funworldmap is a static-site frontend. There is no backend, no user accounts, no user-submitted data. The attack surface is small but not zero.

## In Scope

- Frontend vulnerabilities (XSS, prototype pollution, clickjacking)
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
