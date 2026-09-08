# Pachanga Fantasy — Incremental Delivery Plan

**Companion document:** [`requirements.md`](./requirements.md) — the functional source of truth. Every task below traces back to a section of it.

**Goal of this plan:** take the application from its current state — where the core loop cannot be completed end to end — to a fully working, fully testable product, in phases that each leave the repository in a better and still-runnable state.

---

## How to use this plan

- **Phases are ordered by dependency, not by appetite.** Later phases assume the earlier ones landed.
- **Every phase has exit criteria.** Do not start the next phase until they are met.
- Each task carries the `requirements.md` section it satisfies, so the intended behaviour is never guessed.
- Task IDs (`P1.2.3`) are stable — use them in branch names, commits and pull requests.

### Phase overview

| Phase | Theme | Outcome |
|---|---|---|
| **0** | Product decisions | **Done (8 Sep 2026).** Rules recorded in `requirements.md`. |
| **1** | Architecture & infrastructure refactor | **Done (8 Sep 2026).** No behaviour change. Clean foundation, safety net, one schema, layered server. |
| **2** | Fix what already "works" | **Done (8 Sep 2026).** Existing features become correct and secure. Still no new features. |
| **3** | Valuation pipeline | **Done (8 Sep 2026).** Market Values exist from genuine S–D tiers. |
| **4** | Lineup integrity | **Done (8 Sep 2026).** Server-side lineup rules, Start match, no `ready`/cap of 10. |
| **5** | Statistics & validation | **Done (8 Sep 2026).** Stats keyed to Player, reachable, gated scoring. |
| **6** | Scoring & the two leaderboards | **Done (8 Sep 2026).** Player + Manager points, snapshots, two boards. |
| **7** | UX completion | **Done (8 Sep 2026).** Reachable, explained, mobile-ready, translated. |
| **8** | Test suite & release readiness | **Done (8 Sep 2026).** Full loop covered, CI on every PR, demo seed, stale requirement flags flipped. |

**Phases 1 and 2 are foundational. Phases 3–6 close the four functional gaps that make the product incomplete. Phase 6 is the phase where Pachanga first becomes the product `requirements.md` describes.**

---

## Phase 0 — Product Decisions ✅

**Closed 8 September 2026.** Authoritative wording is the Phase 0 table at the top of `requirements.md`. Summary:

| ID | Decision | Unblocks |
|---|---|---|
| P0.1 | Budget 100; values S30 / A24 / B18 / C12 / D8; budget range 50–200 | Phase 3 |
| P0.2 | Genuine S–D tiers; sharing a tier is allowed | Phase 3 |
| P0.3 | No votes / late join → B (18) | Phase 3 |
| P0.4 | Close with any number of votes (warn if few); reopen anytime; new values only affect Open matches | Phase 3 |
| P0.5 | Admin **Start match** locks lineups and joining. End match is too late. | Phase 4 |
| P0.6 | Stats editable until the match is scored | Phase 5 |
| P0.7 | Keep external players; admin submits their stats; stats keyed to Player | Phase 5 |
| P0.8 | No participant cap | Phase 4 |
| P0.9 | At most one Open or Started match; awaiting-stats matches may coexist | Phase 4 |
| P0.10 | Remove automatic team balancing and `ready` | Phase 4 |
| P0.11 | Global display names may clash; league player names unique; suffix ` (2)`, ` (3)`, … | Phase 2 |

P0.7 was confirmed with the product owner. The other ten were decided from the simplicity principle and recorded as rules, not recommendations.

---

## Phase 1 — Architecture & Infrastructure Refactor ✅

**Closed 8 September 2026.** Principle: no behaviour changes. Structural only.

### 1.1 Build a safety net first

Refactoring without tests is gambling. The existing suite cannot serve this purpose: roughly 30 test files exist but there is **no `test` script in `package.json`**, and the business-logic tests re-implement the logic inline rather than importing it (`tests/utils/calculations.test.ts` defines its own copy of the market value function and then tests the copy). They assert against a product that no longer exists.

