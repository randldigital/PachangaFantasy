# Pachanga Fantasy — Functional Requirements

**Status:** Functional baseline, version **2.1**
**Document type:** Functional specification (not an architecture document)
**Audience:** Developers, testers and AI agents implementing or modifying Pachanga Fantasy

### How this document is organised

| Part | What it covers | Sections |
|---|---|---|
| **Shared** | User, avatar, alias, membership in many contexts, invite codes, Player belongs to League xor Club, claim requests, seasons | 1–4, 3.3, 7–8 |
| **Fantasy League** | The existing dual-role loop: 5/7/11 real sides, lineup of five, Team A/B, valuation, Market Value, Manager/Player scoring, force-score, rankings and history by season | 5–22 |
| **Club Mode** | A separate experience: one real squad versus an opponent name and score. No lineup, no Market Value, no Team A/B | 23 |
| **Public-ready** | Email verification, membership close, billing accounts, `/billing`, optional Google/payments/ads | 3.4, 7.4, 24 |
| **Cross-cutting** | Future features, technical notes, acceptance | 25–27 |

---

## Source-of-Truth Rule

> `requirements.md` defines the intended functional behaviour of Pachanga. When implementation, historical documentation and this file disagree, the discrepancy must be investigated before further development. Developers must not silently infer new business rules from existing code defects or outdated documentation.

> Any new feature that changes scoring, match lifecycle, player eligibility, league membership or leaderboard behaviour must update this document as part of the same change.

### Phase 0 decisions (8 September 2026)

These close Appendix A. They are product rules, not recommendations. Revisit them only by updating this document in the same change that implements the new behaviour.

| ID | Decision |
|---|---|
| **P0.1** | Default match budget remains **100**. Market Values use a fixed tier scale of **S = 30, A = 24, B = 18, C = 12, D = 8**. A five-player average (all B) costs 90; an all-S lineup costs 150 and is illegal. Budget input range is **50–200**. |
| **P0.2** | Valuation is a **genuine S/A/B/C/D tier list**. The member-facing control is **1–5 stars** mapped 1:1 onto those tiers (**5 = S, 4 = A, 3 = B, 2 = C, 1 = D**). Multiple players may share a tier. A strict total ordering is not required. |
| **P0.3** | A player with no votes, or added after valuation closed, receives **B (18)** — the mid-tier default. Nobody is free. |
| **P0.4** | A member's valuation is complete when every current league player has a tier. The administrator may close with any number of submissions (warn if few). Valuation may **reopen at any time**; new values apply only to matches that are still Open. |
| **P0.5** | Lineups and joining **lock when the administrator starts the match**. Ending the match is too late — results are already known. Scheduled kick-off time is not the lock. |
| **P0.6** | A player **may edit their own statistics** until the match is scored. After scoring, statistics are immutable. |
| **P0.7** | **External players are in scope.** The administrator may submit statistics for **any participant**, including externals and absent registered players. Statistics are keyed to the Player, not the User. |
| **P0.8** | **Superseded in 2.0 for Fantasy Matches.** 1.0 had no participant cap and forbade inventing a limit of 10. Fantasy Matches now have an immutable `sideSize` of 5, 7 or 11; capacity is `sideSize × 2` (P2.4). Club Matches still have no side-size cap. |
| **P0.9** | At most **one match in Open or Started** per league. A previous match may still be awaiting stats or validation while the next is created. |
| **P0.10** | **Automatic team balancing is not a product feature.** Remove it, including the `ready` status it creates. The administrator **must** divide every participant into Team A or Team B before starting. There is no automatic balancing, no `ready` status, and no team-win scoring bonus. |
| **P0.11** | **Superseded in 2.0 for join/create.** Usernames need not be globally unique as football identity. The visible name in a League or Club is the **alias** (`players.name`), unique within that context. Join/create require the user to supply it; a clash with a linked Player is rejected (`ALIAS_TAKEN`). A clash with an unlinked Player becomes a claim request (P2.3), not a silent rename. Administrators adding an external Player may still suffix `Name (2)` on collision. |
| **P0.12** | After statistics are valid, every logged-in participant must vote Player of the Match and rate assigned peers from **0.0 to 10.0**. Player Match Points are `peer average + goals × 3 + assists × 2 + MVP bonus (2)`. Scoring then updates each participant's Market Value from that match's performance. The S/A/B/C/D tier list remains **initial VM only**. |

### Phase 2.0 decisions (10 September 2026)

These extend Phase 0. They are product rules, not recommendations.

| ID | Decision |
|---|---|
| **P2.1** | **Club Mode** is a separate experience (`clubs`, `/club/:id`), not a League flag and not “Team Mode”. **Team** means only Fantasy Match sides (Team A / Team B / `matchTeams`). |
| **P2.2** | A User may belong to many Leagues and many Clubs. Avatar belongs to the User. Alias is the Player name inside one League or one Club; after membership exists only that context's administrator may change it. |
| **P2.3** | Matching an unlinked Player's alias on join, or selecting that Player at join, **does not auto-link**. It creates a pending **claim request** and returns `409 CLAIM_PENDING`. The User is not a member until the administrator accepts. Rejecting leaves them out; they may join only with a different unused alias. Members cannot claim a second Player. |
| **P2.4** | Fantasy Match `sideSize` is **5, 7 or 11**, chosen at creation and **immutable**. Capacity is `sideSize × 2`. Start requires **exactly** `sideSize` on Team A and **exactly** `sideSize` on Team B. The fantasy lineup remains **always five**. |
| **P2.5** | Invite codes carry context: new Leagues `L-XXXXXX`, Clubs `C-XXXXXX`. Legacy six-character League codes still join Leagues only. Never search League then Club. The column is unbounded `text` (never `varchar(6)`). |
| **P2.6** | A season is **1 August–31 July**, labelled `YYYY/YY` of the August start. Rankings default to the current season; history groups by season. Membership and invite codes are not reset on 1 August. |
| **P2.7** | Club Player Points = peer average + goals×3 + assists×2 + minutes component (max 5 at 90 minutes). **Club result weight** and **Club MVP weight** require product confirmation and must not be invented; persist W/D/L and MVP for history only until confirmed. |
| **P2.8** | Club force-score fills missing **incoming assigned** ratings with **6.5**; existing objective stats still count. After score or force, scoring is definitive. Admin **close** is a separate action (`scored` → `closed`). |

### Phase 2.1 decisions (11 September 2026)

| ID | Decision |
|---|---|
| **P2.1.1** | **New accounts must verify email** before they receive a session. Existing 2.0 users are backfilled as verified. If SMTP is unset, register returns `503 EMAIL_NOT_CONFIGURED`. |
| **P2.1.2** | League/Club **valuation `status` is not membership**. `joinOpen` (default true) closes join; invite codes still resolve. Closed join returns `403 MEMBERSHIP_CLOSED`. |
| **P2.1.3** | Subscriptions belong to a **billing account** whose subject is a User **or** a League **or** a Club. Org-first: every League and Club is seeded on `free`. Members inherit that org plan in that context. A personal User account exists for later SKUs and does not upgrade leagues they merely joined. |
| **P2.1.4** | `free` includes every current 2.0 football feature. Paid gates are **server-side** (`requireEntitlement`). Google, payments and ads stay off until env is set. Ads have **no** HTTP stub; `/api/auth/features` reports `ads: false` and `AdSlot` renders nothing. |
| **P2.1.5** | One React/Vite client is the future mobile UI. Do not add a second frontend. |

### How to read the status markers

Throughout this document, rules are marked so that a reader can tell intent from reality:

| Marker | Meaning |
|---|---|
| **[Implemented]** | The rule is enforced by the current application and can be relied upon. |
| **[Partially implemented]** | The rule exists but is incomplete, client-side only, or unreachable in the live UI. Details are given. |
| **[Required — not implemented]** | The product requires this behaviour. It is not present today and must be built. |
| **[Requires product decision]** | Neither the historical documentation nor the code establishes a reliable rule. Do not invent one; get a decision. |

A rule without a marker is a product principle rather than a testable behaviour.

### Documentation used to produce this file

This document was derived from in-repository historical notes and from a direct reading of the current source code (`shared/schema.ts` and the React client). Where the narrative and the code disagree, the code was treated as evidence of *what exists*, and this document states *what should be true*.

---

## 1. Product Overview

Pachanga is a **private amateur-football application for a group of friends who actually play together**.

It is not a fantasy game built on top of professional football. There are no famous players, no external data feeds and no public leagues. The players in the game are the people in the group, and the statistics come from the match they just played.

From 2.0 there are **two experiences**. A User may belong to both at once.

