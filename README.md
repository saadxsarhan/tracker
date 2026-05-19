# Remat D&A Delivery Hub — Local Vite build

Same application you saw running in the Claude chat, packaged so it runs on your laptop with no backend.

## Run it

```bash
unzip remat-delivery-hub-vite.zip
cd remat-vite
npm install
npm run dev
```

Open the URL Vite prints (default: http://localhost:5173). The browser tab opens automatically.

## What's inside

- **Frontend:** React 18 + Vite 5 + Tailwind 3
- **Storage:** browser `localStorage` (data persists per-browser, per-machine)
- **No backend:** no database to set up, no SMTP to configure, no API to run
- **No auth:** switch users via the top-bar dropdown (demo behaviour, same as the chat artifact)

The original artifact code is in `src/App.jsx`. The `window.storage` API it was written against is polyfilled to `localStorage` in `src/main.jsx`, so nothing inside `App.jsx` had to change.

## Features in this build

- Multi-approver model: each dashboard has a list of approvers, the same list handles BRD, Design, and UAT
- Multi-file attachments on every approval submission (real file picker)
- CR approval workflow: raising a CR sends it to the dashboard's approvers; approval reopens the routed stage, decline closes the CR
- Custom roles and CR types via admin → Workflow & Lookups
- Rebuild counter on rejection, auto-escalation to D&A Lead at 3 rebuilds
- Audit log of every action

## Login (demo)

Pre-seeded users (any password works; auth is local-only):

| Email | Role |
|---|---|
| saad@remat.sa | Admin |
| yasir@remat.sa | Data Engineer |
| ahmad@remat.sa | BI Developer |
| cfo@remat.sa | Sponsor (Finance) |
| procurement.director@remat.sa | Sponsor (Procurement) |
| csso@remat.sa | Sponsor (Strategy / Compliance) |

To reset all data: click "Reset demo data" at the bottom of the login page, or clear your browser's `localStorage` for `localhost:5173`.

## Build for production

```bash
npm run build
```

Outputs to `dist/`. Static files — drop into any web server (nginx, S3, Vercel, anything that serves HTML).

## When to use this vs the Next.js version

| Use case | Use this Vite build | Use the Next.js build |
|---|---|---|
| Local demo / showcase to leadership | ✓ | |
| Personal exploration of the workflow | ✓ | |
| Quick deployment for internal users | ✓ (static hosting) | |
| Real authentication, real database, audit isolation per user | | ✓ |
| On-prem deployment to Remat servers | | ✓ |
| Real email notifications | | ✓ |

The Next.js production build (delivered earlier as `remat-delivery-hub.zip`) has the older single-sponsor model and does not contain the CR approval workflow yet — porting these features to it is separate work.
