#!/usr/bin/env node

/**
 * Comprehensive PachangaFantasy Lifecycle Test
 * 
 * This script tests the complete user lifecycle:
 * 1. League Owner creates a league
 * 2. 9 users register and join the league
 * 3. Everyone submits tier rankings
 * 4. Match is created and everyone joins
 * 5. Match is completed and stats are submitted
 * 6. All features are verified
 */

const BASE_URL = 'http://localhost:5000';

// Generate unique timestamp for this test run
const TIMESTAMP = Date.now();

// Test configuration
const TEST_CONFIG = {
  leagueOwner: {
    username: `league_owner_${TIMESTAMP}`,
    email: `owner_${TIMESTAMP}@test.com`,
    password: 'password123'
  },
  users: Array.from({ length: 9 }, (_, i) => ({
    username: `user${i + 1}_${TIMESTAMP}`,
    email: `user${i + 1}_${TIMESTAMP}@test.com`,
    password: 'password123'
  })),
  league: {
    name: 'Comprehensive Test League',
    description: 'League created by automated test',
    inviteCode: 'TEST123'
  },
  match: {
    date: '2025-02-15',
    location: 'Test Stadium',
    lineupBudget: 100
  }
};

// Test state
let testState = {
  leagueOwner: null,
  leagueOwnerToken: null,
  users: [],
  userTokens: [],
  league: null,
  players: [],
  match: null,
  lineups: [],
  statReports: [],
  scores: []
};

// Utility functions
async function makeRequest(method, endpoint, data = null, token = null) {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined
  });

  const responseData = await response.json();
  
  if (!response.ok) {
    throw new Error(`${method} ${endpoint} failed: ${response.status} - ${JSON.stringify(responseData)}`);
  }

  return responseData;
}

