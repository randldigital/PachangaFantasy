# Pachanga Fantasy E2E Tests

This directory contains end-to-end tests for the Pachanga Fantasy application using Playwright.

## Test Structure

### Authentication Tests (`auth.spec.ts`)
- User registration with valid/invalid data
- Login with valid/invalid credentials  
- Navigation between login and register pages
- Redirect handling for unauthenticated users

### League Management Tests (`league-management.spec.ts`)
- Creating leagues as admin
- Joining leagues with invite codes
- League card display and navigation
- Admin action visibility
- Adding users as players

### Tier List Tests (`tier-list.spec.ts`)
- Navigation to tier list page
- Drag and drop functionality
- Player ranking submission
- Handling empty leagues
- Already submitted state

### Match System Tests (`match-system.spec.ts`)
- Creating matches with date/time/budget
- Joining matches
- Match participant tracking
- Match status transitions
- Navigation to lineup page

### Lineup System Tests (`lineup-system.spec.ts`)
- Player selection (5 players + 1 captain)
- Captain selection and 2x points indicator
- Budget tracking and enforcement
- Lineup saving and loading
- Cost calculation

### Navigation Tests (`navigation.spec.ts`)
- Navigation bar functionality
- User information display
- Logout functionality
- Browser back/forward navigation
- Direct URL access
- 404 handling

### Validation Tests (`validation.spec.ts`)
- Form validation errors
- Field-specific validation
- Loading states during submission
- Success/error toast messages
- Error state clearing

## Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI mode
npm run test:e2e:ui

# Run specific test file
npx playwright test auth.spec.ts

# Run in headed mode (see browser)
npx playwright test --headed

# Run with debug mode
npx playwright test --debug
```

## Test Utilities

The `tests/helpers/test-helpers.ts` file contains utility functions:
- `registerAndLogin()` - Register and login a test user
- `createTestLeague()` - Create a test league
- `createTestMatch()` - Create a test match
- `waitForToast()` - Wait for toast notifications
- Mock data generators for testing

## Browser Support

Tests run on:
- Chromium (Chrome/Edge)
- Firefox
- WebKit (Safari)

## Best Practices

1. **Data Isolation**: Each test creates unique data (timestamps in names/emails)
2. **Cleanup**: Tests are self-contained and don't rely on previous test state
3. **Waits**: Use appropriate waits for async operations
4. **Assertions**: Test both positive and negative scenarios
5. **Error Handling**: Test form validations and error states

## Debugging

1. Run with `--headed` to see browser actions
2. Use `--debug` to step through tests
3. Add `await page.pause()` for manual inspection
4. Check screenshots in `test-results/` folder after failures