- [x] **P1.1.1** Add npm scripts: `test`, `test:watch`, `test:api`, `test:e2e`, `lint`, `format`. None exist today.
- [x] **P1.1.2** Move the entire existing suite to `tests/_legacy/` and exclude it from the default run. Do not delete it yet — it documents past intent. Phase 8 replaces it.
- [x] **P1.1.3** Add a disposable test database: a script that creates, migrates and tears down a schema per run, so API tests hit a real database rather than mocks.
- [x] **P1.1.4** Write one **characterisation smoke test** over the real HTTP surface covering the path that works today: register → create league → join by invite code → create match → join match → save lineup. This is the net for Phases 1 and 2. It asserts *current* behaviour, including behaviour Phase 2 will later change — that is the point.
- [x] **P1.1.5** Establish a `tsc` baseline. Record the current error count so refactors can be held to "no worse", then to zero.

**Exit:** `npm test` runs, the smoke test passes, and it fails loudly if the register-to-lineup path breaks.

### 1.2 Remove dead and duplicated infrastructure

The repository carries three database clients, two storage implementations, two schemas and a migration utility for a database the project no longer uses.

- [x] **P1.2.1** Delete `server/db-local.ts` — it is **byte-for-byte identical** to `server/db.ts`.
- [x] **P1.2.2** Delete `server/db-neon.ts` — an unused third client (Neon serverless over WebSockets) left from an earlier hosting choice. Nothing imports it.
- [x] **P1.2.3** Delete `server/replitStorage.ts` — every method is a pass-through to `DatabaseStorage`. Remove the `if ('updateTierListByLeagueAndUser' in storage)` branch in `routes.ts` that exists solely to accommodate it.
- [x] **P1.2.4** Delete `server/dbMigration.ts` — it imports the deleted Replit storage, and its seed data is eight professional footballers with a `team` field that does not exist on the player model. Seeding Messi and Ronaldo also contradicts the product: Pachanga is about the people in the group.
- [x] **P1.2.5** Delete root-level junk: `h` (captured psql output), `server.log`, `test-db.js` (an ad-hoc connection check with a hardcoded password).
- [x] **P1.2.6** Add `.env` to `.gitignore` and commit a `.env.example`. The file currently sits untracked in the working tree with live credentials and is one `git add -A` away from being published.
- [x] **P1.2.7** Remove the hardcoded JWT fallback secret (`"pachanga-secret-key"`, duplicated in `routes.ts` and `storage.ts`). Fail fast at boot if `JWT_SECRET` is unset. A default signing key means anyone who has read the source can mint valid tokens.

### 1.3 One schema, one migration story

`db/schema/` is a **second, divergent schema that nothing imports**. `drizzle.config.ts` points at `shared/schema.ts`; `db/seed.ts` imports from `@shared/schema`; `db/migrate.ts` uses raw SQL. The orphan schema disagrees with the live one on the scores primary key, on `statReports.verifiedBy`, on player columns, and adds a `votes` table that has no code behind it.

- [x] **P1.3.1** Declare `shared/schema.ts` the single source of truth.
- [x] **P1.3.2** Delete `db/schema/`. Preserve the `votes` table design in the roadmap notes if the future MVP-voting feature (`requirements.md` §23) is still wanted — but not as live code.
- [x] **P1.3.3** Delete `db/migrate.ts`. It is raw DDL for the orphan design.
- [x] **P1.3.4** Move from `drizzle-kit push` to **generated, committed migrations**. `push` gives no schema history, which makes "reproduce a scored match" (`requirements.md` §24.5) unachievable. Generate an initial migration from the current live schema.
- [x] **P1.3.5** Rewrite `db/seed.ts` to produce a realistic amateur league: one admin, several members, a couple of external players, one match. This becomes the fixture for manual testing and demos.
- [x] **P1.3.6** Prune vestigial columns and note the rest for Phase 2: `users.role` and `users.leagueId` (unused), `players.position` (always `forward`).

### 1.4 Layer the server

`server/routes.ts` is 975 lines mixing routing, authentication, authorisation, validation and business logic. `server/storage.ts` is 536 lines behind a single god interface. Authorisation is copy-pasted (`league.createdBy !== req.user.id` appears in about ten places) and **simply absent in several others**.

