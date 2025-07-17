#!/bin/bash

# Manual API Testing Script for Pachanga Fantasy
echo "=== Pachanga Fantasy API Manual Tests ==="

BASE_URL="http://localhost:5000"

# Test Authentication
echo "1. Testing Authentication..."

# Login and get token
echo "  - Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"grostime@gmail.com","password":"rogelio01"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "  ❌ Login failed!"
  echo "  Response: $LOGIN_RESPONSE"
  exit 1
else
  echo "  ✅ Login successful"
fi

# Test protected endpoint
echo "  - Testing protected endpoint..."
ME_RESPONSE=$(curl -s -X GET "$BASE_URL/api/auth/me" \
  -H "Authorization: Bearer $TOKEN")

if echo $ME_RESPONSE | grep -q '"user"'; then
  echo "  ✅ Protected endpoint working"
else
  echo "  ❌ Protected endpoint failed"
  echo "  Response: $ME_RESPONSE"
fi

# Test Leagues
echo "2. Testing Leagues..."
LEAGUES_RESPONSE=$(curl -s -X GET "$BASE_URL/api/leagues" \
  -H "Authorization: Bearer $TOKEN")

if echo $LEAGUES_RESPONSE | grep -q '\['; then
  echo "  ✅ Get leagues working"
else
  echo "  ❌ Get leagues failed"
  echo "  Response: $LEAGUES_RESPONSE"
fi

# Test Tier List (the recently fixed endpoint)
echo "3. Testing Tier List Submission..."
TIERLIST_RESPONSE=$(curl -s -X POST "$BASE_URL/api/tierlist/3" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"playerOrder":[14],"submitted":true}')

if echo $TIERLIST_RESPONSE | grep -q '"playerOrder"'; then
  echo "  ✅ Tier list submission working"
else
  echo "  ❌ Tier list submission failed"
  echo "  Response: $TIERLIST_RESPONSE"
fi

# Test Players
echo "4. Testing Players..."
PLAYERS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/players/3" \
  -H "Authorization: Bearer $TOKEN")

if echo $PLAYERS_RESPONSE | grep -q '\['; then
  echo "  ✅ Get players working"
else
  echo "  ❌ Get players failed"
  echo "  Response: $PLAYERS_RESPONSE"
fi

echo "=== Manual API Tests Complete ==="