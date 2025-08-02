#!/bin/bash

# DataTab Clone - Comprehensive Integration Test Suite
# This script runs all integration tests to validate the complete system

set -e

echo "🚀 Starting DataTab Clone Integration Test Suite"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run a test and track results
run_test() {
    local test_name="$1"
    local test_command="$2"
    local test_dir="$3"
    
    echo -e "\n${BLUE}Running: $test_name${NC}"
    echo "----------------------------------------"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ -n "$test_dir" ]; then
        cd "$test_dir"
    fi
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ PASSED: $test_name${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAILED: $test_name${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    if [ -n "$test_dir" ]; then
        cd - > /dev/null
    fi
}

# Function to check if services are running
check_services() {
    echo -e "\n${YELLOW}Checking required services...${NC}"
    
    # Check if PostgreSQL is running
    if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
        echo -e "${RED}❌ PostgreSQL is not running. Please start PostgreSQL service.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ PostgreSQL is running${NC}"
    
    # Check if Redis is running
    if ! redis-cli ping > /dev/null 2>&1; then
        echo -e "${RED}❌ Redis is not running. Please start Redis service.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Redis is running${NC}"
}

# Function to setup test environment
setup_test_env() {
    echo -e "\n${YELLOW}Setting up test environment...${NC}"
    
    # Set test environment variables
    export NODE_ENV=test
    export DATABASE_URL="postgresql://test_user:test_password@localhost:5432/datatab_test"
    export REDIS_URL="redis://localhost:6379/1"
    export JWT_SECRET="test_jwt_secret_key_for_integration_tests"
    
    # Create test database if it doesn't exist
    createdb datatab_test 2>/dev/null || true
    
    echo -e "${GREEN}✅ Test environment configured${NC}"
}

# Function to cleanup test environment
cleanup_test_env() {
    echo -e "\n${YELLOW}Cleaning up test environment...${NC}"
    
    # Drop test database
    dropdb datatab_test 2>/dev/null || true
    
    # Clear Redis test database
    redis-cli -n 1 FLUSHDB > /dev/null 2>&1 || true
    
    echo -e "${GREEN}✅ Test environment cleaned up${NC}"
}

# Function to install dependencies if needed
install_dependencies() {
    echo -e "\n${YELLOW}Checking dependencies...${NC}"
    
    # Backend dependencies
    if [ ! -d "backend/node_modules" ]; then
        echo "Installing backend dependencies..."
        cd backend && npm install && cd ..
    fi
    
    # Frontend dependencies
    if [ ! -d "frontend/node_modules" ]; then
        echo "Installing frontend dependencies..."
        cd frontend && npm install && cd ..
    fi
    
    echo -e "${GREEN}✅ Dependencies ready${NC}"
}

# Function to create test data files
create_test_data() {
    echo -e "\n${YELLOW}Creating test data files...${NC}"
    
    mkdir -p test-data
    
    # Create sample CSV data
    cat > test-data/sample_data.csv << EOF
id,name,age,score,category
1,Alice,25,85,A
2,Bob,30,92,B
3,Charlie,35,78,C
4,Diana,28,95,A
5,Eve,32,88,B
6,Frank,27,82,C
7,Grace,29,91,A
8,Henry,33,79,B
9,Ivy,26,87,C
10,Jack,31,93,A
EOF

    # Create large dataset for performance testing
    echo "id,value1,value2,value3,category" > test-data/large_dataset.csv
    for i in {1..10000}; do
        echo "$i,$((RANDOM % 100)).$((RANDOM % 100)),$((RANDOM % 50)).$((RANDOM % 100)),$((RANDOM % 200)).$((RANDOM % 100)),$(echo "A B C" | cut -d' ' -f$((RANDOM % 3 + 1)))" >> test-data/large_dataset.csv
    done
    
    # Create invalid file for error testing
    echo "This is not a valid CSV file" > test-data/invalid_file.txt
    
    echo -e "${GREEN}✅ Test data files created${NC}"
}

# Main test execution
main() {
    echo -e "${BLUE}DataTab Clone - Integration Test Suite${NC}"
    echo -e "${BLUE}=====================================${NC}"
    
    # Pre-test setup
    check_services
    install_dependencies
    setup_test_env
    create_test_data
    
    echo -e "\n${YELLOW}Starting test execution...${NC}"
    
    # Backend Unit Tests
    run_test "Backend Unit Tests" "npm test -- --run" "backend"
    
    # Backend Integration Tests
    run_test "Backend Integration Tests" "npm run test:integration -- --run" "backend"
    
    # Statistical Validation Tests
    run_test "Statistical Accuracy Validation" "npm run test:stats -- --run" "backend"
    
    # Load Testing
    run_test "Load and Performance Tests" "npm run test:load -- --run" "backend"
    
    # Security Tests
    run_test "Security and Penetration Tests" "npm run test:security -- --run" "backend"
    
    # Frontend Unit Tests
    run_test "Frontend Unit Tests" "npm test -- --run" "frontend"
    
    # Frontend Integration Tests
    run_test "Frontend Integration Tests" "npm run test:integration -- --run" "frontend"
    
    # Accessibility Tests
    run_test "Accessibility Compliance Tests" "npm run test:a11y -- --run" "frontend"
    
    # Visual Regression Tests
    run_test "Visual Regression Tests" "npm run test:visual -- --run" "frontend"
    
    # End-to-End Tests
    run_test "End-to-End Workflow Tests" "npm run test:e2e -- --run" "frontend"
    
    # Cross-browser Tests (if Playwright is configured)
    if command -v playwright &> /dev/null; then
        run_test "Cross-browser Compatibility Tests" "npx playwright test --project=chromium,firefox,webkit" "frontend"
    fi
    
    # API Documentation Tests
    run_test "API Documentation Validation" "npm run test:api-docs -- --run" "backend"
    
    # Database Migration Tests
    run_test "Database Migration Tests" "npm run test:migrations -- --run" "backend"
    
    # Post-test cleanup
    cleanup_test_env
    
    # Test Results Summary
    echo -e "\n${BLUE}Test Results Summary${NC}"
    echo -e "${BLUE}===================${NC}"
    echo -e "Total Tests: $TOTAL_TESTS"
    echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
    echo -e "${RED}Failed: $FAILED_TESTS${NC}"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "\n${GREEN}🎉 All tests passed! System integration is successful.${NC}"
        exit 0
    else
        echo -e "\n${RED}❌ Some tests failed. Please review the output above.${NC}"
        exit 1
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --help, -h          Show this help message"
    echo "  --skip-setup        Skip environment setup"
    echo "  --skip-cleanup      Skip cleanup after tests"
    echo "  --verbose, -v       Enable verbose output"
    echo "  --test-type TYPE    Run specific test type (unit|integration|e2e|all)"
    echo ""
    echo "Test Types:"
    echo "  unit                Run only unit tests"
    echo "  integration         Run only integration tests"
    echo "  e2e                 Run only end-to-end tests"
    echo "  all                 Run all tests (default)"
    echo ""
    echo "Examples:"
    echo "  $0                  Run all tests"
    echo "  $0 --test-type unit Run only unit tests"
    echo "  $0 -v               Run with verbose output"
}

# Parse command line arguments
SKIP_SETUP=false
SKIP_CLEANUP=false
VERBOSE=false
TEST_TYPE="all"

while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            show_usage
            exit 0
            ;;
        --skip-setup)
            SKIP_SETUP=true
            shift
            ;;
        --skip-cleanup)
            SKIP_CLEANUP=true
            shift
            ;;
        --verbose|-v)
            VERBOSE=true
            set -x
            shift
            ;;
        --test-type)
            TEST_TYPE="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate test type
case $TEST_TYPE in
    unit|integration|e2e|all)
        ;;
    *)
        echo "Invalid test type: $TEST_TYPE"
        show_usage
        exit 1
        ;;
esac

# Run main function
main