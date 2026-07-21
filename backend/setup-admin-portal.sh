#!/bin/bash

# Admin Portal Setup Script
# This script sets up the admin portal with encryption keys and runs database migrations

set -e  # Exit on error

echo "================================================"
echo "SC Fleet Manager - Admin Portal Setup"
echo "================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the backend directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: This script must be run from the backend directory${NC}"
    echo "Usage: cd backend && ./setup-admin-portal.sh"
    exit 1
fi

echo -e "${YELLOW}Step 1: Checking for .env file...${NC}"
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Creating .env file from .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ .env file created${NC}"
else
    echo -e "${GREEN}✓ .env file exists${NC}"
fi
echo ""

echo -e "${YELLOW}Step 2: Generating encryption keys...${NC}"
ADMIN_ENCRYPTION_KEY=$(openssl rand -hex 32)
ADMIN_ENCRYPTION_IV=$(openssl rand -hex 16)

echo -e "${GREEN}✓ Generated ADMIN_ENCRYPTION_KEY: ${ADMIN_ENCRYPTION_KEY}${NC}"
echo -e "${GREEN}✓ Generated ADMIN_ENCRYPTION_IV: ${ADMIN_ENCRYPTION_IV}${NC}"
echo ""

echo -e "${YELLOW}Step 3: Adding encryption keys to .env file...${NC}"

# Check if keys already exist in .env
if grep -q "ADMIN_ENCRYPTION_KEY=" .env; then
    echo -e "${YELLOW}! ADMIN_ENCRYPTION_KEY already exists in .env, updating...${NC}"
    sed -i "s/ADMIN_ENCRYPTION_KEY=.*/ADMIN_ENCRYPTION_KEY=${ADMIN_ENCRYPTION_KEY}/" .env
else
    echo "" >> .env
    echo "# Admin Portal Encryption Configuration" >> .env
    echo "ADMIN_ENCRYPTION_KEY=${ADMIN_ENCRYPTION_KEY}" >> .env
fi

if grep -q "ADMIN_ENCRYPTION_IV=" .env; then
    echo -e "${YELLOW}! ADMIN_ENCRYPTION_IV already exists in .env, updating...${NC}"
    sed -i "s/ADMIN_ENCRYPTION_IV=.*/ADMIN_ENCRYPTION_IV=${ADMIN_ENCRYPTION_IV}/" .env
else
    echo "ADMIN_ENCRYPTION_IV=${ADMIN_ENCRYPTION_IV}" >> .env
fi

echo -e "${GREEN}✓ Encryption keys added to .env${NC}"
echo ""

echo -e "${YELLOW}Step 4: Running database migrations...${NC}"
if npm run migration:run; then
    echo -e "${GREEN}✓ Database migrations completed successfully${NC}"
else
    echo -e "${RED}✗ Database migration failed${NC}"
    echo -e "${YELLOW}This might be because migrations already ran or database is not connected${NC}"
    echo -e "${YELLOW}You can check migration status with: npm run migration:show${NC}"
fi
echo ""

echo -e "${YELLOW}Step 5: Checking for admin users...${NC}"
echo -e "${YELLOW}Note: You need at least one user with role='admin' to access the portal${NC}"
echo ""
echo "To create an admin user, run one of these SQL commands:"
echo ""
echo -e "${GREEN}Option 1: Update existing user${NC}"
echo "  UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';"
echo ""
echo -e "${GREEN}Option 2: Check current admin users${NC}"
echo "  SELECT id, email, username, role FROM users WHERE role = 'admin';"
echo ""

echo "================================================"
echo -e "${GREEN}✓ Admin Portal Setup Complete!${NC}"
echo "================================================"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1. Create an admin user (see SQL commands above)"
echo "2. Start the backend: npm start"
echo "3. Start the frontend: cd ../frontend && npm start"
echo "4. Access admin portal: http://localhost:3000/admin"
echo ""
echo -e "${YELLOW}Documentation:${NC}"
echo "- Quick Start: docs/ADMIN_PORTAL_QUICKSTART.md"
echo "- User Guide: docs/ADMIN_PORTAL_GUIDE.md"
echo "- Technical Details: docs/ADMIN_PORTAL_IMPLEMENTATION_SUMMARY.md"
echo ""
echo -e "${GREEN}Happy administrating! 🎉${NC}"
