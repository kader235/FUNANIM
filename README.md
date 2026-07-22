# FUNANIM — générateur de vidéos stickman (DEVONE)

Vidéos scène par scène, tout en boutons. Moteur canvas isomorphe
(navigateur = prévisualisation, worker Node+FFmpeg = rendu final).

## Structure
- `web/`    Frontend (démo moteur v0.2 — deviendra le projet React)
- `docs/`   Spécification du format JSON de projet
- `api/`    (à venir) API Fastify — Render Web Service
- `worker/` (à venir) Worker de rendu FFmpeg — Render Background Worker (Docker)

## Infra
Neon (PostgreSQL) · Render (Static Site + Web Service + Worker + Key Value) · R2 (fichiers)
