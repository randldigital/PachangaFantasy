# Pachanga Fantasy - Replit.md

## Overview

Pachanga Fantasy is a fullstack web application for creating and managing fantasy sports leagues with a tier list ranking system. Users can create leagues, invite friends, rank players through drag-and-drop tier lists, and see calculated market values based on collective rankings.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom dark theme
- **Internationalization**: react-i18next for English/Spanish support
- **Drag & Drop**: @dnd-kit for tier list functionality

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: Replit DB (key-value store) with PostgreSQL schema compatibility
- **Authentication**: JWT-based authentication with bcrypt for password hashing
- **Storage**: Persistent Replit DB storage with fallback to in-memory for development testing
- **API Design**: RESTful API with structured error handling
- **Data Layer**: Custom database abstraction layer supporting both Replit DB and PostgreSQL

### Project Structure
```
├── client/           # React frontend
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Route components
│   │   ├── contexts/     # React contexts (Auth)
│   │   ├── hooks/        # Custom React hooks
│   │   ├── lib/          # Utilities and configurations
│   │   └── locales/      # i18n translation files
├── server/           # Express backend
│   ├── routes.ts     # API route definitions
│   ├── storage.ts    # Data layer abstraction
│   └── vite.ts       # Development server configuration
├── shared/           # Shared TypeScript types and schemas
└── migrations/       # Database migration files
```

## Key Components

### Authentication System
- JWT-based authentication with role-based access control (admin/player)
- Protected routes on frontend with automatic token validation
- Password hashing using bcrypt
- Persistent login state with localStorage

### League Management
- Unique invite code generation for each league
- Role-based permissions (admin can manage, players can participate)
- League status tracking (open → voting → closed)
- Participant management and tracking

### Tier List System
- Drag-and-drop interface using @dnd-kit
- Player ranking with visual feedback
- Submission tracking per user per league
- Market value calculation based on average rankings (excluding outliers)

### UI/UX Design
- Dark theme with custom accent colors (blue, green, purple)
- Responsive design with mobile-first approach
- Comprehensive component library using shadcn/ui
- Internationalization support for Spanish and English

## Data Flow

### User Registration/Login Flow
1. User submits credentials through React form with validation
2. Backend validates and creates JWT token
3. Token stored in localStorage and used for subsequent requests
4. Auth context provides user state throughout application

### League Creation Flow
1. Admin creates league with unique invite code
2. League stored with admin as creator
3. Invite code shared with potential participants
4. Admin can add players and manage league settings

### Tier List Submission Flow
1. Users access tier list page for their league
2. Drag-and-drop interface allows player ranking
3. Rankings submitted as ordered array of player IDs
4. Backend tracks submissions per user per league

### Market Value Calculation
1. Admin closes voting phase
2. Backend collects all tier list submissions
3. Calculates average position for each player
4. Removes highest and lowest outlier rankings
5. Assigns market values based on final rankings

## External Dependencies

### Frontend Dependencies
- **React Ecosystem**: React 18, React DOM, React Hook Form
- **UI Components**: @radix-ui components, shadcn/ui, Tailwind CSS
- **Data Fetching**: @tanstack/react-query
- **Drag & Drop**: @dnd-kit/core, @dnd-kit/sortable
- **Routing**: wouter
- **Internationalization**: react-i18next
- **Validation**: zod, @hookform/resolvers

### Backend Dependencies
- **Server**: Express.js, Node.js
- **Database**: Drizzle ORM, @neondatabase/serverless (PostgreSQL driver)
- **Authentication**: jsonwebtoken, bcrypt
- **Development**: tsx for TypeScript execution, esbuild for production builds

### Development Tools
- **Build**: Vite with React plugin
- **TypeScript**: Full type safety across frontend, backend, and shared code
- **Linting/Formatting**: ESLint, Prettier (implied by project structure)
- **Replit Integration**: @replit/vite-plugin-runtime-error-modal, @replit/vite-plugin-cartographer

## Deployment Strategy

### Development Environment
- Vite dev server for frontend with HMR
- tsx for running TypeScript backend in development
- Integrated development with both servers running concurrently

### Production Build
- Frontend: Vite build to `dist/public`
- Backend: esbuild bundle to `dist/index.js`
- Single server serving both API and static files
- Environment variables for database connection and JWT secrets

### Database Strategy
- **Primary**: Replit DB key-value store for persistence and scalability
- **Schema**: PostgreSQL-compatible schema maintained for future migration
- **Storage Interface**: Abstracted storage layer supporting multiple backends
- **Data Structure**: Organized with prefixed keys (user:, league:, player:, tierlist:)
- **Indexing**: Custom indexes for fast lookups (email, username, invite codes)
- **Migration Ready**: Easy migration path to PostgreSQL or other databases

## Changelog
- July 08, 2025: Initial setup with React frontend and Express backend
- July 08, 2025: Implemented Replit DB persistent storage layer
  - Added comprehensive database abstraction with key-value storage
  - Created helper functions for all CRUD operations
  - Implemented market value calculation system
  - Added database seeding and migration utilities
  - Maintained schema compatibility for future PostgreSQL migration

## User Preferences

Preferred communication style: Simple, everyday language.