- [x] **P1.4.1** Split routes by domain: `routes/auth.ts`, `leagues.ts`, `members.ts`, `players.ts`, `valuation.ts`, `matches.ts`, `lineups.ts`, `stats.ts`, `scoring.ts`, `leaderboards.ts`.
- [x] **P1.4.2** Introduce `server/domain/` for **pure, database-free business logic**: `scoring.ts`, `lineup.ts`, `valuation.ts`, `matchLifecycle.ts`. This is the most valuable task in Phase 1 — it is what makes the rules in Phases 4, 5 and 6 unit-testable in milliseconds without a database, and it is where `requirements.md` §16 and §19 will physically live.
- [x] **P1.4.3** Split `storage.ts` into repositories per aggregate: `userRepo`, `leagueRepo`, `playerRepo`, `valuationRepo`, `matchRepo`, `lineupRepo`, `statsRepo`, `scoreRepo`. Repositories do persistence only — no rules.
- [x] **P1.4.4** Build real authorisation middleware: `requireAuth`, `requireLeagueMember`, `requireLeagueAdmin`. Every route declares its guard instead of re-deriving it. This is what makes the missing checks in Phase 2 impossible to reintroduce by omission.
- [x] **P1.4.5** Delete the unused `requireAdmin` middleware and stop treating `users.role` as an authorisation source (`requirements.md` §3.1).
- [x] **P1.4.6** Centralise error handling: typed domain errors mapped to HTTP status codes plus stable machine-readable error codes, so the client can render the specific messages Phase 7 requires. Fix the handler in `server/index.ts`, which responds and *then* rethrows — turning every handled error into an unhandled one.
- [x] **P1.4.7** Replace ad-hoc `console.log` debugging (dozens of lines across routes and storage, several logging usernames and identifiers on every request) with a levelled logger.
- [x] **P1.4.8** Validate environment configuration at boot with a schema: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `NODE_ENV`.

### 1.5 Tidy the client

Ten of fifteen pages have no route. Working, finished features — statistics submission, match detail, valuation closure, the admin statistics overview — are unreachable because nothing links to them (`requirements.md` §20.2).

- [x] **P1.5.1** Triage every unrouted page and record the decision: **route it** (`MatchDetail`), **fold into `LeagueHub`** (statistics submission, valuation closure, player management), or **delete** (`Dashboard`, `CreateLeague`, `JoinLeague`, `LeagueDashboard`, `LeagueDetail`, `TierListPage`, `LineupPage`, `Results` — all superseded duplicates). Actual wiring happens in Phase 7; this task removes the dead code and records intent.
- [x] **P1.5.2** Remove the dead navigation in `Navbar.tsx` — a link row hidden with an inline `display: none`, pointing at a `/matches` route that does not exist.
- [x] **P1.5.3** Introduce a typed API client with centralised query keys, replacing hand-written `fetch` calls with hand-assembled auth headers scattered through components.
- [x] **P1.5.4** Move business calculations out of components. `TierListSection` recomputes market values in the browser; `LineupSection` owns lineup validation. Both must become presentation over server-owned rules — Phases 3 and 4 depend on this.
- [x] **P1.5.5** Share domain types between client and server through `shared/`, so a change to a rule breaks compilation on both sides.

### 1.6 Build, tooling and documentation

- [x] **P1.6.1** **Fix production static serving.** Vite builds the client to `dist/public`; `serveStatic` serves `dist`, which contains the server bundle and no `index.html`. **Production currently cannot serve the application.**
- [x] **P1.6.2** Make the port configurable. It is hardcoded to 5000 with a comment about firewall rules from a previous hosting environment.
- [x] **P1.6.3** Fix `tsconfig.json`: include `tests/`, drop the `**/*.test.ts` exclusion, and add the `@server` alias that `vitest.config.ts` already defines but TypeScript does not know about.
- [x] **P1.6.4** Remove or env-guard the Replit-specific Vite plugins (`runtime-error-modal`, `cartographer`) if Replit is no longer the deployment target.
- [x] **P1.6.5** Add real ESLint and Prettier configuration. The documentation claims both are used "implied by project structure"; neither is configured.
- [x] **P1.6.6** Consolidate documentation to four files: `README.md` (setup, run, test — the repository has **no README at all** today), `requirements.md`, `docs/architecture.md`, `docs/testing.md`. Archive or delete `COMPREHENSIVE_DOCUMENTATION.md`, `replit.md`, `db/README.md`, `README-Testing.md`, `TESTING-GUIDE.md`, `TESTING-STATUS.md`, `TESTING-FINAL-STATUS.md`, `TESTING-PRODUCTION-STATUS.md` and `tests/working-examples.md` — nine overlapping documents making contradictory claims about the same system.

