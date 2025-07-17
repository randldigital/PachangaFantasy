# Pachanga Fantasy - Comprehensive Technical Documentation

## Table of Contents
1. [Application Overview](#application-overview)
2. [System Architecture](#system-architecture)
3. [Database Design](#database-design)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Implementation](#frontend-implementation)
6. [Authentication & Authorization](#authentication--authorization)
7. [Core Features & Workflows](#core-features--workflows)
8. [API Design](#api-design)
9. [Data Flow](#data-flow)
10. [Testing Strategy](#testing-strategy)
11. [Development Guidelines](#development-guidelines)
12. [Evolution & Scalability](#evolution--scalability)

---

## Documentation Structure: Live vs Planned

This documentation is split into two main sections:
- **Live (v1.0):** Features, workflows, and database schema that are currently implemented and available in production.
- **Planned (≥ v1.2):** Features, enhancements, and schema changes that are planned for future releases. These are clearly marked as 'FUTURE'.

Refer to the 'What’s Implemented' matrix below for a quick overview of current vs planned features.

## What’s Implemented Matrix
| Feature/Area                | v1.0 (Live) | ≥ v1.2 (Planned) |
|-----------------------------|:-----------:|:----------------:|
| Leagues, Players, Tier List |      ✔      |        ✔         |
| Matches, Lineups, Stats     |      ✔      |        ✔         |
| MVP/Disappointment Voting   |             |        ✔         |
| Season Wrapped              |             |        ✔         |
| Stat Verification           |      ✔*     |        ✔         |
| Football Field Lineup       |      ✔      |        ✔         |
| Leaderboard Polish          |      ✔      |        ✔         |
| i18n                        |      ✔      |        ✔         |
| Testing                     |      ✔      |        ✔         |
| Feature Flags               |      ✔      |        ✔         |
| API Routes                  |      ✔      |        ✔         |
| DB Constraints              |      ✔      |        ✔         |

*Admin-only stat verification in v1.0; cross-verification planned for future.

---

## Live (v1.0) Features & Architecture

### Application Overview

### Purpose
Pachanga Fantasy is a full-stack web application for creating and managing fantasy sports leagues with a tier list ranking system. Users can create leagues, invite friends, rank players through drag-and-drop interfaces, manage matches, create lineups, and track statistics.

### Core Concepts
- **Leagues**: Private groups where users can invite friends
- **Players**: Individuals who can participate in matches (both registered users and non-users)
- **Tier Lists**: Ranking system where users rank players by dragging them into tiers
- **Market Values**: Calculated based on collective tier list rankings
- **Matches**: Games where participants create lineups and compete
- **Lineups**: Fantasy teams of 5 players with 1 captain (2x points)
- **Statistics**: Goals, assists, and other performance metrics

### User Types
- **Admin**: Can create leagues, manage players, create matches, add participants
- **Player**: Can join leagues, submit tier lists, create lineups, report stats

---

## System Architecture

### Technology Stack

#### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite (fast development, optimized production builds)
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack Query v5 (server state management)
- **UI Framework**: shadcn/ui (built on Radix UI primitives)
- **Styling**: Tailwind CSS with custom dark theme
- **Drag & Drop**: @dnd-kit for tier list functionality
- **Internationalization**: react-i18next (English/Spanish support)
- **Forms**: React Hook Form with Zod validation

#### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Neon serverless
- **ORM**: Drizzle ORM (type-safe SQL queries)
- **Authentication**: JWT-based with bcrypt password hashing
- **Development**: tsx for TypeScript execution
- **Production**: esbuild for bundling

#### Development Tools
- **Testing**: Vitest (unit), Playwright (E2E), Testing Library (React)
- **Type Safety**: Full TypeScript coverage across frontend, backend, and shared code
- **Database Migrations**: Drizzle Kit for schema management
- **Package Management**: npm with lock file for reproducible builds

### Project Structure
```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   │   ├── ui/         # shadcn/ui base components
│   │   │   └── league/     # League-specific components
│   │   ├── pages/          # Route components
│   │   ├── contexts/       # React contexts (Auth)
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utilities and configurations
│   │   └── locales/        # i18n translation files
├── server/                 # Express backend
│   ├── routes.ts           # API route definitions
│   ├── storage.ts          # Data layer abstraction
│   ├── db.ts              # Database connection
│   └── index.ts           # Server entry point
├── shared/                 # Shared TypeScript types and schemas
│   └── schema.ts          # Drizzle schema and Zod validation
├── db/                    # Database-related files
│   └── schema/            # Modular schema definitions
└── tests/                 # Comprehensive test suite
    ├── backend/           # API integration tests
    ├── frontend/          # Component tests
    ├── e2e/              # End-to-end tests
    └── utils/            # Utility and calculation tests
```

---

## Database Design

### Schema Overview
The database uses a normalized PostgreSQL schema designed for scalability and data integrity.

#### Core Tables

**Users Table**
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,           -- bcrypt hashed
  role TEXT NOT NULL DEFAULT 'player',  -- 'admin' | 'player'
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Leagues Table**
```sql
CREATE TABLE leagues (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  invite_code TEXT NOT NULL UNIQUE, -- Generated with nanoid
  admin_id INTEGER NOT NULL REFERENCES users(id), -- called 'created_by' in some docs
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Players Table** (Unified Player System)
```sql
CREATE TABLE players (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  position TEXT NOT NULL, -- ADDED: position field
  league_id INTEGER NOT NULL REFERENCES leagues(id),
  market_value INTEGER DEFAULT 0,   -- Calculated from tier lists
  emoji TEXT NOT NULL DEFAULT '⚽',
  created_by INTEGER REFERENCES users(id),
  user_id INTEGER REFERENCES users(id), -- Links to user if they have account
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Tier Lists Table**
```sql
CREATE TABLE tier_lists (
  id SERIAL PRIMARY KEY,
  league_id INTEGER NOT NULL REFERENCES leagues(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  player_order JSONB NOT NULL,     -- Array of player IDs in ranking order
  submitted_at TIMESTAMP DEFAULT NOW()
);
```

#### Match System Tables

**Matches Table**
```sql
CREATE TABLE matches (
  id SERIAL PRIMARY KEY,
  league_id INTEGER NOT NULL REFERENCES leagues(id),
  date TIMESTAMP NOT NULL,
  status TEXT DEFAULT 'open', -- 'open' | 'closed' | 'completed'
  lineup_budget INTEGER DEFAULT 100,
  created_by INTEGER NOT NULL REFERENCES users(id), -- called 'adminId' in code
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Match Participants Table** (Player-Based System)
```sql
CREATE TABLE match_participants (
  match_id INTEGER NOT NULL REFERENCES matches(id),
  player_id INTEGER NOT NULL, -- References players.id
  status TEXT NOT NULL DEFAULT 'pending', -- 'accepted' | 'declined' | 'pending'
  PRIMARY KEY (match_id, player_id)
);
```

**Lineups Table**
```sql
CREATE TABLE lineups (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  player_ids JSONB NOT NULL, -- Array of exactly 5 player IDs
  total_cost INTEGER NOT NULL,   -- Sum of player market values
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Statistics Tables**
```sql
CREATE TABLE stat_reports (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- FUTURE: Voting system for MVP/Disappointment
CREATE TABLE votes (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  mvps JSONB NOT NULL, -- FUTURE
  flops JSONB NOT NULL, -- FUTURE
  submitted_at TIMESTAMP DEFAULT NOW()
);

-- FUTURE: End-of-season summary
CREATE TABLE season_wrapped (
  league_id INTEGER NOT NULL REFERENCES leagues(id),
  summary JSONB, -- FUTURE: cached aggregation blob
  PRIMARY KEY (league_id)
);
```

**Scores Table**
```sql
CREATE TABLE scores (
  user_id INTEGER NOT NULL REFERENCES users(id),
  match_id INTEGER NOT NULL REFERENCES matches(id),
  points INTEGER NOT NULL,
  calculated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, match_id)
);
```

### Key Design Decisions

1. **Unified Player System**: Every participant is represented as a "player" record, whether they have a user account or not. This allows admins to add friends who haven't registered yet.

2. **Player-Based Participants**: Match participants reference player IDs, not user IDs, for consistency across the system.

3. **JSONB for Flexible Data**: Used for player rankings, team assignments, and participant lists to maintain performance while allowing flexibility.

4. **Normalized Structure**: Separate tables for different concerns (users, players, matches, lineups) with proper foreign key relationships.

5. **Audit Trail**: Timestamps and created_by fields for tracking data lineage.

### Enforced Constraints

- **One active match per league:**
  - Enforced in API logic: When creating a new match, the backend checks that no other match in the league has status 'open' or 'ready'.
  - (Recommended) Add a partial unique index in the database for (league_id, status) where status in ('open', 'ready') if supported by your DB.

- **One lineup per user per match:**
  - Enforced in API logic: When creating a lineup, the backend checks if a lineup already exists for (match_id, user_id) and updates instead of creating a duplicate.
  - Enforced in the database: The `lineups` table should have a unique constraint on (match_id, user_id).

---

## Backend Implementation

### Storage Layer Architecture

The backend uses a clean architecture with a storage interface that abstracts database operations:

```typescript
interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  authenticateUser(email: string, password: string): Promise<{user: User; token: string} | null>;
  
  // Leagues
  getLeague(id: number): Promise<League | undefined>;
  createLeague(league: InsertLeague, createdBy: number): Promise<League>;
  getUserLeagues(userId: number): Promise<League[]>;
  
  // Players (Unified System)
  getPlayer(id: number): Promise<Player | undefined>;
  getPlayersByLeague(leagueId: number): Promise<Player[]>;
  createPlayer(player: InsertPlayer & {leagueId: number}): Promise<Player>;
  
  // Matches & Participants
  createMatch(match: InsertMatch & {createdBy: number}): Promise<Match>;
  joinMatch(matchId: number, userId: number): Promise<MatchParticipant>;
  addPlayerToMatch(matchId: number, playerId: number): Promise<MatchParticipant>;
  getMatchParticipants(matchId: number): Promise<MatchParticipant[]>;
  
  // Additional methods for lineups, stats, scoring...
}
```

### Key Backend Components

#### DatabaseStorage Class
- Implements the IStorage interface using Drizzle ORM
- Handles all CRUD operations with type safety
- Manages complex queries for market value calculation and team balancing
- Provides error handling and data validation

#### Authentication System
```typescript
// JWT token generation
const token = jwt.sign({userId: user.id}, JWT_SECRET, {expiresIn: '7d'});

// Password hashing
const hashedPassword = await bcrypt.hash(password, 10);

// Middleware for protected routes
const authenticateToken = async (req: AuthRequest, res: Response, next: Function) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({message: 'Access token required'});
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {userId: number};
    req.user = await storage.getUser(decoded.userId);
    next();
  } catch (error) {
    res.status(401).json({message: 'Invalid token'});
  }
};
```

#### API Routes Structure
- RESTful API design with consistent patterns
- Input validation using Zod schemas
- Error handling with proper HTTP status codes
- Role-based access control for admin operations

---

## Frontend Implementation

### Component Architecture

#### Core Structure
```
components/
├── ui/                    # Base shadcn/ui components
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   └── ...
├── league/               # League-specific components
│   ├── CreateLeagueForm.tsx
│   ├── AddPlayersToMatchModal.tsx
│   ├── TierListSection.tsx
│   └── TeamAssignmentPreview.tsx
├── Navbar.tsx           # Global navigation
└── ProtectedRoute.tsx   # Route protection
```

#### State Management with TanStack Query
```typescript
// Query for fetching data
const { data: leagues, isLoading } = useQuery({
  queryKey: ['/api/leagues'],
  queryFn: () => fetch('/api/leagues').then(res => res.json())
});

// Mutation for creating data
const createLeagueMutation = useMutation({
  mutationFn: async (data: InsertLeague) => {
    return await apiRequest('POST', '/api/leagues', data);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/leagues'] });
    toast({ title: 'League created successfully' });
  }
});
```

#### Form Handling
```typescript
// React Hook Form with Zod validation
const form = useForm<InsertLeague>({
  resolver: zodResolver(insertLeagueSchema),
  defaultValues: { name: '', description: '' }
});

const onSubmit = (data: InsertLeague) => {
  createLeagueMutation.mutate(data);
};
```

### Key Frontend Features

#### Drag & Drop Tier Lists
- Uses @dnd-kit for accessible drag and drop
- Real-time visual feedback during dragging
- Persistence of rankings across sessions
- Submission validation and confirmation dialogs

#### Responsive Design
- Mobile-first approach with Tailwind CSS
- Dark theme with custom color palette
- Responsive navigation and layouts
- Touch-friendly interactions

#### Internationalization
- English and Spanish language support
- Dynamic language switching
- Translated UI elements and messages
- Proper date and number formatting

---

## Authentication & Authorization

### JWT-Based Authentication
```typescript
// Token structure
interface JWTPayload {
  userId: number;
  exp: number; // 7-day expiration
}

// Client-side token management
localStorage.setItem('auth_token', token);
const token = localStorage.getItem('auth_token');
```

### Role-Based Access Control
- **Admin**: Can create leagues, manage players, create matches, add participants
- **Player**: Can join leagues, submit tier lists, create lineups, view statistics

### Frontend Route Protection
```typescript
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, hasToken } = useAuth();
  
  if (loading) return <LoadingSpinner />;
  if (!hasToken || !user) {
    navigate('/login');
    return null;
  }
  
  return <>{children}</>;
};
```

---

## Core Features & Workflows

### 1. League Management Workflow

#### League Creation
1. Admin fills out league creation form (name, description)
2. System generates unique invite code using nanoid
3. League is created with admin as creator
4. Admin can share invite code with friends

#### Adding Players
1. Admin can add players manually (name + emoji)
2. Players can be linked to user accounts or exist independently
3. System tracks who added each player for audit purposes

### 2. Tier List System

#### Ranking Process
1. League admin opens voting phase
2. Users access tier list page for their league
3. Drag-and-drop interface allows ranking players from best to worst
4. Users can submit rankings multiple times before deadline
5. Admin closes voting to calculate market values

#### Market Value Calculation
```typescript
const calculateMarketValue = (rankings: number[][]): number[] => {
  // For each player, collect their positions across all rankings
  // Remove outliers (highest and lowest if >2 rankings)
  // Calculate average position
  // Convert to market value (higher rank = higher value)
};
```

### 3. Match System

#### Match Creation & Management
1. Admin creates match with date and lineup budget
2. Admin adds players to match using unified player system
3. System can balance teams automatically based on market values
4. Participants receive notifications and can create lineups

#### Lineup Creation
1. Users select exactly 5 players from match participants
2. One player must be designated as captain (2x points)
3. Total cost must not exceed match budget
4. System validates lineup before saving

### 4. Statistics & Scoring

#### Stat Reporting
1. Users report their own statistics (goals, assists)
2. Admin can verify total goals for the match
3. Only verified stats by admin count toward scoring

#### Points Calculation
```typescript
const calculatePoints = (stats: StatReport, iscaptain: boolean): number => {
  const basePoints = (stats.goals * 3) + (stats.assists * 2);
  return isCapta? basePoints * 2 : basePoints;
};
```

---

## API Design

### RESTful Endpoints (Live v1.0)

#### Authentication
```
POST   /api/auth/register                - User registration
POST   /api/auth/login                   - User login
GET    /api/auth/me                      - Get current user
```

#### Leagues
```
GET    /api/leagues                      - Get user's leagues
POST   /api/leagues                      - Create league (creator)
GET    /api/leagues/:id                  - Get league details
DELETE /api/leagues/:id                  - Delete league (creator only)
POST   /api/leagues/:inviteCode/join     - Join league by invite code
POST   /api/leagues/:id/join             - Join league by ID
POST   /api/leagues/:leagueId/add-me-as-player - Add self as player
GET    /api/leagues/:leagueId/check-user-player - Check if user is player
```

#### Players
```
GET    /api/players/:leagueId            - Get league players
POST   /api/players/:leagueId            - Add player (creator only)
```

#### Tier Lists
```
POST   /api/tierlist/:leagueId           - Submit or update tier list
GET    /api/tierlist/:leagueId           - Get user's tier list
POST   /api/tierlist/:leagueId/close     - Close voting and calculate values (creator only)
```

#### Matches
```
POST   /api/matches                      - Create match (creator only)
GET    /api/leagues/:leagueId/matches    - Get matches for league
GET    /api/matches/:id                  - Get match details
DELETE /api/matches/:id                  - Delete match (creator only)
POST   /api/matches/:id/end              - End match (creator only)
POST   /api/matches/:id/add-players      - Add players to match (creator only)
GET    /api/matches/:id/participants     - Get match participants
POST   /api/matches/:id/join             - Join match
```

#### Lineups
```
POST   /api/matches/:matchId/lineup      - Create or update lineup
GET    /api/matches/:matchId/lineup      - Get user's lineup for match
```

#### Statistics & Validation
```
POST   /api/matches/:matchId/stats       - Submit stat report
GET    /api/matches/:matchId/stats       - Get stat reports for match
POST   /api/matches/:matchId/validate-goals - Admin validates final score (creator only)
POST   /api/matches/:matchId/calculate-scores - Calculate match scores
```

#### Leaderboards
```
GET    /api/leagues/:leagueId/rankings   - Get league rankings
```

### API Response Patterns
```typescript
// Success response
{
  data: T,
  message?: string
}

// Error response
{
  message: string,
  errors?: ValidationError[]
}

// List response
{
  data: T[],
  count: number,
  message?: string
}
```

---

## Data Flow

### User Registration & League Creation Flow
1. User registers → JWT token generated → User redirected to dashboard
2. User creates league → Unique invite code generated → League saved
3. User shares invite code → Friends join league → Player records created

### Tier List Submission Flow
1. Admin opens voting → League status changes to 'voting'
2. Users access tier list → Drag players to rank them → Submit rankings
3. Admin closes voting → Market values calculated → Player values updated

### Match & Lineup Flow
1. Admin creates match → Adds players → Teams balanced (optional)
2. Participants create lineups → Budget validation → Lineup saved
3. Match occurs → Stats reported → Verification process → Scores calculated

### Real-time Updates
- Frontend uses TanStack Query for automatic cache invalidation
- Mutations trigger cache updates for related queries
- Optimistic updates for better user experience

---

## Testing Strategy

### Test Categories

#### Unit Tests (Vitest)
- Business logic validation (calculations, algorithms)
- Utility function testing
- Component logic testing
- 22/22 core business logic tests passing

#### Integration Tests (Supertest + Vitest)
- API endpoint testing
- Database operation testing
- Authentication flow testing
- Request/response validation

#### Component Tests (Testing Library + Vitest)
- React component rendering
- User interaction simulation
- Form validation testing
- Error state handling

#### End-to-End Tests (Playwright)
- Complete user workflows
- Cross-browser compatibility
- Performance testing
- Accessibility validation

### Test Structure
```