---
name: Citipointe Basketball Team Management Tool
description: Project context, architecture decisions, and scope for the basketball team management web app
type: project
---

# Citipointe Basketball Team Management Tool

## Project overview
Building a team management tool to replace a multi-page Excel system. Used by Citipointe Basketball club.

## Current system (Excel-based) tracks:
- Player name, first year of play, intention to play, team name, age
- Team formation summary by age/gender group
- Coach assignment per team

## Data sources:
- Intention-to-play form output spreadsheet (player preferences, availability)
- Basketball Connect export (player registration status, name, phone, email)

## Confirmed architecture (2026-04-01):
- **Type:** Full web app (single-page HTML/JS)
- **Hosting:** SharePoint (O365 environment) — no server required
- **Auth:** SharePoint permissions (O365 accounts)
- **Data model:** Excel/CSV import → in-memory processing → Excel/CSV export
- **Team formation UI:** Browser drag-and-drop (SortableJS)
- **Users:** 3–5 authorised team managers/coaches

## Why: User confirmed O365 environment, wants full web app with data output and validation. No-server SharePoint hosting keeps ops overhead at zero.

## How to apply: All L1 deliverables should be self-contained HTML/JS, no backend dependencies. Data persistence via file import/export pattern. When suggesting L2 features, SharePoint Lists is the natural data store upgrade path.

## L1 scope (in priority order):
1. Player database with auto age group calculation (formula-driven from birthday + league rules)
2. Quick stats dashboard (player counts by age/gender, years played, division)
3. Cross-reference Basketball Connect export + intention-to-play form
4. Interactive team formation UI (drag-and-drop, real-time visuals)
5. Contact sheet export (for email/WhatsApp setup)
6. Team manager override for age group assignment

## L2 scope (next phase):
- Basketball Connect stats download
- Coach player assessments (physical/skills/teamwork)
- Simple player ranking system

## L3 scope (future):
- Full stats tracking for high division teams
- Game/season advanced analysis

## Outstanding items needed:
- Current Excel management file (sample/anonymised)
- Basketball Connect export sample (or column structure)
- Intention-to-play form output sample
- Age group calculation rules (cutoff date, age brackets)

## Development steps:
1. Review current files
2. Analyse data structure
3. Finalise function wishlist
4. Develop L1 deliverables
5. Bug test and demos
6. Deploy L1, start L2