### Phase 1 exit criteria

- [x] `npm run dev`, `npm run build` and `npm start` all work; the built application serves correctly.
- [x] `npm test` runs and the smoke test passes.
- [x] `tsc` passes with zero errors.
- [x] One database client, one schema, one storage implementation, one migration mechanism.
- [x] No route re-derives authorisation inline.
- [x] Business rules live in `server/domain/` as pure functions.
- [x] Documentation is four files, none contradicting `requirements.md`.
- [x] **Application behaviour is unchanged.** Same features, same bugs, same outputs.

---

## Phase 2 — Fix What Already "Works" ✅

**Closed 8 September 2026.** Existing features become correct and secure. **Still no new features.** Every item is a defect in something users can already reach.

### 2.1 Security and access control

- [x] **P2.1.1** **Registration accepts a client-supplied `role`.** The insert schema picks `role` straight from the request body, so anyone can register as `admin`. Not exploitable today only because `requireAdmin` guards nothing — a latent privilege escalation. Strip the field from user input. *(§3.1)*
- [x] **P2.1.2** **Final scoring has no authorisation whatsoever.** Any authenticated user can trigger scoring for any match in any league, including leagues they do not belong to. Restrict to the league administrator. *(§14.3)*
- [x] **P2.1.3** Add the missing membership checks to league match lists, match detail, match participants and match statistics reads. All four currently return data to any authenticated caller. *(§7.4)*
- [x] **P2.1.4** Verify the JWT secret hardening from P1.2.7 holds across both usage sites.

### 2.2 Player model

