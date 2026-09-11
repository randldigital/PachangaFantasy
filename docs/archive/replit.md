# Historical architecture notes

This file is an archive of an early project overview. It is **not** current requirements. Use `requirements.md` and `docs/architecture.md`.

## Overview

Pachanga Fantasy is a fullstack web application for creating and managing amateur-football fantasy leagues (and, later, Club Mode) with a tier-list ranking system. Users can create leagues, invite friends, rank players, and see calculated market values based on collective rankings.

## System architecture (historical)

- Frontend: React 18, Vite, Wouter, TanStack Query, shadcn/ui, Tailwind, i18next
- Backend: Express, PostgreSQL, JWT, Drizzle ORM
- One client, one API, one database

Do not treat this archive as the live schema or route list.
