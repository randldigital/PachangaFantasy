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

## Application Overview

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
  password TEXT NOT NULL,           -- bcrypt hashed
  role TEXT NOT NULL DEFAULT 'player',  -- 'admin' | 'player'
  league_id INTEGER                 -- Optional default league
);
```

**Leagues Table**
```sql
CREATE TABLE leagues (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  invite_code TEXT NOT NULL UNIQUE, -- Generated with nanoid
  created_by INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'voting' | 'closed'
  participants JSONB NOT NULL DEFAULT '[]', -- Array of user IDs
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Players Table** (Unified Player System)
```sql
CREATE TABLE players (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
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
  submitted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Match System Tables

**Matches Table**
```sql
CREATE TABLE matches (
  id SERIAL PRIMARY KEY,
  league_id INTEGER NOT NULL REFERENCES leagues(id),
  date TIMESTAMP NOT NULL,
  lineup_budget INTEGER DEFAULT 100,
  status TEXT DEFAULT 'open', -- 'open' | 'ready' | 'completed'
  match_teams JSONB, -- {teamA: number[], teamB: number[]}
  created_by INTEGER NOT NULL REFERENCES users(id),
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
  player_ids INTEGER[] NOT NULL, -- Array of exactly 5 player IDs
  captain_id INTEGER NOT NULL,   -- One of the player_ids (2x points)
  total_cost INTEGER NOT NULL,   -- Sum of player market values
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Statistics Tables**
```sql
CREATE TABLE stat_reports (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  match_id INTEGER NOT NULL REFERENCES matches(id),
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  verified_by INTEGER REFERENCES users(id),
  verified_status TEXT DEFAULT 'pending', -- 'pending' | 'confirmed' | 'disputed'
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE scores (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  match_id INTEGER NOT NULL REFERENCES matches(id),
  points INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Key Design Decisions

1. **Unified Player System**: Every participant is represented as a "player" record, whether they have a user account or not. This allows admins to add friends who haven't registered yet.

2. **Player-Based Participants**: Match participants reference player IDs, not user IDs, for consistency across the system.

3. **JSONB for Flexible Data**: Used for player rankings, team assignments, and participant lists to maintain performance while allowing flexibility.

4. **Normalized Structure**: Separate tables for different concerns (users, players, matches, lineups) with proper foreign key relationships.

5. **Audit Trail**: Timestamps and created_by fields for tracking data lineage.

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
2. Other participants can verify or dispute reports
3. Admin can override verification status
4. Only verified stats count toward scoring

#### Points Calculation
```typescript
const calculatePoints = (stats: StatReport, iscaptain: boolean): number => {
  const basePoints = (stats.goals * 3) + (stats.assists * 2);
  return isCapta? basePoints * 2 : basePoints;
};
```

---

## API Design

### RESTful Endpoints

#### Authentication
```
POST /api/auth/register    - User registration
POST /api/auth/login       - User login
GET  /api/auth/me          - Get current user
```

#### Leagues
```
GET    /api/leagues                    - Get user's leagues
POST   /api/leagues                    - Create league (admin)
GET    /api/leagues/:id                - Get league details
POST   /api/leagues/:inviteCode/join   - Join league by invite
```

#### Players
```
GET    /api/players/:leagueId                      - Get league players
POST   /api/players/:leagueId                      - Add player (admin)
POST   /api/leagues/:leagueId/add-me-as-player     - Add self as player
```

#### Matches
```
GET    /api/leagues/:leagueId/matches     - Get league matches
POST   /api/matches                       - Create match (admin)
GET    /api/matches/:id                   - Get match details
POST   /api/matches/:id/join              - Join match
POST   /api/matches/:id/add-players       - Add players to match (admin)
GET    /api/matches/:id/participants      - Get match participants
```

#### Lineups
```
GET    /api/matches/:matchId/lineup       - Get user's lineup
POST   /api/matches/:matchId/lineup       - Create/update lineup
```

#### Statistics
```
POST   /api/matches/:matchId/stats        - Report statistics
GET    /api/matches/:matchId/stats        - Get match statistics
POST   /api/stats/:reportId/verify        - Verify stat report
POST   /api/matches/:matchId/calculate-scores - Calculate match scores
GET    /api/leagues/:leagueId/rankings    - Get league rankings
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
tests/
├── backend/           # API and database tests
├── frontend/          # Component and UI tests
├── e2e/              # End-to-end user workflows
├── integration/       # Cross-system tests
├── utils/            # Utility and calculation tests
└── mocks/            # Mock data and service workers
```

---

## Development Guidelines

### Code Quality Standards
- TypeScript for all code (100% type coverage)
- ESLint and Prettier for consistent formatting
- Strict null checks and type validation
- Comprehensive error handling

### Database Guidelines
- Use Drizzle ORM for all database operations
- Never write raw SQL unless absolutely necessary
- Use `npm run db:push` for schema changes
- Validate all inputs with Zod schemas

### Frontend Guidelines
- Use shadcn/ui components as foundation
- Implement proper loading and error states
- Follow mobile-first responsive design
- Use TanStack Query for all server state

### API Guidelines
- RESTful design with consistent patterns
- Proper HTTP status codes
- Input validation on all endpoints
- Comprehensive error messages

---

## Evolution & Scalability

### Current Capabilities
- Supports multiple leagues with independent management
- Handles complex player ranking and market value calculation
- Comprehensive match and lineup system
- Real-time statistics tracking and verification
- Multilingual support (English/Spanish)

### Architectural Strengths
- **Type Safety**: Full TypeScript coverage prevents runtime errors
- **Modular Design**: Clean separation of concerns for easy maintenance
- **Database Normalization**: Scalable schema with proper relationships
- **Caching Strategy**: TanStack Query provides intelligent caching
- **Component Reusability**: shadcn/ui foundation allows easy extensions

### Scalability Considerations

#### Database Scaling
- PostgreSQL with Neon provides automatic scaling
- Normalized schema allows efficient indexing
- JSONB fields provide flexibility without performance loss
- Connection pooling handles concurrent users

#### Frontend Scaling
- Component-based architecture supports large codebases
- Lazy loading and code splitting available through Vite
- TanStack Query provides efficient data fetching and caching
- Responsive design works across all device types

### Future Enhancement Opportunities

#### Feature Expansions
1. **Real-time Notifications**: WebSocket integration for live updates
2. **Advanced Statistics**: More detailed player metrics and analytics
3. **Tournament System**: Multi-league competitions and brackets
4. **Mobile App**: React Native version using same backend
5. **Social Features**: Comments, likes, player profiles
6. **Payment Integration**: Premium leagues with Stripe integration

#### Technical Improvements
1. **Microservices**: Split into separate services for different domains
2. **Redis Caching**: Add Redis for session management and caching
3. **CDN Integration**: Static asset delivery optimization
4. **Advanced Analytics**: User behavior tracking and performance metrics
5. **API Rate Limiting**: Implement rate limiting for production use

#### DevOps Enhancements
1. **CI/CD Pipeline**: Automated testing and deployment
2. **Monitoring**: Application performance monitoring (APM)
3. **Logging**: Structured logging with search capabilities
4. **Security**: Advanced security scanning and OWASP compliance
5. **Backup Strategy**: Automated database backups and disaster recovery

### Migration Strategies
- **Database Migrations**: Use Drizzle Kit for schema versioning
- **API Versioning**: Implement API versioning for backward compatibility
- **Feature Flags**: Toggle new features without deployments
- **Gradual Rollouts**: Blue-green deployments for zero downtime

---

## Conclusion

Pachanga Fantasy represents a modern, well-architected fantasy sports application built with production-ready technologies and patterns. The unified player-based system, comprehensive testing strategy, and clean architecture provide a solid foundation for future growth and feature development.

The application successfully balances flexibility with type safety, performance with maintainability, and user experience with developer experience. The modular design and comprehensive documentation make it easy for new developers to understand and contribute to the codebase.

Key strengths include the unified player system for consistency, robust authentication and authorization, comprehensive API design, and thorough testing coverage. The application is ready for production deployment and positioned for scalable growth.