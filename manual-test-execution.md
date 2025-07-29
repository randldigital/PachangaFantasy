# 🧪 Manual QA Test Execution Guide

## **Prerequisites**
1. Ensure server is running: `cd PachangaFantasy && npm start`
2. Server should be accessible at `http://localhost:5000`

## **Test Execution Steps**

### **Phase 1: Authentication Tests**

#### **1.1 User Registration Tests**
```bash
# Test 1: Valid Registration
curl -X POST "http://localhost:5000/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test1@example.com","username":"testuser1","password":"password123"}'

# Expected: 200 OK, user created

# Test 2: Duplicate Email Registration
curl -X POST "http://localhost:5000/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test1@example.com","username":"testuser2","password":"password123"}'

# Expected: 400 Bad Request, duplicate email error

# Test 3: Invalid Email Format
curl -X POST "http://localhost:5000/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid-email","username":"testuser3","password":"password123"}'

# Expected: 400 Bad Request, validation error
```

#### **1.2 User Login Tests**
```bash
# Test 1: Valid Login
curl -X POST "http://localhost:5000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test1@example.com","password":"password123"}'

# Expected: 200 OK, token returned

# Test 2: Invalid Password
curl -X POST "http://localhost:5000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test1@example.com","password":"wrongpassword"}'

# Expected: 401 Unauthorized, invalid credentials
```

### **Phase 2: League Management Tests**

#### **2.1 League Creation Tests**
```bash
# Test 1: Valid League Creation
curl -X POST "http://localhost:5000/api/leagues" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name":"Test League","description":"A test league","inviteCode":"TEST123"}'

# Expected: 200 OK, league created

# Test 2: Missing Required Fields
curl -X POST "http://localhost:5000/api/leagues" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name":"Test League"}'

# Expected: 400 Bad Request, validation error
```

#### **2.2 League Access Tests**
```bash
# Test 1: Get All Leagues
curl -X GET "http://localhost:5000/api/leagues" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: 200 OK, list of leagues

# Test 2: Get Specific League
curl -X GET "http://localhost:5000/api/leagues/1" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: 200 OK, league details
```

### **Phase 3: Match Management Tests**

#### **3.1 Match Creation Tests**
```bash
# Test 1: Valid Match Creation
curl -X POST "http://localhost:5000/api/leagues/1/matches" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"date":"2025-01-15","location":"Test Field","lineupBudget":100}'

# Expected: 200 OK, match created

# Test 2: Past Date Match
curl -X POST "http://localhost:5000/api/leagues/1/matches" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"date":"2020-01-15","location":"Test Field","lineupBudget":100}'

# Expected: 400 Bad Request, validation error
```

### **Phase 4: Lineup Management Tests**

#### **4.1 Lineup Creation Tests**
```bash
# Test 1: Valid Lineup
curl -X POST "http://localhost:5000/api/matches/1/lineup" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"playerIds":[1,2,3,4,5],"captainId":1,"totalCost":50}'

# Expected: 200 OK, lineup saved

# Test 2: Over Budget Lineup
curl -X POST "http://localhost:5000/api/matches/1/lineup" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"playerIds":[1,2,3,4,5],"captainId":1,"totalCost":150}'

# Expected: 400 Bad Request, budget exceeded

# Test 3: Insufficient Players
curl -X POST "http://localhost:5000/api/matches/1/lineup" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"playerIds":[1,2,3,4],"captainId":1,"totalCost":40}'

# Expected: 400 Bad Request, validation error
```

### **Phase 5: Stat Submission Tests**

#### **5.1 Stat Submission Tests**
```bash
# Test 1: Valid Stats
curl -X POST "http://localhost:5000/api/matches/1/stats" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"goals":2,"assists":1}'

# Expected: 200 OK, stats saved

# Test 2: Negative Goals
curl -X POST "http://localhost:5000/api/matches/1/stats" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"goals":-1,"assists":1}'

# Expected: 400 Bad Request, validation error

# Test 3: Invalid Data Type
curl -X POST "http://localhost:5000/api/matches/1/stats" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"goals":"abc","assists":1}'

# Expected: 400 Bad Request, validation error
```

### **Phase 6: Leaderboard Tests**

#### **6.1 Leaderboard Access Tests**
```bash
# Test 1: Manager Leaderboard
curl -X GET "http://localhost:5000/api/leaderboards/1/users" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: 200 OK, leaderboard data (should show User 2 with 0 points)

# Test 2: League Rankings
curl -X GET "http://localhost:5000/api/leagues/1/rankings" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: 200 OK, rankings data
```

### **Phase 7: Edge Cases and Error Handling**

#### **7.1 Error Handling Tests**
```bash
# Test 1: Non-existent Endpoint
curl -X GET "http://localhost:5000/api/nonexistent" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: 404 Not Found

# Test 2: Invalid JSON
curl -X POST "http://localhost:5000/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"invalid":json}'

# Expected: 400 Bad Request

# Test 3: Missing Authentication
curl -X GET "http://localhost:5000/api/leagues/999"

# Expected: 401 Unauthorized or 403 Forbidden
```

## **Test Results Documentation**

For each test, document:
1. **Test Name**: Brief description
2. **Request**: Method, URL, headers, body
3. **Expected Response**: Status code, response body
4. **Actual Response**: What was received
5. **Result**: PASS/FAIL
6. **Notes**: Any observations or issues

## **Critical Success Criteria**

✅ **Must Pass Tests:**
- User registration and login
- League creation and access
- Lineup creation with validation
- Stat submission with validation
- Leaderboard display (User 2 should appear with 0 points)
- Error handling for invalid inputs

❌ **Known Issues to Document:**
- Any validation gaps
- Missing error messages
- Performance issues
- Security vulnerabilities
- User experience friction points 