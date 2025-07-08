# Pachanga Fantasy - Database Schema Documentation

## Overview

The Pachanga Fantasy app uses a comprehensive PostgreSQL database schema designed for scalability and extensibility. The database supports current features (user management, leagues, tier lists) and future features (matches, lineups, statistics, voting, scoring).

## Schema Architecture

### Modular Design
- **Location**: `/db/schema/` folder contains all schema definitions
- **Organization**: Each domain has its own schema file with related tables
- **Relations**: Foreign key relationships and Drizzle relations defined in `/db/schema/relations.ts`

### Database Tables

#### Core User Management
- **users**: User accounts with authentication
- **leagues**: Fantasy leagues with admin management
- **league_participants**: Many-to-many relationship between users and leagues

#### Player & Content Management  
- **players**: Player profiles within leagues
- **tier_lists**: User rankings of players within leagues

#### Match System (Extended Schema)
- **matches**: Individual fantasy matches/games
- **match_participants**: User participation in specific matches
- **lineups**: User-selected player lineups for matches
- **stat_reports**: Player performance statistics
- **votes**: MVP/FLOP voting system
- **scores**: Final calculated points for users per match

## Table Relationships

```
users (1) --< (many) leagues [admin_id]
users (many) --< (many) league_participants >-- (many) leagues
leagues (1) --< (many) players
leagues (1) --< (many) tier_lists
users (1) --< (many) tier_lists

// Extended Match System
leagues (1) --< (many) matches
matches (1) --< (many) match_participants >-- (many) users
matches (1) --< (many) lineups >-- (many) users
matches (1) --< (many) stat_reports >-- (many) users
matches (1) --< (many) votes >-- (many) users
matches (1) --< (many) scores >-- (many) users
```

## Current Schema (Active)

The app currently uses the basic schema in `/shared/schema.ts`:

- ✅ **users**: Core user management with roles
- ✅ **leagues**: League creation with invite codes and participant arrays
- ✅ **players**: Player management within leagues
- ✅ **tier_lists**: Player ranking system

## Extended Schema (Available)

Additional tables have been created for future features:

- 🆕 **league_participants**: Normalized participant relationships
- 🆕 **matches**: Match/game management
- 🆕 **match_participants**: Match participation tracking
- 🆕 **lineups**: Fantasy lineup management
- 🆕 **stat_reports**: Player performance tracking
- 🆕 **votes**: Community voting system
- 🆕 **scores**: Point calculation and leaderboards

## Development Tools

### Seeding Data
```bash
tsx db/seed.ts
```
Creates demo users, leagues, and players for development.

### Database Migration
```bash
tsx db/migrate.ts extend   # Create extended tables
tsx db/migrate.ts indexes  # Add performance indexes
tsx db/migrate.ts info     # Show schema information
```

### Sample Data
The seed script creates:
- **Admin User**: admin@pachanga.com / admin123
- **Test Players**: player1@pachanga.com, player2@pachanga.com / player123
- **Demo League**: "Liga Pachanga Demo" with invite code
- **Sample Players**: 8 famous football players with positions and emojis

## Schema Evolution

### Phase 1: Basic Features (✅ Complete)
- User registration and authentication
- League creation and management
- Player tier list rankings

### Phase 2: Match System (🏗️ Schema Ready)
- Match creation and scheduling
- Player lineup selection
- Performance statistics tracking
- Community voting system
- Point calculation and scoring

### Phase 3: Advanced Features (🔮 Future)
- Tournaments and seasons
- Player transfers and trading
- Advanced analytics
- Real-time notifications
- Mobile app integration

## Data Types & Constraints

### Key Design Decisions
- **Primary Keys**: Serial integers for all main entities
- **Foreign Keys**: Proper referential integrity with CASCADE deletes
- **JSON Fields**: Used for arrays (player_ids, mvps, flops) to maintain flexibility
- **Enums**: Text constraints for status fields (role, match status, participant status)
- **Timestamps**: Automatic created_at and submitted_at tracking

### Performance Optimizations
- **Indexes**: Added on frequently queried fields (invite_code, league_id, etc.)
- **Normalized Structure**: Reduced data redundancy with proper relationships
- **Connection Pooling**: Neon serverless with automatic scaling

## Migration Strategy

The database schema is designed for smooth evolution:

1. **Backward Compatibility**: New tables don't affect existing functionality
2. **Gradual Migration**: Extended features can be enabled incrementally
3. **Data Preservation**: Existing data remains intact during schema extensions
4. **API Stability**: Current API endpoints continue working unchanged

## Usage Examples

### Basic Operations (Current)
```typescript
// Create user
const user = await storage.createUser({ username, email, password, role });

// Create league
const league = await storage.createLeague({ name, description }, adminId);

// Submit tier list
const tierList = await storage.createTierList({ playerOrder }, leagueId, userId);
```

### Extended Operations (Future)
```typescript
// Create match
const match = await createMatch({ leagueId, date, lineupBudget }, creatorId);

// Submit lineup
const lineup = await createLineup({ matchId, userId, playerIds, totalCost });

// Submit votes
const votes = await createVote({ matchId, userId, mvps, flops });
```

This comprehensive schema provides a solid foundation for the Pachanga Fantasy app's current needs while remaining flexible for future enhancements.