#!/bin/bash

# Comprehensive PachangaFantasy Test Runner
# This script runs the complete lifecycle test with one click

set -e  # Exit on any error

echo "🚀 PachangaFantasy Comprehensive Test Runner"
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Check if server is running
print_status $BLUE "Checking if server is running..."
if ! curl -s http://localhost:5000/api/leagues > /dev/null 2>&1; then
    print_status $RED "❌ Server is not running on localhost:5000"
    print_status $YELLOW "Please start the server with: npm start"
    exit 1
fi
print_status $GREEN "✅ Server is running"

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    print_status $RED "❌ Node.js is not installed"
    exit 1
fi

# Check if the test script exists
if [ ! -f "comprehensive-lifecycle-test.js" ]; then
    print_status $RED "❌ Test script not found: comprehensive-lifecycle-test.js"
    exit 1
fi

print_status $BLUE "Starting comprehensive test..."
echo ""

# Run the test
node comprehensive-lifecycle-test.js

# Check exit status
if [ $? -eq 0 ]; then
    echo ""
    print_status $GREEN "🎉 All tests passed successfully!"
    print_status $GREEN "✅ Complete user lifecycle verified"
    print_status $GREEN "✅ All features working correctly"
else
    echo ""
    print_status $RED "❌ Tests failed"
    exit 1
fi 