- [x] **P2.2.1** **Admin-added players are linked to the administrator's own account.** When the admin adds a player not flagged external, the new player receives `userId = admin's id`. The "which player am I in this league?" lookup then returns the wrong record, corrupting match joining and statistics attribution for the admin. *(§8.3)*
- [x] **P2.2.2** `isExternal` is accepted by the API and defined in the schema but **never written to storage**, so it can never be read back. Persist it. *(§8.3)*
- [x] **P2.2.3** Remove the vestigial `position` field, hardcoded to `forward` everywhere.
- [x] **P2.2.4** On player-name collision within a league, suffix ` (2)`, ` (3)`, … Display names stay globally non-unique. *(§4.1, P0.11)*

### 2.3 Match lifecycle

- [x] **P2.3.1** **The total goal count is never stored.** The administrator enters it at finalisation, it is sent to the validation operation, and the result is discarded. Since finalisation happens before anyone has submitted statistics, the comparison is always against zero. The number is lost at exactly the moment it is needed. Persist it on the match. *(§14.2)*
- [x] **P2.3.2** Stop calling validation during finalisation. Validation belongs after submission, not before it. *(§15.2)*
- [x] **P2.3.3** **Match creation has a race condition.** It inserts, then re-queries "the highest-numbered match in this league" to find what it just created. Two simultaneous creations return the wrong row. Use the insert's returned row.
- [x] **P2.3.4** Enforce budget bounds **50–200** on both server and form. Default 100. *(§11.3, P0.1)*
- [x] **P2.3.5** Stop flipping a match to `ready` at 10 participants. That transition currently makes lineups unsavable. Full removal of team balancing is P4.7. *(§11.2, §13.4, P0.10)*

### 2.4 Statistics

- [x] **P2.4.1** Prevent duplicate submissions server-side. The interface hides the form after submitting, but the endpoint accepts repeats and **scoring counts each one separately**. *(§15.1)*
- [x] **P2.4.2** Reject statistics from users who did not participate in the match. *(§15.1)*
- [x] **P2.4.3** Reject statistics for matches not yet marked finished. Currently enforced only by the interface. *(§15.1)*

### 2.5 Scoring and leaderboard

- [x] **P2.5.1** **Remove the team-win bonus.** It compares team membership (stored as player identities) against statistics (stored as user identities), so the sets can never correspond — the bonus either never applies or lands on the wrong person when identifiers coincide. It also only ever runs at exactly ten participants. *(§16.1)*
- [x] **P2.5.2** **Make scoring idempotent.** Each run appends a fresh set of score rows without clearing the previous ones, so running it twice permanently doubles everyone's points. *(§14.3)*
- [x] **P2.5.3** Include zero-point members in the leaderboard. The query's outer join is defeated by a filter applied afterwards, so anyone without a score is absent rather than shown at the bottom on zero. *(§17.4)*
- [x] **P2.5.4** Relabel the existing leaderboard honestly as a **Player Leaderboard**. It shows Player Points; calling it a manager standings table is the terminology error `requirements.md` §10 exists to prevent. The real Manager Leaderboard arrives in Phase 6. *(§17)*

### 2.6 Valuation closure

- [x] **P2.6.1** **Value updates are fired without being awaited.** The close operation issues each player's update inside a non-awaited loop and returns success immediately — writes may not have landed, and failures vanish silently. *(§10.2)*
- [x] **P2.6.2** Guard the division by zero that occurs when a league has exactly one player. *(§10.3)*
- [x] **P2.6.3** Stop discarding the `submitted` flag when a valuation is resubmitted.

### 2.7 Client correctness

- [x] **P2.7.1** Fix the tier list submission counter: the "all submissions" query requests the *single user* endpoint, so the displayed count is meaningless. *(§9.3)*
- [x] **P2.7.2** Fix match status labels in the history view, which translate `upcoming` and `in_progress` while the application produces `open`, `ready` and `completed` — so every label falls through. *(§11.2)*
- [x] **P2.7.3** Replace the full page reload after deleting a match with normal cache invalidation.
- [x] **P2.7.4** Complete the English translation, which is missing entire sections the Spanish one has. *(§20.12)*

### Phase 2 exit criteria

- [x] Every task above closed, each with a regression test.
- [x] No endpoint returns league data to a non-member.
- [x] No endpoint performs a privileged action without an ownership check.
- [x] Running scoring twice produces the same leaderboard as running it once.
- [x] The smoke test from P1.1.4 is updated to assert the corrected behaviour.

---

## Phase 3 — Valuation Pipeline ✅

**Closed 8 September 2026.** Market Values now exist. Valuation is opened explicitly by the administrator, members place players in genuine S–D tiers, and close writes **S30 / A24 / B18 / C12 / D8** (trimmed mean, unranked → 18).

- [x] **P3.1** **Make valuation reachable.** Nothing in the application ever moves a league into the `voting` state, and the tier list only enables ranking in that state — so **Player Valuation has never run**. Add an explicit "Open Valuation" administrator action, or open valuation automatically at league creation. *(§5.2)*
- [x] **P3.2** Replace the ordered list with a **genuine S/A/B/C/D tier list**. Multiple players may share a tier. Store a tier per player per voter, not a total order. *(§9.2, P0.2)*
- [x] **P3.3** Allow members to edit their valuation while valuation is open. The server already supports resubmission; the interface locks permanently after the first submit, a false constraint with no server counterpart. *(§9.3)*
- [x] **P3.4** Show a trustworthy count of how many members have submitted, so the group knows when closing is reasonable. *(§9.3)*
- [x] **P3.5** Implement Market Value in `server/domain/valuation.ts`: map tiers to **S30 / A24 / B18 / C12 / D8**, trimmed mean, round to integer. *(§10.2, P0.1)*
- [x] **P3.6** Unranked players and players added after closure receive **B (18)**. Single-player leagues must not divide by zero. *(§10.3, P0.3)*
- [x] **P3.7** Require explicit confirmation before closing valuation, stating how many members have voted. Warn if few have voted; do not block. *(§9.3, P0.4)*
- [x] **P3.8** Administrator may reopen valuation at any time. Recalculated values apply only to matches still Open. *(§9.3, P0.4)*
- [x] **P3.9** Expose Market Values wherever a manager needs them to decide. *(§10.1)*
- [x] **P3.10** Replace the client-side market value recomputation in `TierListSection` with the server's stored values.

**Exit:** a league can open valuation, members place players in tiers, the admin closes, and **every player has a defined Market Value such that a five-B lineup costs 90 and an all-S lineup is rejected at budget 100**. **Met.** Server lineup enforcement remains Phase 4; the domain function `lineupCanSave` already rejects all-S at budget 100.

---

## Phase 4 — Lineup Integrity ✅

**Closed 8 September 2026.** Lineup rules run on the server. The administrator **Starts** a match to lock lineups and joining. `ready`, auto-balance, and the cap of 10 are gone. User-facing states are Open, Started, Finished, and Scored. **Validated** remains Phase 5.

- [x] **P4.1** Implement lineup validation as a pure function in `server/domain/lineup.ts`, covering all eight rules in §13.1: exactly five players, all match participants, all unique, exactly one captain, captain among the five, within budget, one lineup per manager per match, correct ownership.
- [x] **P4.2** **Recompute total cost server-side from stored Market Values.** Never trust the client's figure. *(§13.3)*
- [x] **P4.3** Enforce participant eligibility server-side: only players registered in *that* match may be selected. *(§12.2)*
- [x] **P4.4** Return specific, machine-readable failure reasons so the client can name the exact broken rule. *(§21)*
- [x] **P4.5** Add administrator **Start match**. It locks lineups and joining. Remove the accidental `open`-only save restriction caused by team balancing. *(§13.4, P0.5)*
- [x] **P4.6** Separate user-facing states: Open, Started, Finished/awaiting stats, Validated, Scored. "Football finished" and "fantasy scored" must never share a word. *(§11.1, §11.2)*
- [x] **P4.7** **Remove automatic team balancing** and the `ready` status. Do not assign real-world teams. *(§23, P0.10)*
- [x] **P4.8** **Remove the participant cap of 10** from the UI and any leftover server logic. *(§12.3, P0.8)*
- [x] **P4.9** Reject creating a second match while one is already Open or Started. Awaiting-stats matches may coexist. *(§11.3, P0.9)*
- [x] **P4.10** Make the lineup interface state-aware: show *why* saving is blocked instead of silently disabling the control. *(§13.5, §21)*

**Exit:** every rule in §13.1 is enforced server-side and unit-tested; a lineup cannot be saved after the lock; the interface always explains why a save is blocked. **Met.** Validated statistics remain Phase 5.

---

## Phase 5 — Statistics & Validation ✅

**Closed 8 September 2026.** Statistics are keyed to **Player**. The live league view can submit them (plus/minus counters). External players are entered by the admin. Scoring refuses incomplete or unacknowledged-inconsistent data.

- [x] **P5.1** **Re-key statistics from User to Player.** External players stay in the product (P0.7). This also makes the Player Leaderboard about footballers rather than accounts. *(§15.1, §8.3, §17.4)*
- [x] **P5.2** Build the administrative submission flow for external players, who cannot log in and therefore cannot submit for themselves. *(§8.3)*
- [x] **P5.3** **Make statistics submission reachable** in the live league view, replacing the "coming soon" placeholder. The component already exists and works. *(§15.1)*
- [x] **P5.4** Use plus/minus counters rather than free-text number entry. Values are almost always 0–3, and a counter is faster, harder to mistype and usable with one thumb. *(§15.1)*
- [x] **P5.5** Players (and the admin, for external players) **may edit statistics until the match is scored**. After scoring, they are immutable. *(§15.1, P0.6)*
- [x] **P5.6** Implement the goal consistency check against the total recorded at finalisation — now possible because P2.3.1 persists it. *(§15.2)*
- [x] **P5.7** Surface the four statistics states clearly for admin and participants: **pending**, **submitted**, **inconsistent**, **validated**. Only the first two have any representation today. *(§15.3)*
- [x] **P5.8** Build the inconsistency resolution flow: show which rule failed and by how much, show who is outstanding, allow requesting corrections, and allow the administrator to explicitly acknowledge the discrepancy and proceed. The last option matters — the loop must not deadlock over one disputed deflection, but it must not pretend the numbers agreed either. *(§15.4)*
- [x] **P5.9** **Gate final scoring on validation.** Scoring must refuse to run unless statistics are complete and consistent, or the administrator has acknowledged the inconsistency. *(§14.3, §19 rule 18)*
- [x] **P5.10** Keep assists unvalidated. There is no externally known total for assists and no constraint may be invented. *(§15.2)*

**Exit:** every participant including external players can have statistics recorded; inconsistencies are visible and resolvable; scoring cannot run on incomplete or unacknowledged-inconsistent data. **Met.** Player Leaderboard re-key and Manager Points remain Phase 6.

---

## Phase 6 — Scoring & The Two Leaderboards ✅

**Closed 8 September 2026.** Player Points stay `goals × 3 + assists × 2`. Manager Points sum the five selected players and add the captain's points once more. Both are snapshotted at scoring time. The live league view shows two separate leaderboards.

- [x] **P6.1** Implement Player Points in `server/domain/scoring.ts` as a pure function: `(goals × 3) + (assists × 2)`, with **no captain multiplier and no win bonus**. *(§16.1)*
- [x] **P6.2** **Implement Manager Points** — the central missing feature. Sum the Player Points of the five selected players, then add the captain's points once more. *(§16.2)*
- [x] **P6.3** Persist Manager Match Points. There is currently **no representation for them at all** in the data model. *(§24.5)*
- [x] **P6.4** Persist Player Match Points keyed to the Player.
- [x] **P6.5** **Snapshot the scoring inputs** at the moment a match is scored — the lineup composition, the captain, and each player's statistics — so a scored match stays reproducible and cannot be altered by later edits. *(§19 rule 19, §24.5)*
- [x] **P6.6** Make scoring atomic and idempotent: partial scoring must never be left behind, and re-running must reproduce rather than accumulate. *(§14.3)*
- [x] **P6.7** Handle missing and invalid lineups deterministically: a manager with no lineup scores zero and is never assigned a generated one; a stored lineup that violates §13.1 fails **visibly** rather than silently producing a wrong score. *(§19, §25.1)*
- [x] **P6.8** Build the **Player Leaderboard**: player, total points, optionally goals, assists and matches played. Never any captain multiplier. *(§17)*
- [x] **P6.9** Build the **Manager Leaderboard**: registered members only, ranked by accumulated Manager Points. *(§18)*
- [x] **P6.10** Present the two leaderboards as clearly separate. They may sit near each other but must never merge into one table with two columns implying a single ordering. A user placing very differently in each is the game working, and the interface should feel that way rather than looking broken. *(§18.3)*
- [x] **P6.11** Unit-test every worked example in `requirements.md` §25.1 — these were written to be lifted directly into tests.

**Exit:** a match can be scored once, correctly; both leaderboards exist and are independent; the captain multiplier affects manager points only; re-running scoring changes nothing; historical results survive later edits to lineups and statistics. **Met.**

---

## Phase 7 — UX Completion ✅

**Closed 8 September 2026.** With the loop functionally complete, the live interface now matches `requirements.md` §20.

- [x] **P7.1** **Reachability audit.** Every functional requirement must be reachable from the live interface. Execute the routing decisions recorded in P1.5.1. *(§20.2)*
- [x] **P7.2** Make statistics available on mobile. It is currently desktop-only, which is backwards — submitting statistics is the single most likely thing a user does on a phone, standing in a car park. *(§20.3)*
- [x] **P7.3** Primary-action pass: every principal screen shows the one thing the game currently wants from this user — join match, build lineup, submit stats, validate match, view leaderboard. *(§20.1)*
- [x] **P7.4** **Every disabled control explains itself.** The lineup save control is the worst offender: it simply greys out, leaving the user to guess whether they have too few players, no captain, or are over budget. *(§21)*
- [x] **P7.5** Specific, actionable error messages throughout, driven by the error codes from P1.4.6. *(§21)*
- [x] **P7.6** Immediate feedback on every action: joining, saving, submitting. Silence is never an acceptable outcome of a tap. *(§20.7)*
- [x] **P7.7** Empty states as calls to action, never as reports. *(§4.3)*
- [x] **P7.8** Complete both translations and verify the four leaderboard/valuation terms stay distinct in Spanish and English. *(§20.12)*
- [x] **P7.9** Re-evaluate tier list drag-and-drop against tap-to-place. Lineup building already uses tapping and is the better model — one-handed, reliable, no gesture to miss. *(§20.9)*
- [x] **P7.10** Visual hierarchy pass against §20.11; confirm no decorative complexity is compensating for unclear structure. *(§20.11)*
- [x] **P7.11** Confirm no functional requirement depends on an animation having played. *(§20.8)*

**Exit:** a new user can be handed a phone and complete the entire loop without explanation. **Met.**

---

## Phase 8 — Test Suite & Release Readiness ✅

**Closed 8 September 2026.**

- [x] **P8.1** **Domain unit tests** — every rule in `requirements.md` §19 and every example in §25.1, run against the real `shared/domain/` functions rather than inline copies. Fast, no database.
- [x] **P8.2** **API integration tests** per domain against a real disposable database: authorisation on every endpoint, membership boundaries, validation failures, idempotency.
- [x] **P8.3** **Full-loop end-to-end test** — register → create league → join → open valuation → rank → close → create match → join → build lineup → finish match → submit statistics → validate → score → assert both leaderboards. **This single test is the definition of "fully working".**
- [x] **P8.4** Negative-path end-to-end tests: over-budget lineup, missing captain, non-participant selection, duplicate statistics, inconsistent goal total, double scoring.
- [x] **P8.5** Retire `tests/_legacy/` once its intent is covered.
- [x] **P8.6** CI pipeline: typecheck, lint, unit, integration, end-to-end on every pull request.
- [x] **P8.7** Seed a demo league for manual testing and onboarding.
- [x] **P8.8** Deployment check: production build serves correctly (P1.6.1), migrations run, environment validated, secrets absent from the repository.
- [x] **P8.9** Update `requirements.md` — flip every `[Required — not implemented]` that has been delivered to `[Implemented]`. Phase 0 decisions are already recorded. **The document must not still describe gaps this plan closed.**

**Exit:** `npm test` (68 tests) and `npm run test:e2e` pass locally; `npm run check`, `npm run lint`, and `npm run build` succeed with `dist/public/index.html` present. CI runs the same commands on every pull request.

---

## Traceability

Where the eight largest functional gaps in `requirements.md` are closed:

| Gap | Section | Closed in |
|---|---|---|
| Manager scoring does not exist | §16.4 | **P6.2** ✅ |
| Manager Leaderboard does not exist | §18.4 | **P6.9** ✅ |
| Lineup rules enforced only in the browser | §13.3 | **P4.1, P4.2** ✅ |
| Player Valuation is unreachable | §5.2 | **P3.1** ✅ |
| Statistics submission is unreachable | §15.1 | **P5.3** ✅ |
| Total goal count is never persisted | §14.2 | **P2.3.1** ✅ |
| Scoring is unauthorised, ungated and not idempotent | §14.3 | **P2.1.2, P2.5.2, P5.9, P6.6** ✅ |
| External players cannot record statistics | §8.3 | **P5.1, P5.2** ✅ |

---

## Suggested sequencing

Phases 1 and 2 are strictly sequential and should not be parallelised — Phase 2's fixes land in structures Phase 1 creates.

From Phase 3 onward there is room to overlap:

- **Phases 3 and 4** can run in parallel after Phase 2, provided Phase 4 accepts that budgets are untestable until P3.5 lands. Sequential is safer.
- **Phase 5** depends on Phase 2 (the persisted goal total) but not on Phases 3 or 4.
- **Phase 6 depends on everything before it** and must not be started early. Manager scoring built on unvalidated lineups would produce a leaderboard nobody could trust — and an untrustworthy leaderboard is worse than no leaderboard.
- **Phase 7** can begin as each earlier phase completes, screen by screen.
- **Phase 8** accumulates throughout; only the full-loop test genuinely waits for Phase 6.
