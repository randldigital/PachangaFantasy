#!/bin/bash

# PachangaFantasy Comprehensive QA Test Plan Execution
# This script systematically tests all user lifecycle scenarios

set -e

echo "🧪 Starting PachangaFantasy QA Test Execution"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0
SKIPPED=0

# Helper functions
log_test() {
    local test_name="$1"
    local status="$2"
    local message="$3"
    
    case $status in
        "PASS")
            echo -e "${GREEN}✅ PASS${NC}: $test_name - $message"
            ((PASSED++))
            ;;
        "FAIL")
            echo -e "${RED}❌ FAIL${NC}: $test_name - $message"
            ((FAILED++))
            ;;
        "SKIP")
            echo -e "${YELLOW}⏭️  SKIP${NC}: $test_name - $message"
            ((SKIPPED++))
            ;;
    esac
}

test_api_endpoint() {
    local endpoint="$1"
    local method="${2:-GET}"
    local data="${3:-}"
    local expected_status="${4:-200}"
    local test_name="$5"
    
    echo -e "\n${BLUE}Testing: $test_name${NC}"
    echo "Endpoint: $method $endpoint"
    
    if [ -n "$data" ]; then
        echo "Data: $data"
    fi
    
    # Make the API call
    if [ -n "$data" ]; then
        response=$(curl -s -w "%{http_code}" -X "$method" "http://localhost:5000$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null)
    else
        response=$(curl -s -w "%{http_code}" -X "$method" "http://localhost:5000$endpoint" \
            -H "Content-Type: application/json" 2>/dev/null)
    fi
    
    # Extract status code and body
    status_code="${response: -3}"
    body="${response%???}"
    
    echo "Response Status: $status_code"
    echo "Response Body: $body"
    
    if [ "$status_code" = "$expected_status" ]; then
        log_test "$test_name" "PASS" "Expected status $expected_status, got $status_code"
    else
        log_test "$test_name" "FAIL" "Expected status $expected_status, got $status_code"
    fi
}

# Check if server is running
echo -e "\n${BLUE}Checking server status...${NC}"
if curl -s http://localhost:5000/api/leagues >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Server is running${NC}"
else
    echo -e "${RED}❌ Server is not running. Please start the server first.${NC}"
    exit 1
fi

echo -e "\n${BLUE}Starting API Endpoint Tests${NC}"
echo "=================================="

# Test 1: Authentication Endpoints
echo -e "\n${YELLOW}1. Authentication Tests${NC}"

# Test registration with valid data
test_api_endpoint "/api/auth/register" "POST" '{"email":"test@example.com","username":"testuser","password":"password123"}' "200" "User Registration - Valid Data"

# Test registration with duplicate email
test_api_endpoint "/api/auth/register" "POST" '{"email":"test@example.com","username":"testuser2","password":"password123"}' "400" "User Registration - Duplicate Email"

# Test registration with invalid email
test_api_endpoint "/api/auth/register" "POST" '{"email":"invalid-email","username":"testuser3","password":"password123"}' "400" "User Registration - Invalid Email"

# Test login with valid credentials
test_api_endpoint "/api/auth/login" "POST" '{"email":"test@example.com","password":"password123"}' "200" "User Login - Valid Credentials"

# Test login with invalid credentials
test_api_endpoint "/api/auth/login" "POST" '{"email":"test@example.com","password":"wrongpassword"}' "401" "User Login - Invalid Credentials"

# Test 2: League Management Endpoints
echo -e "\n${YELLOW}2. League Management Tests${NC}"

# Test league creation with valid data
test_api_endpoint "/api/leagues" "POST" '{"name":"Test League","description":"A test league","inviteCode":"TEST123"}' "200" "League Creation - Valid Data"

# Test league creation with missing fields
test_api_endpoint "/api/leagues" "POST" '{"name":"Test League"}' "400" "League Creation - Missing Fields"

# Test getting leagues
test_api_endpoint "/api/leagues" "GET" "" "200" "Get All Leagues"

# Test 3: Match Management Endpoints
echo -e "\n${YELLOW}3. Match Management Tests${NC}"

# Test match creation with valid data
test_api_endpoint "/api/leagues/1/matches" "POST" '{"date":"2025-01-15","location":"Test Field","lineupBudget":100}' "200" "Match Creation - Valid Data"

# Test match creation with invalid date
test_api_endpoint "/api/leagues/1/matches" "POST" '{"date":"2020-01-15","location":"Test Field","lineupBudget":100}' "400" "Match Creation - Past Date"

# Test getting matches
test_api_endpoint "/api/leagues/1/matches" "GET" "" "200" "Get League Matches"

# Test 4: Lineup Management Endpoints
echo -e "\n${YELLOW}4. Lineup Management Tests${NC}"

# Test lineup creation with valid data
test_api_endpoint "/api/matches/1/lineup" "POST" '{"playerIds":[1,2,3,4,5],"captainId":1,"totalCost":50}' "200" "Lineup Creation - Valid Data"

# Test lineup creation over budget
test_api_endpoint "/api/matches/1/lineup" "POST" '{"playerIds":[1,2,3,4,5],"captainId":1,"totalCost":150}' "400" "Lineup Creation - Over Budget"

# Test lineup creation with insufficient players
test_api_endpoint "/api/matches/1/lineup" "POST" '{"playerIds":[1,2,3,4],"captainId":1,"totalCost":40}' "400" "Lineup Creation - Insufficient Players"

# Test getting lineup
test_api_endpoint "/api/matches/1/lineup" "GET" "" "200" "Get User Lineup"

# Test 5: Stat Submission Endpoints
echo -e "\n${YELLOW}5. Stat Submission Tests${NC}"

# Test stat submission with valid data
test_api_endpoint "/api/matches/1/stats" "POST" '{"goals":2,"assists":1}' "200" "Stat Submission - Valid Data"

# Test stat submission with negative goals
test_api_endpoint "/api/matches/1/stats" "POST" '{"goals":-1,"assists":1}' "400" "Stat Submission - Negative Goals"

# Test stat submission with invalid data
test_api_endpoint "/api/matches/1/stats" "POST" '{"goals":"abc","assists":1}' "400" "Stat Submission - Invalid Data Type"

# Test getting stats
test_api_endpoint "/api/matches/1/stats" "GET" "" "200" "Get Match Stats"

# Test 6: Leaderboard Endpoints
echo -e "\n${YELLOW}6. Leaderboard Tests${NC}"

# Test manager leaderboard
test_api_endpoint "/api/leaderboards/1/users" "GET" "" "200" "Manager Leaderboard"

# Test league rankings
test_api_endpoint "/api/leagues/1/rankings" "GET" "" "200" "League Rankings"

# Test 7: Edge Cases and Error Handling
echo -e "\n${YELLOW}7. Edge Cases and Error Handling${NC}"

# Test non-existent endpoints
test_api_endpoint "/api/nonexistent" "GET" "" "404" "Non-existent Endpoint"

# Test invalid JSON
test_api_endpoint "/api/auth/register" "POST" '{"invalid":json}' "400" "Invalid JSON"

# Test missing authentication
test_api_endpoint "/api/leagues/999" "GET" "" "403" "Unauthorized Access"

# Print test summary
echo -e "\n${BLUE}Test Execution Summary${NC}"
echo "========================"
echo -e "${GREEN}✅ Passed: $PASSED${NC}"
echo -e "${RED}❌ Failed: $FAILED${NC}"
echo -e "${YELLOW}⏭️  Skipped: $SKIPPED${NC}"
echo -e "Total: $((PASSED + FAILED + SKIPPED))"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}⚠️  Some tests failed. Please review the results above.${NC}"
    exit 1
fi 