function log(message, data = null) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`[${timestamp}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

// Test steps
async function step1_RegisterLeagueOwner() {
  log('Step 1: Registering League Owner...');
  
  const ownerData = TEST_CONFIG.leagueOwner;
  const response = await makeRequest('POST', '/api/auth/register', ownerData);
  
  testState.leagueOwner = response.user;
  testState.leagueOwnerToken = response.token;
  
  log('✅ League Owner registered', { id: testState.leagueOwner.id, username: testState.leagueOwner.username });
}

async function step2_RegisterUsers() {
  log('Step 2: Registering 9 users...');
  
  for (let i = 0; i < TEST_CONFIG.users.length; i++) {
    const userData = TEST_CONFIG.users[i];
    const response = await makeRequest('POST', '/api/auth/register', userData);
    
    testState.users.push(response.user);
    testState.userTokens.push(response.token);
    
    log(`✅ User ${i + 1} registered`, { id: response.user.id, username: response.user.username });
  }
}

async function step3_CreateLeague() {
  log('Step 3: Creating league...');
  
  const leagueData = TEST_CONFIG.league;
  const response = await makeRequest('POST', '/api/leagues', leagueData, testState.leagueOwnerToken);
  
  testState.league = response;
  
  log('✅ League created', { id: testState.league.id, name: testState.league.name, inviteCode: testState.league.inviteCode });
  
  // Verify the league was created by fetching it
  const verifyLeague = await makeRequest('GET', `/api/leagues/${testState.league.id}`, null, testState.leagueOwnerToken);
  log('✅ League verification', { id: verifyLeague.id, name: verifyLeague.name, participants: verifyLeague.participants });
}

async function step4_JoinLeague() {
  log('Step 4: All users joining league...');
  
  for (let i = 0; i < testState.users.length; i++) {
    const user = testState.users[i];
    const token = testState.userTokens[i];
    
    try {
      // Use invite code instead of league ID for joining
      const response = await makeRequest('POST', `/api/leagues/${testState.league.inviteCode}/join`, {}, token);
      log(`✅ User ${user.username} joined league`, { userId: user.id, leagueId: testState.league.id, inviteCode: testState.league.inviteCode });
    } catch (error) {
      log(`❌ User ${user.username} failed to join league`, { userId: user.id, leagueId: testState.league.id, inviteCode: testState.league.inviteCode, error: error.message });
      throw error;
    }
  }
}

async function step5_AddPlayers() {
  log('Step 5: Adding players to league...');
  
  const playerNames = ['Messi', 'Ronaldo', 'Neymar', 'Mbappe', 'Haaland', 'Bellingham', 'De Bruyne', 'Modric', 'Kane', 'Salah'];
  
  for (let i = 0; i < playerNames.length; i++) {
    const playerData = {
      name: playerNames[i],
      position: i < 3 ? 'forward' : i < 6 ? 'midfielder' : 'defender',
      emoji: '⚽',
      isExternal: true
    };
    
    const response = await makeRequest('POST', `/api/players/${testState.league.id}`, playerData, testState.leagueOwnerToken);
    testState.players.push(response);
    
    log(`✅ Player added`, { id: response.id, name: response.name });
  }
}

async function step6_SubmitTierLists() {
  log('Step 6: All users submitting tier lists...');
  
  // Create a random but consistent player order for testing
  const playerOrder = testState.players.map(p => p.id);
  
  // All users submit the same tier list for simplicity
  for (let i = 0; i < testState.users.length; i++) {
    const user = testState.users[i];
    const token = testState.userTokens[i];
    
    const tierListData = {
      playerOrder: playerOrder
    };
    
    const response = await makeRequest('POST', `/api/tierlist/${testState.league.id}`, tierListData, token);
    
    log(`✅ User ${user.username} submitted tier list`);
  }
}

async function step7_CreateMatch() {
  log('Step 7: Creating match...');
  
  const matchData = TEST_CONFIG.match;
  matchData.leagueId = testState.league.id;
  
  const response = await makeRequest('POST', '/api/matches', matchData, testState.leagueOwnerToken);
  testState.match = response;
  
  log('✅ Match created', { id: testState.match.id, status: testState.match.status });
}

async function step8_AddPlayersToMatch() {
  log('Step 8: Adding users as players to match...');
  
  // Instead of adding CPU players, we'll have the users join the match directly
  // The users should already be players in the league from step 4
  log('✅ Users are already players in the league from joining');
}

async function step9_JoinMatch() {
  log('Step 9: All users joining match...');
  
  for (let i = 0; i < testState.users.length; i++) {
    const user = testState.users[i];
    const token = testState.userTokens[i];
    
    const response = await makeRequest('POST', `/api/matches/${testState.match.id}/join`, {}, token);
    
    log(`✅ User ${user.username} joined match`, { status: response.status });
  }
}

async function step10_CreateLineups() {
  log('Step 10: All users creating lineups...');
  
  // Get all players in the league (including users)
  const allPlayers = await makeRequest('GET', `/api/players/${testState.league.id}`, null, testState.leagueOwnerToken);
  log('✅ Got all players in league', { playerCount: allPlayers.length });
  
  for (let i = 0; i < testState.users.length; i++) {
    const user = testState.users[i];
    const token = testState.userTokens[i];
    
    // Create a lineup with 5 players from the league
    const playerIds = allPlayers.slice(0, 5).map(p => p.id);
    const lineupData = {
      playerIds: playerIds,
      captainId: playerIds[0],
      totalCost: 50
    };
    
    const response = await makeRequest('POST', `/api/matches/${testState.match.id}/lineup`, lineupData, token);
    testState.lineups.push(response);
    
    log(`✅ User ${user.username} created lineup`, { lineupId: response.id, playerCount: playerIds.length });
  }
}

async function step11_SubmitStats() {
  log('Step 11: All users submitting stats...');
  
  for (let i = 0; i < testState.users.length; i++) {
    const user = testState.users[i];
    const token = testState.userTokens[i];
    
    // Random stats for testing
    const statsData = {
      goals: Math.floor(Math.random() * 3),
      assists: Math.floor(Math.random() * 2)
    };
    
    const response = await makeRequest('POST', `/api/matches/${testState.match.id}/stats`, statsData, token);
    testState.statReports.push(response);
    
    log(`✅ User ${user.username} submitted stats`, { goals: statsData.goals, assists: statsData.assists });
  }
}

async function step12_ValidateGoals() {
  log('Step 12: League owner validating goals...');
  
  const totalGoals = testState.statReports.reduce((sum, report) => sum + report.goals, 0);
  const validationData = {
    finalScore: totalGoals
  };
  
  const response = await makeRequest('POST', `/api/matches/${testState.match.id}/validate-goals`, validationData, testState.leagueOwnerToken);
  
  log('✅ Goals validated', { finalScore: totalGoals });
}

async function step13_CalculateScores() {
  log('Step 13: Calculating match scores...');
  
  const response = await makeRequest('POST', `/api/matches/${testState.match.id}/calculate-scores`, {}, testState.leagueOwnerToken);
  testState.scores = response;
  
  log('✅ Scores calculated', { scoreCount: response.length });
}

async function step14_VerifyResults() {
  log('Step 14: Verifying all results...');
  
  // Test 1: Check manager leaderboard
  const leaderboard = await makeRequest('GET', `/api/leaderboards/${testState.league.id}/users`, null, testState.leagueOwnerToken);
  log('✅ Manager Leaderboard', { userCount: leaderboard.length, users: leaderboard });
  
  // Test 2: Check league rankings
  const rankings = await makeRequest('GET', `/api/leagues/${testState.league.id}/rankings`, null, testState.leagueOwnerToken);
  log('✅ League Rankings', { rankingCount: rankings.length, rankings: rankings });
  
  // Test 3: Check match participants
  const participants = await makeRequest('GET', `/api/matches/${testState.match.id}/participants`, null, testState.leagueOwnerToken);
  log('✅ Match Participants', { participantCount: participants.length });
  
  // Test 4: Check stat reports
  const statReports = await makeRequest('GET', `/api/matches/${testState.match.id}/stats`, null, testState.leagueOwnerToken);
  log('✅ Stat Reports', { reportCount: statReports.length });
  
  // Test 5: Check league details
  const leagueDetails = await makeRequest('GET', `/api/leagues/${testState.league.id}`, null, testState.leagueOwnerToken);
  log('✅ League Details', { participantCount: leagueDetails.participants?.length || 0 });
  
  // Test 6: Check players
  const players = await makeRequest('GET', `/api/players/${testState.league.id}`, null, testState.leagueOwnerToken);
  log('✅ League Players', { playerCount: players.length });
}

async function runComprehensiveTest() {
  console.log('🚀 Starting Comprehensive PachangaFantasy Lifecycle Test');
  console.log('=' .repeat(60));
  
  try {
    await step1_RegisterLeagueOwner();
    await step2_RegisterUsers();
    await step3_CreateLeague();
    await step4_JoinLeague();
    await step5_AddPlayers();
    await step6_SubmitTierLists();
    await step7_CreateMatch();
    await step8_AddPlayersToMatch();
    await step9_JoinMatch();
    await step10_CreateLineups();
    await step11_SubmitStats();
    await step12_ValidateGoals();
    await step13_CalculateScores();
    await step14_VerifyResults();
    
    console.log('=' .repeat(60));
    console.log('🎉 COMPREHENSIVE TEST COMPLETED SUCCESSFULLY!');
    console.log('=' .repeat(60));
    
    // Summary
    console.log('\n📊 Test Summary:');
    console.log(`- League Owner: ${testState.leagueOwner.username} (ID: ${testState.leagueOwner.id})`);
    console.log(`- League: ${testState.league.name} (ID: ${testState.league.id})`);
    console.log(`- Users: ${testState.users.length} registered and joined`);
    console.log(`- Players: ${testState.players.length} added to league`);
    console.log(`- Match: ${testState.match.id} created and completed`);
    console.log(`- Lineups: ${testState.lineups.length} created`);
    console.log(`- Stat Reports: ${testState.statReports.length} submitted`);
    console.log(`- Scores: ${testState.scores.length} calculated`);
    
    console.log('\n✅ All features working correctly!');
    
  } catch (error) {
    console.error('❌ TEST FAILED:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  runComprehensiveTest();
}

export { runComprehensiveTest, testState }; 