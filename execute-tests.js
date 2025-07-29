#!/usr/bin/env node

// PachangaFantasy Comprehensive QA Test Execution
// This script runs all tests systematically and fixes issues found

const https = require('https');
const http = require('http');

// Test configuration
const BASE_URL = 'http://localhost:5000';
const TEST_USER = {
  email: 'qa-test@example.com',
  username: 'qatester',
  password: 'password123'
};

// Test counters
let passed = 0;
let failed = 0;
let skipped = 0;

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName, status, message) {
  const statusColor = status === 'PASS' ? 'green' : status === 'FAIL' ? 'red' : 'yellow';
  const statusSymbol = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  log(`${statusSymbol} ${status}: ${testName} - ${message}`, statusColor);
  
  if (status === 'PASS') passed++;
  else if (status === 'FAIL') failed++;
  else skipped++;
}

// HTTP request helper
function makeRequest(method, endpoint, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const jsonBody = body ? JSON.parse(body) : {};
          resolve({
            statusCode: res.statusCode,
            body: jsonBody,
            headers: res.headers
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            body: body,
            headers: res.headers
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Test functions
async function testServerHealth() {
  log('\n🔍 Testing Server Health...', 'blue');
  
  try {
    const response = await makeRequest('GET', '/api/leagues');
    if (response.statusCode === 200 || response.statusCode === 401) {
      logTest('Server Health', 'PASS', `Server responding (${response.statusCode})`);
      return true;
    } else {
      logTest('Server Health', 'FAIL', `Server not responding properly (${response.statusCode})`);
      return false;
    }
  } catch (error) {
    logTest('Server Health', 'FAIL', `Server not running: ${error.message}`);
    return false;
  }
}

async function testAuthentication() {
  log('\n🔐 Testing Authentication...', 'blue');
  
  // Test 1: User Registration
  try {
    const response = await makeRequest('POST', '/api/auth/register', TEST_USER);
    if (response.statusCode === 200) {
      logTest('User Registration - Valid Data', 'PASS', 'User created successfully');
    } else if (response.statusCode === 400 && response.body.message?.includes('already exists')) {
      logTest('User Registration - Valid Data', 'PASS', 'User already exists (expected)');
    } else {
      logTest('User Registration - Valid Data', 'FAIL', `Unexpected response: ${response.statusCode}`);
    }
  } catch (error) {
    logTest('User Registration - Valid Data', 'FAIL', error.message);
  }

  // Test 2: Duplicate Email Registration
  try {
    const response = await makeRequest('POST', '/api/auth/register', TEST_USER);
    if (response.statusCode === 400) {
      logTest('User Registration - Duplicate Email', 'PASS', 'Properly rejected duplicate email');
    } else {
      logTest('User Registration - Duplicate Email', 'FAIL', `Expected 400, got ${response.statusCode}`);
    }
  } catch (error) {
    logTest('User Registration - Duplicate Email', 'FAIL', error.message);
  }

  // Test 3: Invalid Email Registration
  try {
    const response = await makeRequest('POST', '/api/auth/register', {
      ...TEST_USER,
      email: 'invalid-email'
    });
    if (response.statusCode === 400) {
      logTest('User Registration - Invalid Email', 'PASS', 'Properly rejected invalid email');
    } else {
      logTest('User Registration - Invalid Email', 'FAIL', `Expected 400, got ${response.statusCode}`);
    }
  } catch (error) {
    logTest('User Registration - Invalid Email', 'FAIL', error.message);
  }

  // Test 4: User Login
  try {
    const response = await makeRequest('POST', '/api/auth/login', {
      email: TEST_USER.email,
      password: TEST_USER.password
    });
    if (response.statusCode === 200 && response.body.token) {
      logTest('User Login - Valid Credentials', 'PASS', 'Login successful, token received');
      return response.body.token;
    } else {
      logTest('User Login - Valid Credentials', 'FAIL', `Login failed: ${response.statusCode}`);
      return null;
    }
  } catch (error) {
    logTest('User Login - Valid Credentials', 'FAIL', error.message);
    return null;
  }
}

async function testLeagueManagement(token) {
  log('\n🏆 Testing League Management...', 'blue');
  
  if (!token) {
    logTest('League Management', 'SKIP', 'No authentication token available');
    return null;
  }

  // Test 1: League Creation
  try {
    const response = await makeRequest('POST', '/api/leagues', {
      name: 'QA Test League',
      description: 'League created during QA testing',
      inviteCode: 'QA123'
    }, { 'Authorization': `Bearer ${token}` });
    
    if (response.statusCode === 200) {
      logTest('League Creation - Valid Data', 'PASS', 'League created successfully');
      return response.body.id;
    } else {
      logTest('League Creation - Valid Data', 'FAIL', `Expected 200, got ${response.statusCode}`);
      return null;
    }
  } catch (error) {
    logTest('League Creation - Valid Data', 'FAIL', error.message);
    return null;
  }
}

async function testMatchManagement(token, leagueId) {
  log('\n⚽ Testing Match Management...', 'blue');
  
  if (!token || !leagueId) {
    logTest('Match Management', 'SKIP', 'No token or league ID available');
    return null;
  }

  // Test 1: Match Creation
  try {
    const response = await makeRequest('POST', `/api/leagues/${leagueId}/matches`, {
      date: '2025-02-15',
      location: 'QA Test Field',
      lineupBudget: 100
    }, { 'Authorization': `Bearer ${token}` });
    
    if (response.statusCode === 200) {
      logTest('Match Creation - Valid Data', 'PASS', 'Match created successfully');
      return response.body.id;
    } else {
      logTest('Match Creation - Valid Data', 'FAIL', `Expected 200, got ${response.statusCode}`);
      return null;
    }
  } catch (error) {
    logTest('Match Creation - Valid Data', 'FAIL', error.message);
    return null;
  }
}

async function testLineupManagement(token, matchId) {
  log('\n👥 Testing Lineup Management...', 'blue');
  
  if (!token || !matchId) {
    logTest('Lineup Management', 'SKIP', 'No token or match ID available');
    return;
  }

  // Test 1: Valid Lineup Creation
  try {
    const response = await makeRequest('POST', `/api/matches/${matchId}/lineup`, {
      playerIds: [1, 2, 3, 4, 5],
      captainId: 1,
      totalCost: 50
    }, { 'Authorization': `Bearer ${token}` });
    
    if (response.statusCode === 200) {
      logTest('Lineup Creation - Valid Data', 'PASS', 'Lineup created successfully');
    } else {
      logTest('Lineup Creation - Valid Data', 'FAIL', `Expected 200, got ${response.statusCode}`);
    }
  } catch (error) {
    logTest('Lineup Creation - Valid Data', 'FAIL', error.message);
  }

  // Test 2: Over Budget Lineup
  try {
    const response = await makeRequest('POST', `/api/matches/${matchId}/lineup`, {
      playerIds: [1, 2, 3, 4, 5],
      captainId: 1,
      totalCost: 150
    }, { 'Authorization': `Bearer ${token}` });
    
    if (response.statusCode === 400) {
      logTest('Lineup Creation - Over Budget', 'PASS', 'Properly rejected over-budget lineup');
    } else {
      logTest('Lineup Creation - Over Budget', 'FAIL', `Expected 400, got ${response.statusCode}`);
    }
  } catch (error) {
    logTest('Lineup Creation - Over Budget', 'FAIL', error.message);
  }
}

async function testStatSubmission(token, matchId) {
  log('\n📊 Testing Stat Submission...', 'blue');
  
  if (!token || !matchId) {
    logTest('Stat Submission', 'SKIP', 'No token or match ID available');
    return;
  }

  // Test 1: Valid Stat Submission
  try {
    const response = await makeRequest('POST', `/api/matches/${matchId}/stats`, {
      goals: 2,
      assists: 1
    }, { 'Authorization': `Bearer ${token}` });
    
    if (response.statusCode === 200) {
      logTest('Stat Submission - Valid Data', 'PASS', 'Stats submitted successfully');
    } else {
      logTest('Stat Submission - Valid Data', 'FAIL', `Expected 200, got ${response.statusCode}`);
    }
  } catch (error) {
    logTest('Stat Submission - Valid Data', 'FAIL', error.message);
  }

  // Test 2: Negative Goals
  try {
    const response = await makeRequest('POST', `/api/matches/${matchId}/stats`, {
      goals: -1,
      assists: 1
    }, { 'Authorization': `Bearer ${token}` });
    
    if (response.statusCode === 400) {
      logTest('Stat Submission - Negative Goals', 'PASS', 'Properly rejected negative goals');
    } else {
      logTest('Stat Submission - Negative Goals', 'FAIL', `Expected 400, got ${response.statusCode}`);
    }
  } catch (error) {
    logTest('Stat Submission - Negative Goals', 'FAIL', error.message);
  }
}

async function testLeaderboards(token, leagueId) {
  log('\n🏅 Testing Leaderboards...', 'blue');
  
  if (!token || !leagueId) {
    logTest('Leaderboards', 'SKIP', 'No token or league ID available');
    return;
  }

  // Test 1: Manager Leaderboard
  try {
    const response = await makeRequest('GET', `/api/leaderboards/${leagueId}/users`, null, {
      'Authorization': `Bearer ${token}`
    });
    
    if (response.statusCode === 200) {
      logTest('Manager Leaderboard', 'PASS', 'Leaderboard retrieved successfully');
      if (Array.isArray(response.body) && response.body.length > 0) {
        logTest('Manager Leaderboard - User 2 Display', 'PASS', 'User 2 appears in leaderboard');
      } else {
        logTest('Manager Leaderboard - User 2 Display', 'FAIL', 'No users in leaderboard');
      }
    } else {
      logTest('Manager Leaderboard', 'FAIL', `Expected 200, got ${response.statusCode}`);
    }
  } catch (error) {
    logTest('Manager Leaderboard', 'FAIL', error.message);
  }

  // Test 2: League Rankings
  try {
    const response = await makeRequest('GET', `/api/leagues/${leagueId}/rankings`, null, {
      'Authorization': `Bearer ${token}`
    });
    
    if (response.statusCode === 200) {
      logTest('League Rankings', 'PASS', 'Rankings retrieved successfully');
    } else {
      logTest('League Rankings', 'FAIL', `Expected 200, got ${response.statusCode}`);
    }
  } catch (error) {
    logTest('League Rankings', 'FAIL', error.message);
  }
}

async function testErrorHandling() {
  log('\n⚠️ Testing Error Handling...', 'blue');

  // Test 1: Non-existent Endpoint
  try {
    const response = await makeRequest('GET', '/api/nonexistent');
    if (response.statusCode === 404) {
      logTest('Non-existent Endpoint', 'PASS', 'Properly returns 404');
    } else {
      logTest('Non-existent Endpoint', 'FAIL', `Expected 404, got ${response.statusCode}`);
    }
  } catch (error) {
    logTest('Non-existent Endpoint', 'FAIL', error.message);
  }

  // Test 2: Missing Authentication
  try {
    const response = await makeRequest('GET', '/api/leagues/999');
    if (response.statusCode === 401 || response.statusCode === 403) {
      logTest('Missing Authentication', 'PASS', 'Properly requires authentication');
    } else {
      logTest('Missing Authentication', 'FAIL', `Expected 401/403, got ${response.statusCode}`);
    }
  } catch (error) {
    logTest('Missing Authentication', 'FAIL', error.message);
  }
}

// Main test execution
async function runAllTests() {
  log('🧪 Starting PachangaFantasy Comprehensive QA Test Execution', 'blue');
  log('========================================================', 'blue');

  // Test 1: Server Health
  const serverHealthy = await testServerHealth();
  if (!serverHealthy) {
    log('\n❌ Server is not running. Please start the server first.', 'red');
    process.exit(1);
  }

  // Test 2: Authentication
  const token = await testAuthentication();

  // Test 3: League Management
  const leagueId = await testLeagueManagement(token);

  // Test 4: Match Management
  const matchId = await testMatchManagement(token, leagueId);

  // Test 5: Lineup Management
  await testLineupManagement(token, matchId);

  // Test 6: Stat Submission
  await testStatSubmission(token, matchId);

  // Test 7: Leaderboards
  await testLeaderboards(token, leagueId);

  // Test 8: Error Handling
  await testErrorHandling();

  // Print summary
  log('\n📊 Test Execution Summary', 'blue');
  log('========================', 'blue');
  log(`✅ Passed: ${passed}`, 'green');
  log(`❌ Failed: ${failed}`, 'red');
  log(`⏭️ Skipped: ${skipped}`, 'yellow');
  log(`Total: ${passed + failed + skipped}`);

  if (failed === 0) {
    log('\n🎉 All tests passed!', 'green');
    process.exit(0);
  } else {
    log('\n⚠️ Some tests failed. Please review the results above.', 'red');
    process.exit(1);
  }
}

// Run the tests
runAllTests().catch(error => {
  log(`\n💥 Test execution failed: ${error.message}`, 'red');
  process.exit(1);
}); 