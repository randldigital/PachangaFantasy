# Pachanga Fantasy - Testing Guide

## Overview

This project includes a comprehensive testing system using Vitest for both frontend and backend testing, ensuring reliability and maintainability across all application features.

## Testing Stack

### Frontend Testing
- **Vitest**: Fast test runner with TypeScript support
- **@testing-library/react**: React component testing utilities
- **@testing-library/user-event**: User interaction simulation
- **jsdom**: DOM environment for React component tests

### Backend Testing
- **Vitest**: Unified testing environment
- **Supertest**: HTTP endpoint testing
- **MSW (Mock Service Worker)**: API request mocking

### Utilities & Mocking
- **MSW**: Mock server for API responses
- **Happy DOM**: Alternative DOM environment
- **Custom test utilities**: Shared mock data and render functions

## Project Structure

```
tests/
├── setup.ts                    # Global test configuration
├── test-utils.tsx              # Shared utilities and mock data
├── mocks/
│   └── server.ts              # MSW mock server setup
├── backend/                   # Backend integration tests
│   ├── auth.test.ts           # Authentication flow tests
│   ├── leagues.test.ts        # League management tests
│   ├── matches.test.ts        # Match system tests
│   └── integration/           # Full flow integration tests
├── frontend/                  # Frontend component tests
│   ├── TierListPage.test.tsx  # Tier list drag-and-drop tests
│   ├── LeagueDashboard.test.tsx # Dashboard component tests
│   └── components/            # Individual component tests
└── utils/                     # Business logic unit tests
    └── calculations.test.ts   # Market value, team balance, scoring logic
```

## Running Tests

### Available Commands

```bash
# Run all tests once
npx vitest run

# Watch mode for development
npx vitest

# Run specific test file
npx vitest run tests/utils/calculations.test.ts

# Run tests with UI
npx vitest --ui

# Generate coverage report
npx vitest run --coverage
```

## Test Categories

### 1. Backend Integration Tests

**Authentication Flow** (`auth.test.ts`)
- User registration with validation
- Login with JWT token generation
- Protected route access with token verification
- Invalid credential handling

**League Management** (`leagues.test.ts`)
- League creation and validation
- Invite code generation and joining
- User permissions and admin controls
- League participant management

**Match System** (`matches.test.ts`)
- Match creation and configuration
- Player participation and team balancing
- Lineup submission with budget validation
- Stat reporting and verification
- Score calculation and league rankings

### 2. Frontend Component Tests

**TierListPage** (`TierListPage.test.tsx`)
- Drag-and-drop interaction testing
- Player ranking validation
- Submission flow and confirmation
- Real-time updates and state management

**LeagueDashboard** (`LeagueDashboard.test.tsx`)
- League statistics display
- Match overview and navigation
- Rankings table functionality
- Admin vs player permission views

### 3. Business Logic Unit Tests

**Market Value Calculations** (`calculations.test.ts`)
- Tier list averaging with outlier removal
- Market value assignment based on rankings
- Edge cases for insufficient data

**Team Balancing Algorithm**
- Fair team distribution by market value
- Balanced team creation for matches
- Odd/even player count handling

**Lineup Cost Validation**
- Budget constraint enforcement
- Player selection validation
- Cost calculation accuracy

**Points Calculation System**
- Goals and assists scoring (3pts/2pts)
- Victory bonus assignment
- Match score aggregation

## Mock Data & Utilities

### Test Utilities (`test-utils.tsx`)

**Mock Data Generators**
```typescript
createMockUser(overrides?)     // Generate test user data
createMockLeague(overrides?)   // Generate test league data
createMockPlayer(overrides?)   // Generate test player data
createMockMatch(overrides?)    // Generate test match data
createMockPlayers(count)       // Generate multiple players
```

**Test Providers**
- QueryClient with disabled retries for faster tests
- AuthProvider with configurable test user
- TooltipProvider for UI component testing

**Database Test Utilities**
- Test database setup and cleanup
- Mock API response helpers
- Authentication token generation

### Mock Server (MSW)

The MSW server provides realistic API responses for:
- Authentication endpoints (`/api/auth/*`)
- League management (`/api/leagues/*`)
- Player operations (`/api/players/*`)
- Match system (`/api/matches/*`)
- Tier list submissions (`/api/tierlist/*`)

## Test Coverage Goals

### Minimum Coverage Targets
- **Backend Routes**: 80% line coverage
- **Frontend Components**: 70% line coverage
- **Business Logic**: 90% line coverage
- **Critical Flows**: 100% path coverage

### Critical Flows Tested
1. **User Registration → Login → League Join**
2. **League Creation → Player Addition → Tier List Submission**
3. **Match Creation → Team Balance → Lineup → Scoring**
4. **Market Value Calculation → Player Rankings**
5. **Authentication Flow → Protected Route Access**

## Development Workflow

### Running Tests During Development

1. **Watch Mode**: `npx vitest` for continuous testing
2. **Specific Tests**: Run individual test files during feature development
3. **Coverage Reports**: Generate before committing new features
4. **Integration Tests**: Run full flow tests before deployment

### Writing New Tests

1. **Component Tests**: Add to `tests/frontend/`
2. **API Tests**: Add to `tests/backend/`
3. **Logic Tests**: Add to `tests/utils/`
4. **Use Test Utilities**: Import mock data generators
5. **Follow Patterns**: Use existing tests as templates

### Test Data Management

- **Consistent Mocks**: Use provided mock generators
- **Isolated Tests**: Each test creates its own data
- **Realistic Data**: Mock data reflects actual application usage
- **Edge Cases**: Include boundary conditions and error scenarios

## Debugging Tests

### Common Issues

1. **Async Operations**: Use `waitFor` for component state updates
2. **Mock Cleanup**: Tests isolated with `afterEach` cleanup
3. **DOM Queries**: Use appropriate testing-library queries
4. **API Mocking**: Verify MSW handlers are configured correctly

### Debug Tools

- **Vitest UI**: Visual test runner with debugging capabilities
- **Testing Library Debug**: Use `screen.debug()` for DOM inspection
- **Console Logging**: Add temporary logs in test development
- **Coverage Reports**: Identify untested code paths

## Integration with CI/CD

The test suite is designed to run in continuous integration environments:

- **Fast Execution**: Optimized for quick feedback
- **Reliable Mocks**: Consistent behavior across environments
- **Clear Output**: Detailed error reporting for failures
- **Coverage Reports**: Automated coverage tracking

---

This testing system ensures the Pachanga Fantasy application maintains high quality and reliability while supporting rapid development and deployment cycles.