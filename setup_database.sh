#!/bin/bash

echo "Setting up TextPulse Database..."

# Create database and user
sudo -u postgres psql << EOF
-- Create database
CREATE DATABASE textpulse_db;

-- Create user (optional, you can use postgres user)
CREATE USER textpulse_user WITH PASSWORD 'textpulse_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE textpulse_db TO textpulse_user;

-- Exit
\q
EOF

echo "Database created successfully!"
echo "Now running schema setup..."

# Run the schema file
sudo -u postgres psql -d textpulse_db -f database/schema.sql

echo "Database setup complete!"
echo ""
echo "Database Details:"
echo "- Database Name: textpulse_db"
echo "- Username: textpulse_user"
echo "- Password: textpulse_password"
echo ""
echo "Update your .env file with these credentials."