**Fantasy League** is the original dual-role game (this document's sections 5–22). The same person is a Real Player and a Fantasy Manager. Matches have Team A and Team B, a lineup of five, Market Value and two leaderboards.

**Club Mode** (Section 23) is a separate organisation: one real squad versus an opponent that exists only as a **name and a score**. There is no lineup, no Market Value, no Manager Points and no opposite roster in the app.

### The dual-role model (Fantasy League only)

This is the concept that explains Fantasy League. **The same person occupies two independent roles at the same time**, and almost every Fantasy rule in this document follows from keeping those two roles separate.

**1. Real Player**

The person who physically plays the football match.

- Participates in real amateur matches.
- Receives a **Market Value** derived from how the rest of the group values them.
- Records their real goals and assists after the match.
- Earns **Player Points** from that real performance.
- Appears in the **Player Leaderboard**.

**2. Fantasy Manager**

The same person, acting as a fantasy team selector.

- Builds a fantasy lineup from the players taking part in the upcoming real match.
- Must keep the lineup within a budget.
- Nominates one of their five selections as **Captain**.
- Earns **Manager Points** from the real performance of the players they selected.
- Appears in the **Manager Leaderboard**.

A person can be an excellent Real Player and a poor Fantasy Manager, or the reverse. **That tension is the game.** A user who scores a hat-trick but picked a bad lineup should sit high in one leaderboard and low in the other, and the application must present this as intentional rather than as an inconsistency.

### What the product is not

Pachanga is not a club-management ERP, a scheduling application, a social network or a professional sports platform. Club Mode (Section 23) still does not include training, tactics, availability, positions, competitions or opponent rosters. Features that do not serve the Fantasy loop or the Club contribution ranking belong in Section 24.

---

## 2. Product Principles

### 2.1 Simplicity above everything else

This is the primary UX principle and the primary technical principle.

The product must remain understandable to a group of friends with no onboarding and no fantasy-football expertise. Someone should be able to join a league from a code sent in a group chat and build a lineup without anyone explaining the rules to them.

When a functional or technical decision conflicts with simplicity, **simplicity normally wins**, unless the feature is essential to the core game loop in Section 2.2.

### 2.2 Everything serves the core loop

Any proposed feature must do one of three things: strengthen the Fantasy loop, strengthen Club Mode's seasonal contribution ranking, or improve usability around either. If it does none of these, it belongs in Future Features (Section 24) and must not be allowed to redefine current business rules.

### 2.3 Separation of the two roles

Player concepts and Manager concepts must never be merged, in the data model, in the scoring, in the leaderboards or in the wording of the interface. Section 10 and Section 16 define this precisely.

### 2.4 Determinism and reproducibility

Every rule in this document should be specific enough to become an automated test. A scored match must remain reproducible: its historical result must not change because someone later edited a lineup or resubmitted a statistic.

### 2.5 Reliability over interaction novelty

A plain tap or click that always works is better than a gesture that sometimes fails on a phone. Decorative effects are optional; the application must be fully understandable and operable without them.

---

## 3. User Roles and Concepts

### 3.1 Roles

Pachanga has exactly **one privileged role per context**: the **Administrator**, who is the person who created that League or that Club.

There are no moderators, no co-administrators, no permission matrices and no enterprise-style RBAC. Administration is scoped to a single League or a single Club; a user may administer one context and be an ordinary member of another.

> **[Implemented as vestigial data]** The `users` table still carries a legacy global `role` field (`admin` / `player`). It is not used to authorise anything: every privileged operation checks `createdBy === user.id` on the League or Club. Do not use `users.role` as an authorisation source.

### 3.2 Core concepts and terminology

The following vocabulary is authoritative. Use it consistently in code, in the interface and in this document. In particular, **never write "ranking" unqualified**, because four different concepts could be meant.

| Term | Definition |
|---|---|
| **User** | A registered account. Can log in. Identified persistently across sessions. Owns the avatar. |
| **Username** | The account / authentication identifier. Must not be shown as the football identity where an alias exists. |
| **Alias** | The visible Player name inside **one** League or **one** Club. Stored as `players.name`. Unique only in that context. |
| **League** | A private Fantasy competition. Contains members, players, matches, valuation, Market Value and both leaderboards. |
| **Club** | A persistent real squad (2.0). Contains members, players, Club Matches, a Player ranking and match history. No lineup, no Market Value, no Manager leaderboard. |
| **League / Club Member** | A User who belongs to that context. Grants access to its functionality. |
| **Player** | A real-world football participant in **exactly one** context: a League **or** a Club (`leagueId` xor `clubId`). May or may not be linked to a User. |
| **External Player** | A Player with no linked User account. See Section 8.3. |
| **Manager** | A **League** Member acting as a fantasy team selector. Every League Member is implicitly a Manager. Club Mode has no Managers. |
| **Team A / Team B** | Temporary sides of a **Fantasy** Match only (`matchTeams`). Never used in Club Mode. |
| **Player Valuation** | The act of a League member ranking that League's players by perceived quality. See Section 9. Club Mode has no valuation. |
| **Tier List** | The interface through which Player Valuation is expressed. |
| **Market Value** | The fantasy price of a League Player. Initial value comes from aggregated Player Valuation (Section 10.2). After each scored Fantasy match it updates from that match's performance, independently of Player Points. |
| **Match** | A single real football game in exactly one context (League xor Club). |
| **Match Participant** | A Player registered as taking part in a specific Match. |
| **Lineup** | A Manager's fantasy selection of five Fantasy Match Participants. Club Matches have no lineup. |
| **Captain** | The one Lineup Player whose points are doubled — **for the Manager only**. |
| **Player Points** | Points earned by a Player from their own real statistics (formula differs by context: Section 16.1 vs Section 23.5). |
| **Manager Points** | Points earned by a Manager from their Lineup. Fantasy only. |
| **Season** | 1 August 00:00 – 31 July 23:59 of the following year, labelled `YYYY/YY` of the August start (e.g. `2026/27`). |
| **Player Leaderboard** | Ranking of Players by accumulated Player Points **in the current season by default**. |
| **Manager Leaderboard** | Ranking of Managers by accumulated Manager Points **in the current season by default**. Fantasy only. |

Terms to avoid: "ranking" without a qualifier, "score" without saying whose, "completed" without saying whether the football match or the scoring is meant (see Section 11), **"Team Mode"**, and using **Team** for a Club.

### 3.3 Shared identity (2.0)

**Avatar.** Belongs to the User, not the Player. **[Implemented]** A User may upload an image; the server compresses it (square JPEG, about 256px, quality ~70, cap ~80KB) and others see it on leaderboards, recap tokens, participants, stats and Club roster. Non-images are rejected.

**Alias.** Required when creating or joining a League or Club (1–30 characters). **[Implemented]** After membership exists, Users cannot change their own alias. Only that context's administrator may (`PATCH` player alias). The same User may have different aliases in different Leagues and Clubs.

**Invite codes.** **[Implemented]** Distinguish at the code itself. One Join field on Overview.

| Context | Format |
|---|---|
| New League | `L-XXXXXX` |
| Club | `C-XXXXXX` |
| Legacy League | six characters, no prefix |

`XXXXXX` is 6 uppercase alphanumeric characters. `L-…` looks up Leagues only. `C-…` looks up Clubs only. Unprefixed codes resolve **legacy League codes only**, never Clubs. Existing six-character League codes are not rewritten. The stored column is `text` (wide enough for eight-character prefixed codes; never `char(6)` / `varchar(6)`).

**Claim requests.** **[Implemented]** A claim can start at join by **selecting** an unlinked Player, or by typing that Player's exact alias. Members cannot claim a second Player. In either start path:

1. Do not create a second Player, do not set `userId`, and do not add the User to participants.
2. Create a pending claim request. Response: `409 CLAIM_PENDING` (include request id). Retrying the same pick or alias while pending is idempotent and still not a member.
3. The User cannot open Match flows in that context until the administrator accepts or rejects.
4. On **accept**: add the User to participants and set `players.userId`. Only then is join complete.
5. On **reject**: the User remains out. They may join only with a **different** unused alias. The same alias cannot be reused unless the admin later allows a new claim.

Accept and reject are unchanged: the administrator only confirms or refuses; there is no second linking path. A User with a pending claim for that League/Club cannot complete membership via any other path for that same Player. They may join a **different** League or Club immediately.

**Leave and remove.** **[Implemented]** A non-administrator may leave a League or Club. The administrator may remove another member. Both actions:

1. Remove the User from participants. They lose access immediately.
2. Unlink their Player (`userId` cleared). Do **not** delete the Player, match rows, statistics, history or rankings.
3. The administrator cannot leave or be removed; they delete the League or Club instead.
4. To return, the same User (or another) must **claim** that unlinked Player at join. Membership is withheld until the administrator accepts. A new unused alias still creates a new Player as on first join.

**Seasons.** **[Implemented]** A Match belongs to exactly one season from its `date`, persisted as `seasonKey` (e.g. `2026/27`). Rankings default to the current season (`?season=2026/27`). History groups Matches into season sections, newest first. Club aggregates (P/W/D/L/GF/GA) are per season. Do not auto-reset rosters or invite codes at 1 August.

---

## 4. Complete User Lifecycle

The user's journey, end to end.

### 4.1 Registration

A new user must be able to create an account. **[Implemented]**

The functional requirement is that the application can identify the user persistently and associate them with leagues, clubs, player identities, match participation, fantasy lineups, statistics and rankings. The authentication mechanism itself is a technical detail and is deliberately not specified here (see Section 26).

Current collected data: a display name, an email address and a password. Rules in force:

- The password must be at least 6 characters. **[Implemented]**
- Registration requires confirming the password. **[Implemented]**
- An email address may only be used by one account. **[Implemented]**
- Registration must not silently succeed with an empty password. **[Implemented]**
- **New accounts must verify email** before a session JWT is issued. Register does not log the user in. If SMTP is unset, register returns `503 EMAIL_NOT_CONFIGURED`. **[Implemented]** (P2.1.1)
- Users that already existed before 2.1 are treated as verified (`email_verified_at` backfill). **[Implemented]**
- Password recovery is sent by email. Reset does not log the user in. **[Implemented]**

Display names (usernames) need not be unique as football identity. The alias inside a League or Club must be unique in that context, compared case-insensitively. **[Implemented]**

Users are not auto-created as Players from their username on join. They supply an alias (Section 3.3). **[Implemented]**

Display names (usernames) need not be unique as football identity. The alias inside a League or Club must be unique in that context, compared case-insensitively. **[Implemented]**

Users are not auto-created as Players from their username on join. They supply an alias (Section 3.3). **[Implemented]**

### 4.2 Login

An existing user must be able to authenticate and recover their application context. **[Implemented]**

Unverified accounts are rejected at login with `403 EMAIL_NOT_VERIFIED`. **[Implemented]**

Forgot password is available from login. A valid reset link sets a new password and returns the user to sign in. **[Implemented]**

After login the user is taken directly to their league context. There must be no unnecessary intermediate screens between logging in and seeing either their leagues or the two actions that create one.

### 4.3 Initial state — no league yet

If the user does not belong to any league or club, the principal actions must be immediately obvious and reachable in one tap: **[Implemented]**

- **Create League** / **Create Club**
- **Join** (one invite field; `L-` / `C-` / legacy routes the context)

No dashboard, statistics panel, empty leaderboard or configuration screen may be shown before the user has meaningful data. An empty state is a call to action, not a report.

### 4.4 With one or more leagues

The user sees their Leagues and Clubs. Selecting a League enters LeagueHub; selecting a Club enters ClubHub (`/club/:id`).

> **Recommendation (not an existing rule):** if a user belongs to exactly one league, taking them straight into it after login would remove a screen and is consistent with the simplicity principle. Currently the league list is always shown, and creating a league does not navigate into it.

### 4.5 Inside a league

From the league the user can, at any time:

- See the current or next actionable Match and what is expected of them right now.
- Build or edit their Lineup.
- Submit their statistics when a Match is awaiting them.
- Participate in Player Valuation when it is open.
- Consult the Player Leaderboard and the Manager Leaderboard.
- Consult the history of past Matches.

### 4.6 Repeat

The user repeats the loop for each new Match. There is no end state; a league or club continues until its members stop playing. Rankings and history slice by season (Section 3.3); membership persists across 1 August.

---

## 5. League Lifecycle

### 5.1 Creation

A registered user creates a private league. The creator becomes its **League Owner / Administrator**. **[Implemented]**

A League minimally has:

- **Name** — required, maximum 25 characters. **[Implemented]**
- **Short description** — optional, maximum 200 characters. **[Implemented]**
- **Unique invite code** — generated automatically as `L-` plus 6 uppercase alphanumeric characters. **[Implemented]** Legacy leagues keep their original 6-character codes.
- **Creator / Administrator** **[Implemented]**
- **Members**, **Players**, **Matches**, **Leaderboards** — see the relevant sections.

On creation, the creator supplies their own **alias** and is automatically added both as a **League Member** and as a **Player** under that alias. **[Implemented]**

### 5.2 League states

A league moves through valuation and play. The states below are functional; the current persisted values are noted.

| Functional state | Meaning | Persisted value |
|---|---|---|
| **Open** | League created. Members joining. Player pool forming. | `open` |
| **Valuation open** | Members may submit or edit their Tier List. | `voting` |
| **Valuation closed** | Market Values calculated. Matches and lineups proceed normally. | `closed` |

> **[Implemented]** The administrator opens (and may reopen) valuation with an explicit action. That sets the league to `voting`. Closing writes Market Values and sets `closed`. See Section 9.

A league remaining in one state must never block the match loop from running; matches, lineups and scoring are independent of league state.

### 5.3 Deletion

The League Owner may delete their league. **[Implemented]** This is destructive: it removes the league's matches, participation records, lineups, statistics, scores, players and valuations. It must always require an explicit confirmation that names what will be lost.

Only the League Owner may delete a league. **[Implemented]**

---

## 6. League Administration

The League Administrator exists to *support the game*, not to configure a platform. Their responsibilities are deliberately limited to the following.

| Responsibility | Status |
|---|---|
| Create the league | **[Implemented]** |
| Share the invite code | **[Implemented]** — the code is visible on the league card and in the league header |
| Manage the league's player pool | **[Implemented]** |
| Add external / guest players | **[Implemented]** |
| Open Player Valuation | **[Implemented]** |
| Close Player Valuation and trigger Market Value calculation | **[Implemented]** |
| Create matches | **[Implemented]** |
| Register players in a match | **[Implemented]** |
| Divide participants into Team A and Team B before starting | **[Implemented]** |
| Start a match (locks lineups, joining and teams) | **[Implemented]** |
| Mark a match as finished and record both teams' goals | **[Implemented]** |
| Review which participants have submitted statistics | **[Implemented]** |
| Resolve or acknowledge inconsistent statistics | **[Implemented]** |
| Trigger final scoring | **[Implemented]** |
| Delete a match or the league | **[Implemented]** |

Rules that always apply:

- Every administrative operation must verify that the caller is the creator of the league the object belongs to, **on the server**. **[Implemented]** including final scoring, gated on statistic completeness.
- No administrative capability may be added that requires the administrator to understand the scoring algorithm, tune parameters, or maintain configuration between matches.

---

## 7. League Membership and Invitations

### 7.1 Joining

A registered user joins a league by entering its invite code **and an alias**. The flow is: **[Implemented]**

1. Enter an invite code (`L-XXXXXX` or a legacy 6-character League code) and an alias.
2. The system resolves the corresponding league (`L-` and legacy only; `C-` never hits leagues).
3. If the alias matches an unlinked Player, join is **blocked** with `CLAIM_PENDING` until the administrator resolves it (Section 3.3).
4. If `joinOpen` is false, join is **blocked** with `403 MEMBERSHIP_CLOSED`. The invite still resolves (wrong codes still 404). Listing unlinked players by invite still works. **[Implemented]** (P2.1.2)
4. If the alias is free, the user becomes a **League Member** and a **Player** under that alias.
5. The user gains access to the league's functionality.

### 7.2 Membership must be reliably represented

> **League membership must be persisted independently, or functionally represented in a way that reliably allows the application to know which users belong to which leagues.**

This is a functional requirement, not a database prescription. Whatever representation is used must support, cheaply and unambiguously: "is this user a member of this league?", "which leagues does this user belong to?" and "who are the members of this league?".

> **[Partially implemented]** Membership is currently stored as an array of user identifiers embedded in the league (or club) record. It works, but it makes membership a property of a document rather than an explicit relation, which makes duplicate-prevention and membership queries dependent on array manipulation. Section 25.2 recommends an explicit relation. Any change here must preserve existing memberships.

### 7.3 Member versus Player — the relationship is explicit

These are two different concepts and must never be conflated:

- A **League Member** is a *registered user* who belongs to the league. Membership grants access.
- A **Player** is a *real-world football participant* available in the league's football and fantasy context. Being a Player makes you selectable, joinable to matches and rankable in the Tier List.

**Current behaviour, stated explicitly:**

> **[Implemented]** Joining a league automatically creates a Player record for that user in that league, linked to their account and named with the **alias they supplied**. Creating a league does the same for the creator. Matching an existing unlinked alias does **not** auto-link; it raises a claim request (Section 3.3). The user does not perform a separate "become a player" action.

Consequences that follow from this and must be preserved:

- Every League Member is also a Player in that league. **[Implemented]**
- Not every Player is a League Member — external players exist without accounts (Section 8.3).
- A user has a *separate* Player identity in each League and each Club they belong to. Player identity is context-scoped; Market Value, statistics and Player Points never cross those boundaries. **[Implemented]**

> **[Implemented] — claim, not silent repair.** A separate "add me as a player" operation still exists. An unlinked alias raises `CLAIM_PENDING` rather than silently relinking, including for the administrator. New code must not auto-claim by name.

### 7.4 Membership rules

- A user must not be able to join the same league twice; the attempt must produce a clear message rather than a duplicate membership. **[Implemented]**
- A user must not receive a second Player record in a league they are already a Player in. **[Implemented]**
- Access to a league's data must be restricted to its members. **[Implemented]** for league, player, match, statistics, ranking and valuation reads (Phase 2).
- A non-administrator may leave; the administrator may remove another member. The Player stays (unlinked) so history and rankings are preserved. Return is a claim that the administrator must accept (Section 3.3). The administrator cannot leave or be removed. **[Implemented]**

---

## 8. Player Model

### 8.1 Definition

A Player is a real-world football participant within **exactly one** context: a League **or** a Club (`leagueId` xor `clubId`; the other is null). **[Implemented]**

A Player minimally has:

- **Identity / alias** — required, maximum 30 characters. Unique within that League or Club (case-insensitive). **[Implemented]**
- **Context association** — exactly one of `leagueId` or `clubId`. **[Implemented]**
- **Optional user association** — present for members, absent for external players. **[Implemented]**
- **Market value** — League-specific, derived from Player Valuation. Unused in Club Mode. **[Implemented as a field]**
- **Match participation history** **[Implemented]**
- **Real performance statistics** — see Section 15 for Fantasy; Club adds minutes (Section 23).
- **Accumulated Player Points** — see Section 17 (Fantasy, per season) and Section 23.6 (Club, per season).

After membership exists, only that context's administrator may change the alias. **[Implemented]**

### 8.2 Registered players

A Player linked to a User. Created automatically on league creation or join (Section 7.3). Can log in, join matches, build lineups, vote in the Tier List and submit their own statistics.

### 8.3 External players

An **External Player** is a person who participates in real matches but does not have a registered Pachanga account — the friend who turns up to play but never installs anything.

Intended behaviour:

- May belong to a league's player pool. **[Implemented]**
- May participate in matches. **[Implemented]** — the administrator adds them to the match; they cannot join by themselves.
- May be selected in fantasy lineups on equal terms with registered players. **[Implemented]**
- May earn Player Points and appear in the Player Leaderboard. **[Implemented]**
- Cannot log in, cannot build a lineup and cannot appear in the Manager Leaderboard. This is correct and intended: they are Players only, never Managers.
- **Because they cannot log in, they cannot submit their own statistics.** Their goals and assists must therefore be entered through an explicitly authorised flow — in practice, by the League Administrator on their behalf.

> **[Implemented]** Statistics are recorded against a *Player*, not a *User*. The League Administrator submits goals and assists for any participant who has no account. External players appear on the Player Leaderboard and never on the Manager Leaderboard.

> **Decision (P0.7):** External players remain in the product. Statistics must be re-keyed to the Player, and the League Administrator must be able to submit goals and assists on behalf of any participant who has no account. New features must assume external players can participate, be selected, and score.

---

## 9. Player Valuation / Tier List

### 9.1 Purpose

> Convert the group's collective perception of player quality into fantasy Market Values.

This is a core feature. It is what makes the fantasy prices feel fair and personal: a player is expensive because their friends think they are good, not because an algorithm said so.

### 9.2 The functional requirement

> **A user must be able to place each league player into one valuation tier.**

That is the requirement. **Drag-and-drop is not the requirement** — it is one possible implementation. Tap-to-place, buttons, or any other touch-friendly interaction is equally acceptable, and is preferable wherever it is more reliable on a phone (Section 20.9).

**Decision (P0.2):** Valuation uses **genuine tiers**, not a forced ranking:

**S · A · B · C · D**

The member-facing control is **1–5 stars** mapped 1:1 onto those tiers (**5 = S, 4 = A, 3 = B, 2 = C, 1 = D**). The stored model and Market Value scale remain S/A/B/C/D.

Multiple players may share a tier. The member is not required to order players inside a tier. Every player in the league pool must be placed in exactly one tier for that member's valuation to be complete.

> **[Implemented]** Members rate each player 1–5 stars. Those map 1:1 onto S/A/B/C/D. Several players may share a rating. The server stores a tier per player per voter.

### 9.3 Valuation rules

| Question | Answer | Status |
|---|---|---|
| Who is eligible to vote? | Any League Member. External players cannot vote — they have no account. | **[Implemented]** |
| Which players must be ranked? | All Players in the league's pool, including external players. Each must be placed in exactly one tier. | **[Implemented]** |
| Can a user rank themselves? | Yes. Users are not excluded from their own tier list. | **[Implemented]** |
| Can a valuation be edited before closure? | Yes, while valuation is open. The server already accepts resubmission. | **[Implemented]** |
| What constitutes a completed valuation? | For a member: every current league player has a tier. For the league: the administrator decides to close; not every member need have submitted. | **[Implemented]** |
| Can the administrator close valuation? | Yes. Closing calculates Market Values. | **[Implemented]** |
| Can valuation reopen? | Yes, at any time. New Market Values apply only to matches still Open. Locked and scored matches are unaffected. | **[Implemented]** |
| How is incomplete voting handled? | Closure is allowed with any number of submissions. The administrator is warned if few members have voted. Players with no votes receive the B-tier default (Section 10.3). | **[Implemented]** |

**Required corrections:**

- **[Implemented]** Members may edit their valuation while valuation is open.
- **[Implemented]** The submission count is taken from submitted valuations versus league members.
- **[Implemented]** Closing valuation requires confirmation and states how many members have voted. The administrator may reopen it (P0.4).

### 9.4 Aggregation requirements

The algorithm in Section 10.2 must remain:

- **Deterministic** — the same submissions always produce the same values.
- **Understandable** — a member can be told in one sentence why they cost what they cost ("the group put you in A, with one outlier dropped").
- **Reproducible** — recalculating from the same inputs yields the same output.
- **Easy to rebalance** — changing a tier's number must not require a new formula.
- **Inexpensive to compute** — this runs once per league for a few dozen players; no optimisation is warranted.

---

## 10. Player Market Value

### 10.1 Functional rules

- Every selectable Player has a Market Value. **[Implemented]**
- Market Value is **league-specific**. The same person may be expensive in one league and cheap in another. **[Implemented]**
- **Initial** Market Value comes from the group's S/A/B/C/D valuation, not from real-world football history. **[Implemented]**
- **After a match is scored**, Market Value updates from that match's performance (goals, assists, MVP votes, peer ratings, and the result), independently of Player Points and Manager Points (P0.12). **[Implemented]**
- Dynamic Market Value is clamped to **8–28**. A player who opened at S (30) is clamped to 28 on the first performance update.
- It contributes to the total cost of a fantasy lineup. **[Implemented]**
- A lineup may not exceed the match budget. Cost is taken from Market Values **at lineup save / match start**, not from later updates. New values apply only to matches that are still Open. **[Implemented]**
- Pre-match Market Value used for the performance update is snapshotted when the match **starts**, so a later valuation reopen cannot rewrite that match.
- A history row is stored for every participant on every scored match so the change can be replayed.
- Market Values must remain visible wherever a Manager needs them to make a selection decision. **[Implemented]**

### 10.2 Market Value calculation

#### Initial value (valuation)

**Decision (P0.1, P0.2):** the first Market Value is produced from genuine tiers, not from list position.

The member-facing control is 1–5 stars mapped 1:1 onto those tiers (5 = S … 1 = D). Stored values remain S/A/B/C/D.

Each tier has a fixed numeric value:

| Tier | Value |
|---|---|
| S | 30 |
| A | 24 |
| B | 18 |
| C | 12 |
| D | 8 |

For each Player:

1. Collect the numeric values of every submitted valuation that placed that Player.
2. If the Player has more than two votes, discard the single highest and the single lowest.
3. Average the remaining values.
4. Round to the nearest integer.

The default match budget is **100**. Budget at match creation must be between **50 and 200** inclusive.

Worked examples:

- Five players all valued B: `5 × 18 = 90` — legal under the default budget.
- Five players all valued S: `5 × 30 = 150` — illegal under the default budget. That tension is intended.
- Mixed S + B + C + C + D: `30 + 18 + 12 + 12 + 8 = 80` — legal.

Reopening valuation still overwrites Market Value from the current tiers (an administrator reset). New or unranked players still start at **B / 18**.

> **[Implemented]** Closing valuation writes the trimmed mean of submitted tier values, rounded to an integer.

#### After each scored match (performance)

Scoring writes Player and Manager point snapshots first, then Market Value history, then `players.marketValue`, then the league scoring baseline, in one transaction. Player Match Points are the peer average plus extras (goals, assists, MVP).

**Voters** are accepted participants **with a user account**. Guests do not vote. Scoring waits until every voter has submitted a ballot (`RATINGS_INCOMPLETE`). The administrator may **force** scoring anyway: missing numeric votes count as **6.5**, and goals, assists and Player of the Match extras are not added. Each ballot is:

- one **Player of the Match** (any other accepted participant; no self-vote);
- integer **0.0–10.0** (one decimal) scores for the assigned teammate and rival (mapped to 0–1 as `score / 10`).

Assignments are generated once when the match is ended (seeded by match id) so they are stable. Each participant, including guests, is targeted for **two incoming** ratings. Extra outgoing slots are given to voters who currently have the fewest. If a voter is alone on a team, they rate two rivals. Remaining peer-score gaps at compute time use **0.50** (neutral). Missing **ballots** still block scoring unless the administrator forces it (missing votes → 6.5, no extras).

**Expected contribution** from pre-match VM:

`ExpectedContribution = 0.33 × ((VM − 8) / 20)` so D/8 → 0 and S/28 → 0.33.

**PerformanceScore** = `0.40×mvp + 0.25×peer + 0.25×offensive + 0.10×result`

- **MVP (40%):** unique max-vote winner(s) get 1.0; everyone else gets `votes / totalVotes`.
- **Peer (25%):** mean of received 0.0–10.0 scores, mapped to 0–1 as `score / 10`. No ratings → 0.50.
- **Offensive (25%):** share of team weighted output (`goals + 0.8 × assists`), scaled by team goals vs the league baseline and opponent average VM (±10%). Neutral 0.5 when meeting expected contribution.
- **Result (10%):** win/draw/loss adjusted by pre-match team average VM difference.

**VM change:**

- `RawChange = 20 × (PerformanceScore − 0.50)`
- Position `X = (preMatchVm − 8) / 20` clamped to `[0, 1]`
- Upward changes shrink as VM rises; downward changes grow as VM rises
- Clamp the delta to **[−3, +5]**, add, round to nearest integer, clamp VM to **[8, 28]**

League **scoring baseline** (default 5): `0.8 × previous + 0.2 × ((teamAGoals + teamBGoals) / 2)`.

> **[Implemented]** Domain math lives in `shared/domain/marketValue.ts`. Pairing lives in `shared/domain/ratingAssignments.ts`. History rows store the four components and a full breakdown for replay.

### 10.3 Edge cases

- **A player nobody ranked** receives **B (18)**. They are never left at 0. **[Implemented]**
- **A league with a single player** is valid: that player receives the average of the votes they got, or 18 if nobody voted. No division by `playerCount - 1`. **[Implemented]**
- **A player added after valuation closed** receives **B (18)** immediately. Reopening valuation is the way to reprice them from tiers. **[Implemented]**
- **A player at 30** from initial S is clamped to **28** on the first performance update.
- **A player at 8** with PerformanceScore ≥ 0.75 hits the +5 cap; two such matches reach **18**.
- **Zero logged-in voters** does not deadlock scoring; peer and MVP components use the neutral 0.50.
- **This is not statistics verification.** MVP and peer ratings do not confirm or dispute goals and assists (Section 15.4).

---

## 11. Match Lifecycle

A Match is a stateful process. A Match belongs to exactly one context: a League **or** a Club. This section describes **Fantasy League** Matches. Club Match states are in Section 23.4.

The most important rule in this section is about vocabulary:

> **"The football match has finished" and "the fantasy scoring is final" are different events and must never share a word in the interface.**

Calling both "completed" is the single most confusing thing the application can do to its users, because between those two events there is a period where the game is over but the points are not yet known — and that period is exactly when the application needs the users to do something.

### 11.1 Functional states

**Upcoming / Open**

- The Match exists with a date, time, budget and an immutable **side size** (5, 7 or 11).
- Players can join, or the administrator can add them, until capacity (`sideSize × 2`) is reached.
- Managers can build and edit lineups of exactly five participants.
- Statistics cannot be submitted.
- Nothing is scored.

**Started / Lineups locked**

- The administrator has started the match (P0.5). Teams must already be assigned.
- Joining is closed.
- Lineups and teams are locked and immutable.
- The real football match may be in progress or about to start.
- Statistics cannot yet be submitted.

**Finished / Awaiting Statistics**

- The real football match has been played.
- The administrator has marked it as finished and recorded Team A goals and Team B goals. The persisted total (`finalScore`) is their sum.
- Participants submit their goals and assists.
- Logged-in participants vote Player of the Match and rate assigned peers (Section 10.2). Guests do not vote.
- Lineups are locked (Section 13.4).
- Fantasy points and the post-match Market Value update are not final and must not be presented as if they were.

**Ready for Validation**

- The required statistics have been submitted, or the administrator has decided that submission is complete.
- Statistics are checked for consistency against the recorded team scores (Section 15).
- The administrator resolves any inconsistency.

**Scored / Closed**

- Statistics are final.
- Player Points are final.
- Manager Points are final.
- Market Values have been updated from this match and a history row exists for each participant.
- Both leaderboards include this Match.
- The result is historical and immutable.

### 11.2 Mapping to what exists

> **[Implemented]** Persisted statuses are `open`, `started`, `completed` (football finished / awaiting stats) and `scored`. Legacy `ready` is treated as `started` and migrated away. Automatic team balancing is removed. Manual two-team assignment is required before start.
>
> - **Started** locks lineups, joining and teams.
> - **Finished** (`completed`) is football over, statistics and ratings still open. Both team scores are stored; `finalScore` is their sum.
> - **Scored** is fantasy points and the Market Value update final. It does not reuse the Finished word.
> - **Validated** is a derived statistics state (complete + goals match the result + assists do not exceed it, or goals acknowledged with assists still within the total), not a persisted match status.

### 11.3 Match creation

Only the League Administrator creates matches. **[Implemented]**

A Match minimally requires:

- **League** **[Implemented]**
- **Date and time** **[Implemented]** — also writes `seasonKey` from that date
- **Side size** — **5 vs 5**, **7 vs 7** or **11 vs 11**, chosen at creation and **immutable**. Wrong size → delete the Match and create another. Existing Matches default to 5. **[Implemented]**
- **Fantasy lineup budget** **[Implemented]** — default 100
- **Participation state** **[Implemented]**
- **Match state** **[Implemented]**

The administrator creates the next match from within the league context, in a single short form. There must be no calendar management and no recurring-fixture configuration. **The Fantasy match exists to support the fantasy loop**, not to manage a club. Club Matches are a different object (Section 23).

> **[Implemented]** Server and form both accept a budget of **50–200**. Default remains **100**.

The interface must make the **current or next actionable Match obvious** without navigation. **[Implemented]** — the league view leads with the active match and the action it currently expects.

**Decision (P0.9):** a league may have at most **one match in Open or Started**. A previous match may still be awaiting statistics, validation, or already scored. That matches real use: last week's stats are still coming in while Sunday's lineup is being built. Creating a second Open match must be rejected with a clear message. **[Implemented]**

### 11.4 Dividing players into two teams

Before the match can start, the administrator must assign every accepted participant to **Team A** or **Team B**. **[Implemented]**

Rules:

- Team A has **exactly** `sideSize` Players and Team B has **exactly** `sideSize` Players.
- A player cannot be on both teams.
- Every accepted participant must be on exactly one team.
- Teams may be edited while the match is Open. They lock when the match starts.
- Starting without a complete assignment is rejected (`TEAMS_REQUIRED` / `TEAMS_EMPTY` / `TEAMS_OVERLAP` / `TEAMS_NOT_PARTITION` / `SIDE_INCOMPLETE`).
- Assigning a Player to a side that already has `sideSize` is rejected (`SIDE_OVER_CAPACITY`). For a 7v7 Match this is the eighth Player on one side (not the sixth).
- Assignment is **manual**. There is no automatic balancing and no `ready` status (P0.10).
- `sideSize` cannot be changed after creation.

---

## 12. Match Participation

### 12.1 Joining

- A Player may join an open Match. **[Implemented]**
- The League Administrator may add or register Players in a Match, including external players. **[Implemented]**
- A Player who participates in a Match becomes **eligible for fantasy selection for that Match**.

### 12.2 The central eligibility rule

> **A Manager may only select Players registered as participants in that Match.**

A league member who is not playing in a given match must not be available in that match's fantasy lineup. External players follow exactly the same rule: they are selectable only if they are registered participants of that specific match.

> **[Implemented]** A Manager may only select Players registered as participants in that Match. The server rejects any other player identifiers.

### 12.3 Participation rules

- Joining a match twice must not create duplicate participation. **[Implemented]**
- A user must have a Player identity in the league before joining a match. **[Implemented]** — this is normally automatic (Section 7.3), and is blocked while a claim is pending.
- A Player may only participate in matches of their own league. **[Implemented]**
- Join / add-players is rejected with `MATCH_FULL` at capacity `sideSize × 2`. **[Implemented]**

> **[Implemented]** Fantasy Matches are capped at `sideSize × 2` (P2.4). There is still no invented limit of 10 independent of side size: a 7v7 holds 14, an 11v11 holds 22. Teams are not auto-balanced.

---

## 13. Fantasy Lineups

This is one of the two principal features of the product.

Each League Member, acting as a Manager, may create **one fantasy lineup per Match**.

### 13.1 Core lineup rules

| # | Rule | Client | Server |
|---|---|---|---|
| 1 | Exactly **5** Players | **[Implemented]** | **[Implemented]** |
| 2 | All selected Players must be participants in that Match | **[Implemented]** | **[Implemented]** |
| 3 | Every selected Player must be unique | **[Implemented]** | **[Implemented]** |
| 4 | Exactly **1** Captain | **[Implemented]** | **[Implemented]** |
| 5 | The Captain must be one of the five selected Players | **[Implemented]** | **[Implemented]** |
| 6 | Total lineup cost must not exceed the Match budget | **[Implemented]** | **[Implemented]** |
| 7 | One active lineup per Manager per Match | **[Implemented]** | **[Implemented]** |
| 8 | The lineup belongs to the Manager who created it and to one Match | **[Implemented]** | **[Implemented]** |

### 13.2 Who may build a lineup

Any League Member may build a lineup for a match in their league, **whether or not they are playing in it**. **[Implemented]**

This is intentional and was an explicit product decision: a friend who is injured or away can still play the fantasy game. The Manager role does not require the Player role.

### 13.3 Server-side validation is mandatory

> **[Implemented]** All eight rules in Section 13.1 are validated on the server. Total cost is recomputed from stored Market Values. The client's figure is ignored.

### 13.4 Editing and locking

- A Manager may edit their lineup freely while the Match is **Open**.
- Lineups **lock when the administrator starts the match** (P0.5). Joining locks at the same moment.
- **Ending the match is not the lock.** By then the group already knows who scored; allowing edits at that point would break the fantasy game.
- Scheduled kick-off time is **not** the lock. Amateur kick-offs slip; a clock would lock too early or too late.
- After lock, later edits must not affect historical scoring.

> **[Implemented]** While Open, lineups may be saved. After the administrator starts the match, saves and joining are rejected. The interface shows that lineups are locked and names the failing rule when a save is blocked.

Independently of the trigger:

> **[Implemented]** Once a match is scored, Manager and Player points are stored as snapshots. Later lineup or statistics edits do not change either leaderboard.

### 13.5 Lineup user experience

**Functional requirement:**

> The Manager must be able to see the five selected Players in a clear, football-oriented visual representation.

The pitch view is valuable and should remain. But the *visual* is the requirement; the *interaction mechanics* are not. **Drag-and-drop must not be required.** The current implementation uses simple tap-to-select and tap-to-captain, which is the right choice — it is reliable on a phone with one hand, which is exactly where this feature is used. **[Implemented]**

A simple interaction is sufficient and preferred:

- select a Player,
- place a Player,
- change a Player,
- select the Captain.

The interface must always clearly show: **[Implemented]**

- the selected Players,
- the Market Value of each Player where it helps the decision,
- the total lineup cost,
- the remaining or available budget,
- which Player is Captain,
- any condition currently making the lineup invalid,
- confirmation that the lineup was saved.

> **The user must never have to calculate the remaining budget themselves.**

> **[Implemented]** When saving is blocked, the interface names the failing rule (too few players, no captain, over budget, locked, or not a match participant).

---

## 14. Match Finalisation

### 14.1 Marking the match as finished

The administrator must explicitly indicate that the real football match has ended. **[Implemented]**

The Match then leaves the lineup and participation phase and enters the statistics phase. Participants must be told, clearly and immediately, that they are now expected to submit their statistics.

### 14.2 The match result

When finishing a match, the administrator enters **Team A goals** and **Team B goals**. **[Implemented]**

**Its purpose is validation.** The group observed both sides' totals. The stored match total (`finalScore`) is their sum, and is used so that submitted player goals and assists can be checked against the result (Section 15.2).

| Concept | Present in Pachanga? |
|---|---|
| **Team A goals and Team B goals** | Yes — recorded by the administrator at finalisation |
| **Total number of goals in the match** | Yes — persisted as `finalScore` = Team A + Team B |
| **Individual goal and assist statistics** | Yes — submitted per player |
| **Team-win scoring bonus** | **No** — teams exist for the pitch and for validation, not for extra fantasy points |

> **[Implemented]** Both team scores and `finalScore` are persisted at finalisation. Validation runs after statistics exist, not during end-match.

### 14.3 Final scoring

Scoring converts submitted statistics into Player Points and Manager Points, and admits the match to both leaderboards.

> **[Implemented]** Phase 2 closed authorisation and idempotency. Phase 5 gates scoring:
>
> 1. **Authorisation. [Implemented]** Only the league administrator can trigger scoring.
> 2. **Gating. [Implemented]** Scoring refuses to run unless statistics are complete and consistent, or the administrator has explicitly acknowledged an inconsistency.
> 3. **Idempotent. [Implemented]** Re-running scoring returns the existing snapshots once the match is scored. Player and Manager Match Points are written in one transaction.

---

## 15. Statistics Submission and Validation

### 15.1 Submission

The core real-world statistics are:

- **Goals**
- **Assists**

Each registered Player who participated in a Match submits their own. **[Implemented]**

Statistics are associated with a **Match** and a **Player**. **[Implemented]**

The input interaction must be **extremely simple**: two numbers and a submit action. Prefer numeric counters with plus and minus controls over free-text entry — the values are almost always between 0 and 3, and a counter is faster, harder to get wrong, and works with one thumb. **[Implemented]**

There must be **no match-report form**: no minutes played, no cards, no positions, no ratings, no commentary. Two numbers.

> **[Implemented]** Statistics submission is reachable from the live league view. Plus/minus counters replace free-text entry.

Submission rules:

- A Player may submit statistics only for a Match they participated in. **[Implemented]**
- A Player may submit statistics only after the Match has been marked finished. **[Implemented]**
- A Player must not be able to create duplicate statistic records for the same Match. **[Implemented]** — a second submit updates the same Player+Match row.
- A Player **may edit their own statistics until the match is scored** (P0.6). After scoring, statistics are immutable. The League Administrator may submit or edit statistics for **any participant** on the same terms, including absent registered players and externals (P0.7). **[Implemented]**

### 15.2 Validation

> **Pachanga must not assume submitted statistics are correct simply because everyone submitted something.**

**The goal consistency check.**

The system compares the sum of all submitted Player goals against the total goal count recorded by the administrator at finalisation.

*Example:* if the administrator recorded that the Match had **7** total goals and the submitted Player goals sum to **6**, the statistics are inconsistent and final scoring must not silently proceed.

**Assists must not exceed the match total.** The sum of submitted assists must be less than or equal to the recorded goal total (Team A + Team B). An assist cannot exist without a goal.

> **[Implemented]** Goal comparison uses the stored `finalScore` (the sum of both team scores). Assists are checked the same way (`reportedAssists <= finalScore`). Scoring is blocked until goals match (or the administrator acknowledges a goal difference) **and** assists do not exceed the total. Assists over the total cannot be acknowledged away.

### 15.3 What must be shown

The interface must clearly distinguish four states, for the administrator and for each participant:

| State | Meaning |
|---|---|
| **Pending** | This participant has not submitted yet. |
| **Submitted** | This participant has submitted. |
| **Inconsistent** | Submissions are complete but goals do not match the result, or assists exceed the result. |
| **Validated** | Statistics are complete, goals match, assists do not exceed the result, and scoring may proceed. |

> **[Implemented]** Pending and submitted are shown per participant. Inconsistent and validated are shown for the match. Scoring stays blocked while pending or unacknowledged-inconsistent.

### 15.4 Resolving inconsistency

When the goal totals do not agree, the administrator must be able to:

- see which rule failed and by how much,
- see who has and has not submitted,
- ask participants to correct their submissions,
- or explicitly acknowledge the discrepancy and proceed to scoring anyway.

The last option matters for **goal** totals. This is a group of friends, and sometimes nobody can remember who got the deflection. The system must not deadlock the whole loop over one goal, but it also must not pretend the numbers agreed when they did not. **Assists that exceed the match total cannot be acknowledged** — they must be corrected. **[Implemented]**

**No approval workflows.** There is no peer verification, no confirm/dispute cycle and no multi-step sign-off. This was explicitly removed from the product and must not be reintroduced.

Post-match MVP and peer ratings (Section 10.2) are a **separate required step**. They do not confirm, dispute, or replace statistics. An administrator may submit another participant's **statistics** (P0.7) but must **not** submit another person's votes.

---

## 16. Scoring Rules

This section is the heart of the specification. **Player scoring and Manager scoring are completely separate calculations** and must be implemented as such.

### 16.1 Player scoring

Player Points measure real football performance.

```
Player Points = peer average (0.0–10.0) + (Goals × 3) + (Assists × 2) + (2 if Player of the Match)
```

**[Implemented]** The peer average is the mean of 0.0–10.0 votes received in that match (neutral **5.0** if nobody rated the player). Tied Player of the Match winners each receive the +2 bonus. If the administrator forces scoring with incomplete ballots, missing numeric votes are **6.5** and extras (goals, assists, MVP) are omitted. The post-match Market Value update (Section 10.2) is a separate calculation and does not replace this snapshot.

**Player scoring must NOT include the Captain multiplier.** Captaincy is a fantasy concept that exists only inside a Manager's lineup and has no meaning on the pitch.

Therefore, a Player who scores 2 goals and receives a 6.0 peer average (and is not MVP) receives:

```
6.0 + (2 × 3) = 12.0 Player Points
```

— regardless of whether zero, one or twelve Managers selected that Player as their Captain.

**No team-win bonus.**

> The historical rule `if team_won: points += 1` is **not part of the current scoring requirements**.
>
> Matches now have a real two-team assignment and a two-team result, used to start the match and to validate statistics. That does **not** add a win bonus to Player Points. A win bonus may be reconsidered as a future scoring extension (Section 24) only by updating this document. Club Mode must still affect Player Points from the match result, but that coefficient is unresolved (P2.7, Section 23.5).

### 16.2 Manager scoring

Manager Points measure skill at selecting a fantasy lineup.

For every Match, a Manager's fantasy score is the sum of the Player Points generated by the five Players in their lineup, with the Captain counted twice.

```
Manager Match Points = P1 + P2 + P3 + P4 + P5 + (Captain's Player Points)
```

The Captain's points appear once in the base sum and are added a second time. Equivalently:

- a normally selected Player contributes **×1**
- the Captain contributes **×2**

**[Implemented]**

### 16.3 The example that removes all ambiguity

**A Player earns 6 Player Points in a match.**

| Perspective | Result |
|---|---|
| Manager who selected them normally | receives **6** fantasy points from that Player |
| Manager who selected them as Captain | receives **12** fantasy points from that Player |
| The Player's own record | still **6** Player Points in the Player Leaderboard |

The Captain multiplier changes what the *Manager* receives. It never changes what the *Player* earned.

### 16.4 The state of scoring today

> **[Implemented]** Manager scoring exists. Player Match Points are stored per Player. Manager Match Points are stored per registered member, snapshotting lineup and captain at scoring time. The live view shows two independent leaderboards.

### 16.5 Defaults

Scoring values (3 per goal, 2 per assist, ×2 for the Captain) are **fixed product defaults**. They are not configurable per league. Making them configurable would add setup burden to every league for the benefit of almost none, and would break comparability between leagues. **[Implemented]**

---

## 17. Player Leaderboard

### 17.1 Purpose

> **"Who is performing best as a real football player?"**

### 17.2 Definition

For every scored Match, each Player's **Player Match Points** are calculated per Section 16.1. Across the league, **within one season**:

```
Player Total Points = sum of Player Match Points across scored matches in that season
```

Totals do not mix seasons. The UI defaults to the **current** season (1 Aug–31 Jul) and can switch or section by `seasonKey`.

### 17.3 What it shows

Primary, always:

- Player
- Total Points

Optional, and sortable in the Player Leaderboard:

- Goals
- Assists
- Matches played
- Player of the Match awards
- Team wins (the side that scored more goals in a scored match)

**The Player Leaderboard must never include Captain multipliers.** Captaincy is invisible to this leaderboard.

### 17.4 Current state

> **[Implemented]** The Player Leaderboard is keyed by Player, includes zero-point players and externals, never applies a captain multiplier, and is filtered by season (default current). Members can reorder it by points, goals, assists, Player of the Match awards, wins, or matches played. History lists group finished matches into season sections, newest first.

---

## 18. Manager Leaderboard

### 18.1 Purpose

> **"Who is best at selecting the fantasy lineup?"**

### 18.2 Definition

For every scored Match, each Manager's **Manager Match Points** are calculated from their lineup per Section 16.2. Across the league, **within one season**:

```
Manager Total Points = sum of Manager Match Points across scored matches in that season
```

### 18.3 Rules

- The Manager Leaderboard and the Player Leaderboard are **completely independent**. They may be presented near each other, but never merged, and never as one list with two columns that implies a single ordering.
- A user may occupy very different positions in the two leaderboards. **This is intentional and central to the game**, and the interface should make it feel that way rather than looking like an error.
- Only registered users appear in the Manager Leaderboard. External players are never Managers.
- A Manager with no valid lineup for a Match receives **zero** points from that Match (Section 19.4).
- **No historical leaderboard may depend on mutable current state.** Once a Match is scored, its Manager Points are fixed and must not be recomputed from a lineup that may have been edited since.

### 18.4 Current state

> **[Implemented]** The Manager Leaderboard ranks registered members by snapshotted Manager Match Points. It is a separate table from the Player Leaderboard.

---

## 19. Core Business Rules

This section is the authoritative checklist. It is written so that it can be turned directly into automated tests. Each rule carries its current enforcement status.

| # | Rule | Status |
|---|---|---|
| 1 | A registered user can create or join a private league. | **[Implemented]** |
| 2 | League access is controlled through league membership. | **[Implemented]** |
| 3 | The league creator is the league administrator. | **[Implemented]** |
| 4 | A league member always corresponds to a real Player in that league. | **[Implemented]** |
| 5 | Player Valuation determines **initial** Market Value. | **[Implemented]** |
| 6 | Market Value is different from Player Points. After a match is scored, Market Value updates from that match's performance; Player Points are peer average plus goal, assist and MVP extras. | **[Implemented]** |
| 7 | Only the administrator creates Matches. | **[Implemented]** |
| 8 | Players join, or are added by the administrator, to Matches. | **[Implemented]** |
| 9 | Only Match participants can be selected in that Match's lineup. | **[Implemented]** |
| 10 | Each Manager can submit exactly one lineup per Match. | **[Implemented]** |
| 11 | Every lineup contains exactly five unique Players. | **[Implemented]** |
| 12 | Every lineup contains exactly one Captain. | **[Implemented]** |
| 13 | The Captain must be one of the five selected Players. | **[Implemented]** |
| 14 | The total lineup value cannot exceed the Match budget, computed from stored Market Values. | **[Implemented]** |
| 15 | Real Players generate Player Points from real statistics only. | **[Implemented]** |
| 16 | The Captain multiplier affects Manager Points only, never Player Points. | **[Implemented]** |
| 17 | The Player Leaderboard and the Manager Leaderboard are independent. | **[Implemented]** |
| 18 | Match scoring must not become final before required statistics are complete and valid (or the inconsistency has been explicitly acknowledged) **and** every registered participant has submitted a ratings ballot. | **[Implemented]** |
| 19 | Scored historical Matches remain reproducible and immutable. | **[Implemented]** |
| 20 | Future features must not unnecessarily complicate the core game loop. | Product principle |

Additional rules that follow from the sections above:

| # | Rule | Status |
|---|---|---|
| 21 | A Player belongs to exactly one League **or** one Club; statistics and points never cross those contexts. | **[Implemented]** |
| 22 | External players may play and be selected, but can never log in or appear in the Manager Leaderboard. | **[Implemented]** |
| 23 | Statistics are only submitted for Matches marked as finished. | **[Implemented]** |
| 24 | Only the administrator may trigger final scoring. | **[Implemented]** |
| 25 | Running final scoring twice produces the same result as running it once. | **[Implemented]** |
| 26 | The administrator records Team A and Team B goals at finalisation. Their sum is the match total used for validation. There is no team-win scoring bonus. | **[Implemented]** |
| 27 | Scoring values (3 / 2 / ×2) are fixed product defaults and are not configurable per league. | **[Implemented]** |

---

## 20. UX and Visual Requirements

### The number-one rule: simplicity above everything else

Pachanga must feel like a small application made for a group of friends, not like a professional sports-management platform. If a screen looks like a dashboard, it is probably wrong.

### 20.1 Obvious primary action

Every principal screen makes the next relevant action immediately clear. At any moment the user should be able to open the app and see the one thing the game currently wants from them:

- Join Match
- Create Lineup
- Submit Stats
- Validate Match
- View Leaderboard

**[Implemented]** — the league view shows a single next-step banner derived from match, valuation and roster state. After the first match has been scored, the banner hides while the league is idle (valuation prompts, create-match, view-leaderboard). It returns when a new match needs action.

### 20.2 Minimal navigation

Avoid deep hierarchies. A small number of persistent top-level destinations, with everything about a league living inside a single league view and everything about a club inside ClubHub. **[Implemented]** — the league view consolidates lineup, leaderboard, history, valuation, statistics and roster into one screen with tabs. ClubHub omits lineup and valuation. Match detail stays a dialog inside that view (P1.5.1: fold, do not add a second route).

### 20.3 Mobile-first

Many users will open Pachanga in the ten minutes before kick-off or in the car park afterwards. Design for one-handed phone use. Every primary action must be completable with a thumb. **[Implemented]** — a persistent bottom navigation bar is used on small screens, including Statistics. Desktop tab labels hide on small screens so the bottom bar is the only tab chrome.

### 20.4 Low information density

Do not display administrative or statistical information unless it is relevant to the action the user is currently taking. A member who is not the administrator should never see administrative controls at all.

### 20.5 Progressive disclosure

Secondary information — full statistics, historical matches, per-player detail — appears on request, not by default.

### 20.6 Avoid unnecessary configuration

Reasonable defaults must exist for match budgets, scoring rules and every other repetitive value. A league administrator should be able to create a Fantasy match by choosing a date and a side size, with budget defaulting to 100. **[Implemented]**

### 20.7 Immediate feedback

After joining a match, saving a lineup or submitting statistics, the user must **immediately** know whether it worked. Success confirmation and failure explanation are both mandatory; silence is not an acceptable outcome of a tap. **[Implemented]**

### 20.8 Functional before decorative

Animations, haptics, confetti, glow and flashing elements are optional enhancements. **They must never be required to understand or operate the application.** No functional requirement may depend on an animation having played. **[Implemented]** — hover-scale decorations were removed from primary flows; nothing waits for an animation.

### 20.9 Reliability over interaction novelty

A simple tap is preferred over drag-and-drop wherever drag-and-drop introduces mobile reliability or accessibility problems. This applies directly to two features:

- **Lineup building** already uses tap-to-select. Keep it. **[Implemented]**
- **The Tier List** uses tap-to-place: tap a tier for each player. Sharing a tier is allowed. **[Implemented]**

### 20.10 Visual identity

The following identity should be preserved where it remains compatible with the application:

- Dark theme **[Implemented]**
- Football-oriented visual language **[Implemented]**
- Compact cards **[Implemented]**
- Mobile navigation **[Implemented]**
- A visually recognisable football pitch for lineups **[Implemented]**

**Exact colours, animations and decorative effects are not immutable product requirements.** They may change freely provided the identity above survives and the design system remains coherent.

### 20.11 Visual hierarchy

In order of prominence:

1. Primary action
2. Current match status
3. The user's own lineup and status
4. Leaderboard and status information
5. Secondary information

> **Do not use decorative visual complexity to compensate for unclear information architecture.** If a screen needs a gradient to be understandable, the screen is wrong.

**[Implemented]** — the next-step banner sits above match status until the first match is scored; participants sit behind View Match; mobile uses the bottom bar only.

### 20.12 Language

The application supports Spanish and English, with Spanish as the default. **[Implemented]**

Both translations must be complete. **[Implemented]** — English and Spanish cover the live interface. Duplicate keys in the Spanish file were collapsed.

Translated terminology must respect Section 3.2. In particular, the distinction between valuation, Market Value, Player Leaderboard and Manager Leaderboard must survive translation and must not collapse into a single word in either language. **[Implemented]** — English: Valuation / Market Value / Player Leaderboard / Manager Leaderboard. Spanish: Valoración / Valor de Mercado / Clasificación de jugadores / Clasificación de managers.

---

## 21. Functional States and Error Handling

Errors must be **short, specific and actionable**. "Something went wrong" is never acceptable. The user should always learn what failed and what to do next.

| Situation | Required behaviour | Status |
|---|---|---|
| **Invalid invite code** | Clear error; the user remains on the form and can try another code. | **[Implemented]** |
| **Already joined league** | No duplicate membership is created; the user is told they are already a member and is offered the league. | **[Implemented]** |
| **Joining the same match twice** | No duplicate participation is created; the existing participation is returned. | **[Implemented]** |
| **Invalid lineup** | The exact reason is stated: fewer than five Players / duplicated Player / Player not participating in this Match / no Captain / Captain not in the lineup / budget exceeded. | **[Implemented]** |
| **Statistics already submitted** | Duplicate records are prevented, or a controlled edit is offered where permitted. | **[Implemented]** |
| **Match already scored** | Historical rankings are never silently recalculated from mutable data. Recalculation is possible only when explicitly requested and controlled. | **[Implemented]** |
| **Incomplete statistics** | Scoring is not finalised. The administrator is shown who is still pending. | **[Implemented]** |
| **Inconsistent goal total** | The administrator is told which validation rule failed and by how much, and is offered the resolution options in Section 15.4. | **[Implemented]** |
| **Match full** | The user is told the match is full rather than shown a failing action. | **[Implemented]** |
| **Not a member of the league** | Access is refused. | **[Implemented]** |
| **Player name already used in league** | The user is told the name is taken and can choose another. | **[Implemented]** |
| **Valuation closed** | Ranking controls are hidden and the state is explained. | **[Implemented]** |

Two general rules:

- **A disabled control must explain itself.** If an action cannot be taken, the user must be able to find out why without guessing. This applies especially to the lineup save control.
- **Failure must be visible, not silent.** If scoring cannot complete, it must fail loudly rather than produce a partial or incorrect leaderboard.

---

## 22. Current Core Scope

The following features constitute the current core product. Everything not in this list is secondary unless the existing code proves it is already an intentional core feature.

| Feature | Status |
|---|---|
| User registration | **[Implemented]** |
| Login and persistent session | **[Implemented]** |
| Private league creation | **[Implemented]** |
| Joining a league by invite code | **[Implemented]** |
| League membership | **[Implemented]** |
| Player model and automatic player creation | **[Implemented]** |
| External players | **[Implemented]** |
| Player Valuation / Tier List | **[Implemented]** |
| Market Value | **[Implemented]** |
| Match creation | **[Implemented]** |
| Match participation | **[Implemented]** |
| Fantasy lineup of exactly five players | **[Implemented]** |
| Budget restriction | **[Implemented]** |
| Captain ×2 for Manager scoring | **[Implemented]** |
| Match finalisation with both team scores | **[Implemented]** — Team A, Team B, and `finalScore` persisted at end-match |
| Manual two-team assignment before start | **[Implemented]** |
| Goals and assists submission | **[Implemented]** — admin may submit for any participant |
| Statistics validation | **[Implemented]** — goals must match the result; assists must not exceed it |
| Player scoring | **[Implemented]** — goals×3 + assists×2; win bonus removed |
| Manager scoring | **[Implemented]** |
| Player Leaderboard | **[Implemented]** |
| Manager Leaderboard | **[Implemented]** |
| Repeatable match loop | **[Implemented]** — Player and Manager scoring both run from snapshots |
| Avatars and per-context aliases | **[Implemented]** |
| Claim requests that block join until resolved | **[Implemented]** |
| Prefixed invite codes (`L-` / `C-`) with legacy League fallback | **[Implemented]** |
| Fantasy side size 5 / 7 / 11 | **[Implemented]** — immutable; lineup still five |
| Seasons (1 Aug–31 Jul) on rankings and history | **[Implemented]** |
| Club Mode | **[Implemented]** — see Section 23; result and MVP point weights still unresolved |

### 22.1 The critical path

**[Implemented]** The Fantasy core loop can be completed end to end: register → create league (alias) → join (alias) → open valuation → rank → close → create match (choose 5/7/11) → join → build Team A / Team B (exact sideSize) → lineup of five → start → finish → submit statistics → vote → score → both leaderboards and updated Market Values, sliced by season. Automated coverage is `tests/api/full-loop.test.ts`, `tests/api/side-size.test.ts` and `tests/api/market-value.test.ts`. Club Mode has its own loop in Section 23.7.

---


## 23. Club Mode

Club Mode is a **separate Pachanga experience**. It is not a League flag, not a Fantasy variant, and not “Team Mode”. **Team** remains reserved for Fantasy Match sides (Team A / Team B).

A Club is a persistent real squad. Matches are **our Club versus an opponent that exists only as a name and a score**. Opponent players are never stored.

### 23.1 In scope (2.0)

- Club create / join (`C-` codes, alias, claims — Section 3.3).
- Roster: registered and external Players.
- Matches: date, opponent name, our goals, opponent goals.
- Individual stats: goals, assists, minutes (0–120).
- Assigned peer ratings (registered voters only).
- MVP (registered voters).
- Player Ranking (season totals), sortable by points, goals, assists, minutes, Market Value, MVP awards and matches played.
- Match history, grouped by season, with Club aggregates P / W / D / L / GF / GA **per season**, and an expandable recap of that day’s stats.
- Valoración (S/A/B/C/D) and Market Value, using a Club adapter of the Fantasy VM formula.

**[Implemented]**

### 23.2 Out of scope (do not build)

Training, tactics, availability, positions, competitions/tournaments, opponent rosters, opponent Player entities, club-management ERP, Fantasy lineups, budget, Captain, Manager Points, Manager Leaderboard, Team A / Team B.

### 23.3 Membership

External Players are full football participants: Matches, goals, assists, minutes, **receive** peer ratings and MVP votes, appear in rankings. They cannot submit ratings or MVP votes (no account).

Administrators may submit/correct **objective** stats (goals, assists, minutes) for any participant. Administrators must **never** submit peer ratings or MVP votes on behalf of another User. **[Implemented]**

A pending claim blocks Club membership until the administrator accepts or rejects, the same as in a League (Section 3.3). **[Implemented]**

Leave and admin-remove unlink the Club Player and drop membership without deleting history or rankings. Rejoin is a claim that must be accepted. The creator cannot leave or be removed. **[Implemented]**

### 23.4 Club Match flow

Persisted statuses: `open` → `started` → `completed` (result recorded) → `scored` → `closed`. Fantasy may keep `scored` as terminal; Club close is a separate action.

1. Admin creates a Club Match (date; opponent name may be filled at result time). Reject `sideSize`, `matchTeams` and lineup budget on Club Matches. **[Implemented]**
2. Club Players join / admin registers participants (including externals). No Team A/B.
3. Match is played (`started` may lock joining).
4. Admin records opponent name, our goals, opponent goals → `completed`. **[Implemented]**
5. Participants (or admin for objective fields) submit goals, assists, minutes.
6. Registered participants complete **assigned** peer ratings. Goal: every participant receives **at least 3** incoming ratings when mathematically possible. Outgoing counts need not be equal. Small squads (fewer than four eligible voters): each voter rates every other rateable participant. Assignments persist and are stable on reload. **[Implemented]**
7. Registered participants vote MVP among Match Participants (no self-vote).
8. Admin may resolve missing objective stats.
9. Scoring is calculated, or force-scored. Incomplete peer ballots still block normal calculate (`RATINGS_INCOMPLETE`). Force fills each missing **incoming assigned** rating with **6.5**; objective stats that exist still count. After calculate or force, scoring is definitive; late ratings and late stats are rejected. **[Implemented]**
10. Admin **explicitly closes** the Match. After close it is immutable in normal User and admin correction flows. **[Implemented]**
11. Player Ranking and history reflect the closed/scored Match, sliced by season.

Sum of participant goals versus ourGoals may warn the admin. Do not invent a second opponent-stat model.

### 23.5 Club Player Points

```
Player Points =
  peerAverage
  + (goals × 3)
  + (assists × 2)
  + minutesComponent
  + resultContribution
  + mvpContribution
```

- **Goals / assists:** same football weights as Fantasy (`×3`, `×2`).
- **Peer:** mean of received assigned ratings (0.0–10.0). Force-score: each missing incoming rating required by the assignment set is **6.5**, then average. Asymmetry of 3 vs 4 incoming ratings is allowed.
- **Minutes:** 0–120. Cap **5** points at a full 90 minutes: `minutesComponent = min(5, round1(minutes * 5 / 90))`. So 90+ minutes → 5.0; 45 minutes → 2.5.
- **Result contribution:** must affect Player Points. Fantasy explicitly has **no** win bonus (Section 16.1). **[Requires product decision]** Do not implement +3/+1/0 or any other invented constant. Persist W/D/L for history and ranking filters only until confirmed.
- **MVP contribution:** must affect Player Points. Fantasy uses **+2**. **[Requires product decision]** whether Club reuses that +2. Persist the MVP flag for history only until confirmed.

**[Implemented]** for peer, goals, assists and minutes. The two unresolved bonuses stay at zero in code (`CLUB_RESULT_POINTS_PENDING`, `CLUB_MVP_POINTS_PENDING`).

### 23.6 Ranking and history

Ranking = **total contribution across the season** (sum of Match Player Points). Minutes and participation accumulate. Also persist, per season: matches played, wins, draws, losses, goals for, goals against (Club-level history) and per-Player minutes/goals/assists/peer/MVP/points/current Market Value.

History list: grouped by season (1 Aug–31 Jul), date, opponent, result. Expanding a finished match shows that day’s goals, assists, minutes, peer average, points, MVP and VM before→after. **[Implemented]**

### 23.6a Club Market Value

Club Valoración uses the same S/A/B/C/D close as a League (Section 7). After a Club match is scored, Market Value updates with the Fantasy weights and these Club-only inputs:

- one squad (all accepted participants); there is no opponent roster
- `opponentDifficulty = 1` and a neutral VM advantage (`ownAvgVm = oppAvgVm`)
- `teamGoals = ourGoals`, `oppGoals = opponentGoals`
- Club `scoringBaseline` advances from our/opponent goals

This does **not** add result or MVP coefficients to Club Player Points.

### 23.7 Club UI, API and tests

- Overview: Create Club, Join (one field, prefix routes). Cards: League vs Club.
- `ClubHub` `/club/:id`: Roster, Clasificación (Player only), Historial, Valoración, Estadísticas. No Lineup, no Team A/B.
- Automated coverage: `tests/api/club-entity.test.ts`, `tests/api/club-match.test.ts` (full loop: create club → join alias → match → participants → result → stats+minutes → ratings+MVP → calculate → close → ranking + history by season), `tests/api/club-valuation.test.ts`, plus unit tests for assignments, the scoring formula and the Club VM adapter.

---
## 24. Public-ready foundations (2.1)

These are product rules for a public deployment. They do **not** change Fantasy or Club football scoring.

### 24.1 Email and Google

- Register creates an unverified user and emails a verification link. **[Implemented]**
- Google OAuth routes exist and return `501 GOOGLE_NOT_CONFIGURED` until both client id and secret are set. The UI shows “Continue with Google” only when `/api/auth/features` reports `google: true`. **[Implemented]**

### 24.2 Membership close

The administrator of a League or Club may close or reopen join (`joinOpen`) independently of valuation `status`. **[Implemented]**

### 24.3 Billing accounts and `/billing`

Subscriptions are owned by a **billing account** for a User, a League or a Club — not hard-wired to `users.id`. Every League and Club is provisioned on the seeded `free` plan. Members inherit that org’s entitlements in that context. **[Implemented]**

`free` includes every current 2.0 feature. A catalog-only `plus` plan exists for comparison and for a server-side placeholder gate (`org.plus_placeholder`); football routes are not locked behind payment. **[Implemented]**

`/billing` (and `/plans`) shows the current plan, catalog cards, a feature comparison, status, and an upgrade control. While `PAYMENTS_ENABLED` is false, checkout and the webhook return `501 PAYMENTS_DISABLED` and the page does not charge. **[Implemented]**

Paid gates must be enforced on the server (`requireEntitlement` / `403 ENTITLEMENT_REQUIRED`), not only by hiding UI. **[Implemented]**

### 24.4 Ads

`/api/auth/features` reports `ads: false` unless `ADS_ENABLED`. `AdSlot` renders nothing. There is no ads HTTP endpoint and no ads `501`. **[Implemented]**

### 24.5 Single client

The React/Vite responsive client is the only UI and the future mobile UI. Do not add a second frontend. **[Implemented]**

---
## 25. Future Features

The following are **`Future / Not required for the current core loop`**.

They are recorded so they are not lost, not because they are committed. **A future concept must never be used to justify or redefine a current business rule.**

| Feature | Notes |
|---|---|
| **End-of-season Wrapped** | A simple in-app summary screen showing best player, best manager and highlights. No export, no image generation, no sharing. |
| **Club result scoring weight** | Must affect Club Player Points. Unresolved (P2.7). Do not invent +3/+1/0. |
| **Club MVP scoring weight** | Must affect Club Player Points. Unresolved (P2.7). Do not invent a Club-only constant; Fantasy uses +2. |
| **PWA / offline improvements** | Installability and tolerance of poor connectivity at a football pitch. |
| **Improved animations and transitions** | Strictly decorative; Section 20.8 applies. |
| **Player cards** | Richer per-player visual identity. |
| **Card rarity or multiplier systems** | Would change scoring and must not be introduced without revisiting Section 16. |
| **Additional scoring mechanics** | Including a team-win bonus, which requires a real team and result model first (Section 16.1). |
| **Richer social features** | Comments, reactions, profiles. |
| **Automatic team balancing** | **Withdrawn (P0.10).** The `ready` match status and automatic balancing were removed. **Manual** two-team assignment before start is required (Section 11.4). |
| **Real-time updates** | Explicitly rejected. All data is entered after the match; ordinary requests and cache invalidation are sufficient. |
| **Public leagues** | Explicitly rejected. Pachanga is private by design. |
| **Notifications** | Not specified. Would need a clear trigger model before being considered. |

---

## 26. Lightweight Technical Recommendations

This document is functional. This section is deliberately short and contains no schemas, endpoint catalogues or architecture diagrams; those belong in separate technical documentation.

### 25.1 Priority order for technical decisions

1. Simplicity
2. Reliability
3. Maintainability
4. Low operational cost
5. Developer productivity
6. Performance
7. Future scalability

**Pachanga is a small-group application.** A league has a handful of members and plays perhaps weekly. Architecture designed for hypothetical massive scale is a cost with no benefit.

### 25.2 Prefer

- One frontend application.
- One backend API.
- One relational database.
- Simple authentication.
- Conventional REST-style operations.
- Direct synchronous requests.
- **Simple, complete server-side validation.** This is the single most important technical recommendation in this document: the majority of the functional gaps in Sections 13, 14 and 15 are cases where a rule was implemented in the browser and nowhere else.
- Minimal dependencies and minimal infrastructure.
- Explicit relations for important business relationships, in preference to storing them inside loosely structured blobs. This applies directly to league membership (Section 7.2) and team assignments.

### 25.3 Avoid unless a demonstrated requirement exists

Microservices · event-driven architectures · message brokers · distributed caching · CQRS · service meshes · multiple databases · premature GraphQL · WebSockets for anything that works with ordinary requests · enterprise RBAC · complex infrastructure orchestration.

### 25.4 On the existing stack

The application uses React, TypeScript, Express, PostgreSQL and Drizzle. **These remain adequate and should be retained.** Do not recommend migrating technologies for novelty. A technical change must have a clear functional or maintenance benefit.

### 25.5 Persistence principles

Not a database specification — but the persistence model must be able to represent, unambiguously:

Users · Avatars · Leagues · Clubs · Membership · Players (leagueId xor clubId) · Aliases · Claim requests · Invite codes (`L-` / `C-` / legacy, text width) · Player Valuations · Market Values · Matches (leagueId xor clubId, seasonKey, Fantasy sideSize, Club opponent/result) · Match Participants · Fantasy Lineups · Captain · Match Statistics (minutes on Club rows) · Player of the Match votes · Peer ratings and assignments · Market Value history · Player Match Points · Manager Match Points · Historical leaderboard inputs

Two principles:

- **Prefer explicit relations** over embedding important relationships in JSON blobs.
- **Historical scored data must be reproducible.** Once a match is scored, the inputs that produced its result must remain retrievable and unchanged, independently of any later edits to current state.

Those earlier gaps are closed: Manager Match Points are snapshotted (Section 16.4) and statistics are keyed to the Player (Section 15.1). New 2.0 values (avatarPath, claim requests, sideSize, seasonKey, clubId, minutes, opponent fields) must be allowed in Drizzle, SQL migrations and the test schema **before** application code writes them.

Table names are not prescribed here. Documenting the currently implemented model belongs in a separate technical document.

### 25.6 On the API

**Functional requirements describe actions, not URLs.** Prefer:

> A registered user can join a league using its invite code.

over:

> `POST /api/v1/leagues/{id}/membership`

Endpoint naming belongs in technical documentation. However, backend operations should correspond cleanly to functional actions:

create league · join league · create club · join club · upload avatar · resolve claim · open valuation · submit valuation · close valuation · create match · join match · add players to match · save lineup · assign teams · start match · record club result · close club match · finalise match · submit stats · validate stats · calculate scoring · retrieve player leaderboard · retrieve manager leaderboard

Where an operation has no functional counterpart in this document, question whether it should exist.

---

## 27. Acceptance Criteria / Functional Validation Checklist

### 26.1 Worked examples

These examples are deliberately concrete so they can be lifted directly into tests.

**Lineup budget**

- Match budget 100; selected Players total 101 → **the lineup must be rejected**.
- Match budget 100; five valid participating Players totalling 90; one Captain nominated from those five → **the lineup must be accepted**.

**Player scoring**

- A Player records 2 goals and 1 assist and is not MVP, with a 5.0 peer average → Fantasy `Player Points = 5.0 + (2 × 3) + (1 × 2) = 13.0`.
- Force-score with incomplete Fantasy ballots: missing votes are 6.5 and extras (goals, assists, MVP) are omitted.

**Club minutes and unresolved bonuses**

- 45 minutes → `minutesComponent = 2.5`. 90 or 120 minutes → `5.0`.
- Club Player Points currently add peer average + goals×3 + assists×2 + minutes only. Result and MVP weights stay 0 until P2.7 is confirmed.

**Claim request**

- Join a League or Club by selecting an unlinked Player, or with an alias that matches one → `409 CLAIM_PENDING`, user is not a member, cannot open that context's matches until the administrator accepts.

**Fantasy side size**

- A 7v7 Match accepts 7 on Team A; the 8th on Team A is rejected; 14 participants can start; 13 cannot. Lineup on an 11v11 is still exactly five.

**Captain separation**

- That same Player is selected as Captain by a Manager:
  - The Manager receives **16** fantasy points from that Player.
  - The Player Leaderboard still records **8** Player Points for that Player.
- Another Manager selects the same Player normally:
  - That Manager receives **8** fantasy points from that Player.
  - The Player's record is unchanged at **8**.

**Manager scoring**

- A lineup of five Players earning 8, 3, 0, 2 and 6 Player Points, with the 8-point Player as Captain:
  - `Manager Match Points = 8 + 3 + 0 + 2 + 6 + 8 = 27`.

**Statistics validation**

- A Match with a recorded total of 7 goals; submitted Player goals sum to 6 → **final scoring must not silently proceed as valid**. The administrator must be informed which rule failed and by how much.

**Missing lineup**

- A Manager who submitted no lineup for a scored Match receives **0** Manager Points from that Match and is not silently assigned a generated lineup.

**Invalid lineup at scoring time**

- A stored lineup that does not satisfy the rules in Section 13.1 must cause scoring **to fail visibly for that lineup** rather than silently produce an incorrect Manager score.

**Idempotent scoring**

- Triggering final scoring twice for the same Match produces the same leaderboard as triggering it once.

**Historical immutability**

- After a Match is scored, editing a lineup or resubmitting a statistic does not change that Match's contribution to either leaderboard.

### 26.2 Checklist for any new functionality

Before merging any change, a developer should be able to answer every question below.

**Product compatibility**

- [ ] Does the feature support the core Pachanga loop?
- [ ] Does it preserve the distinction between Player and Manager in Fantasy, and avoid inventing Managers in Club Mode?
- [ ] If it is Club Mode, does it avoid Team A/B, lineups, Market Value and invented result/MVP coefficients?
- [ ] Does it preserve the distinction between Market Value and Player Points (points are peer average plus extras, VM still uses the performance formula)?
- [ ] Does it preserve the distinction between the Player Leaderboard and the Manager Leaderboard?
- [ ] Could this be left out entirely without weakening the loop?

**League**

- [ ] Does league membership remain consistent?
- [ ] Are administrator-only actions correctly protected **on the server**?
- [ ] Can the feature create duplicate memberships or duplicate Players?
- [ ] Does it respect league scoping — can data leak between leagues?

**Match**

- [ ] Does it respect the Match lifecycle?
- [ ] Does it keep "football match finished" distinct from "fantasy scoring final"?
- [ ] Can only eligible Players participate?
- [ ] Can only Match participants be selected in lineups?

**Lineup**

- [ ] Exactly five unique Players, verified on the server?
- [ ] Does the Captain belong to the lineup?
- [ ] Is the budget respected, with cost recomputed from stored Market Values?
- [ ] Is the lineup associated with the correct User and Match?
- [ ] Is the historical lineup safe after scoring?

**Statistics**

- [ ] Associated with the correct Player and Match?
- [ ] Is duplicate submission prevented, or intentionally and visibly handled?
- [ ] Does validation occur before final scoring?
- [ ] Do goal totals remain coherent where applicable?
- [ ] If external players are involved, is there an authorised submission path for them?

**Scoring**

- [ ] Are Player Points computed independently of any fantasy concept?
- [ ] Does the Captain multiplier affect Manager Points only?
- [ ] Are Manager Points based on the correct lineup?
- [ ] Do both leaderboards update consistently?
- [ ] Is scoring idempotent?
- [ ] Does recalculation leave historical results uncorrupted?

**UX**

- [ ] Is the primary action obvious?
- [ ] Has unnecessary navigation been avoided — and is the feature actually reachable?
- [ ] Does it work well on a phone, one-handed?
- [ ] Could a simpler interaction solve the same problem?
- [ ] Are errors specific and actionable, and do disabled controls explain themselves?
- [ ] Has decorative complexity been kept secondary?
- [ ] Are both translations complete?

**Technology**

- [ ] Does the implementation reuse the existing architecture where reasonable?
- [ ] Does it avoid introducing unnecessary infrastructure?
- [ ] Could the same requirement be met with fewer moving parts?
- [ ] Is every business rule enforced on the server, not only in the browser?
- [ ] Is the simplest reliable solution being used?

---

## Appendix A — Phase 0 decisions

Closed 8 September 2026. The authoritative table lives under **Phase 0 decisions** at the top of this document. Nothing in this appendix remains open.

If a later change revisits one of these rules, update the Phase 0 table and the section that implements it in the same change.

---

## Appendix B — Explicitly Out of Scope for This Document

The following belong in the README, technical architecture documentation, QA documentation, deployment documentation or the roadmap. They are not functional requirements and must not compete with them for attention:

Test counts by framework · CI execution times · hosting provider free-tier limits · serverless claims · infrastructure scalability claims · exact animation effects · confetti · neon and glow effects · haptic feedback · translation-effort claims · speculative high-scale optimisations · marketplace and card systems · endpoint tables and database schemas.
