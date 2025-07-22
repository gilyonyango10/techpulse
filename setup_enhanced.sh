#!/bin/bash

# TextPulse Enhanced Setup Script
# This script sets up the complete messaging system with all features

echo "🚀 TextPulse Enhanced Messaging System Setup"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[ℹ]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js (v16 or higher) first."
    exit 1
fi

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    print_error "PostgreSQL is not installed. Please install PostgreSQL (v12 or higher) first."
    exit 1
fi

print_status "Node.js and PostgreSQL found"

# Install backend dependencies
print_info "Installing backend dependencies..."
npm install

if [ $? -eq 0 ]; then
    print_status "Backend dependencies installed successfully"
else
    print_error "Failed to install backend dependencies"
    exit 1
fi

# Install frontend dependencies
print_info "Installing frontend dependencies..."
cd client
npm install
cd ..

if [ $? -eq 0 ]; then
    print_status "Frontend dependencies installed successfully"
else
    print_error "Failed to install frontend dependencies"
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    print_info "Creating .env file from template..."
    cp .env.example .env
    print_status ".env file created"
    print_warning "Please edit .env file with your configuration before running the application"
else
    print_info ".env file already exists"
fi

# Database setup
echo ""
print_info "Database Setup"
echo "=============="

read -p "Do you want to set up the database now? (y/n): " setup_db

if [ "$setup_db" = "y" ] || [ "$setup_db" = "Y" ]; then
    echo ""
    print_info "Please provide database connection details:"
    
    read -p "Database host (default: localhost): " db_host
    db_host=${db_host:-localhost}
    
    read -p "Database port (default: 5432): " db_port
    db_port=${db_port:-5432}
    
    read -p "Database name (default: textpulse_db): " db_name
    db_name=${db_name:-textpulse_db}
    
    read -p "Database username: " db_user
    
    echo ""
    print_info "Creating database..."
    
    # Create database
    createdb -h $db_host -p $db_port -U $db_user $db_name 2>/dev/null
    
    if [ $? -eq 0 ]; then
        print_status "Database '$db_name' created successfully"
    else
        print_warning "Database might already exist or creation failed"
    fi
    
    # Run schema
    print_info "Setting up database schema..."
    psql -h $db_host -p $db_port -U $db_user -d $db_name -f database/complete_schema.sql
    
    if [ $? -eq 0 ]; then
        print_status "Database schema set up successfully"
    else
        print_error "Failed to set up database schema"
        exit 1
    fi
    
    # Update .env file with database details
    print_info "Updating .env file with database configuration..."
    
    # Update database configuration in .env
    sed -i.bak "s/DB_HOST=.*/DB_HOST=$db_host/" .env
    sed -i.bak "s/DB_PORT=.*/DB_PORT=$db_port/" .env
    sed -i.bak "s/DB_NAME=.*/DB_NAME=$db_name/" .env
    sed -i.bak "s/DB_USER=.*/DB_USER=$db_user/" .env
    
    print_status "Database configuration updated in .env file"
    
else
    print_info "Skipping database setup. You can run it manually later using:"
    print_info "  createdb textpulse_db"
    print_info "  psql -d textpulse_db -f database/complete_schema.sql"
fi

# SMS Provider setup
echo ""
print_info "SMS Provider Setup"
echo "=================="

echo "Choose your SMS provider:"
echo "1) Mock (for development/testing)"
echo "2) Africa's Talking"
echo "3) Twilio"
echo "4) Skip SMS setup"

read -p "Enter your choice (1-4): " sms_choice

case $sms_choice in
    1)
        sed -i.bak "s/SMS_PROVIDER=.*/SMS_PROVIDER=mock/" .env
        print_status "Mock SMS provider configured for development"
        ;;
    2)
        sed -i.bak "s/SMS_PROVIDER=.*/SMS_PROVIDER=africastalking/" .env
        print_info "Africa's Talking selected"
        print_warning "Please update AFRICASTALKING_USERNAME and AFRICASTALKING_API_KEY in .env file"
        ;;
    3)
        sed -i.bak "s/SMS_PROVIDER=.*/SMS_PROVIDER=twilio/" .env
        print_info "Twilio selected"
        print_warning "Please update TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in .env file"
        ;;
    4)
        print_info "SMS setup skipped"
        ;;
    *)
        print_warning "Invalid choice. Defaulting to mock provider"
        sed -i.bak "s/SMS_PROVIDER=.*/SMS_PROVIDER=mock/" .env
        ;;
esac

# JWT Secret generation
print_info "Generating JWT secret..."
jwt_secret=$(openssl rand -base64 64 | tr -d '\n')
sed -i.bak "s/JWT_SECRET=.*/JWT_SECRET=$jwt_secret/" .env
print_status "JWT secret generated and configured"

# Create necessary directories
print_info "Creating necessary directories..."
mkdir -p uploads
mkdir -p logs
print_status "Directories created"

# Set permissions
chmod +x setup_enhanced.sh
chmod 755 uploads

echo ""
print_status "Setup completed successfully!"
echo ""

print_info "Next Steps:"
echo "==========="
echo "1. Review and update your .env file with proper configuration"
echo "2. If you set up SMS provider, add your API credentials"
echo "3. Start the application:"
echo "   • Backend: npm run dev"
echo "   • Frontend: cd client && npm start"
echo ""

print_info "API Endpoints:"
echo "=============="
echo "• Authentication: http://localhost:5000/api/auth"
echo "• SMS Management: http://localhost:5000/api/sms"
echo "• Contact Management: http://localhost:5000/api/contacts"
echo "• Templates: http://localhost:5000/api/templates"
echo "• Analytics: http://localhost:5000/api/analytics"
echo "• Health Check: http://localhost:5000/api/health"
echo ""

print_info "Frontend URL: http://localhost:3000"
echo ""

print_info "Documentation:"
echo "=============="
echo "• Enhanced README: README_ENHANCED.md"
echo "• Database Schema: database/complete_schema.sql"
echo "• API Documentation: Available in README_ENHANCED.md"
echo ""

print_status "Your TextPulse messaging system is ready!"
print_info "Run 'npm run dev' to start the backend server"