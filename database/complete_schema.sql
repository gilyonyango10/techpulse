-- TextPulse Complete Database Schema
-- This file contains all tables needed for the messaging system

-- Create database (run this separately)
-- CREATE DATABASE textpulse_db;

-- Users table with verification support
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OTP Verifications table for secure authentication
CREATE TABLE IF NOT EXISTS otp_verifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    purpose VARCHAR(50) NOT NULL, -- 'registration', 'password_reset', 'login'
    is_verified BOOLEAN DEFAULT FALSE,
    attempts INTEGER DEFAULT 0,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages table for bulk SMS tracking
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    message_content TEXT NOT NULL CHECK (LENGTH(message_content) <= 160),
    total_recipients INTEGER NOT NULL DEFAULT 0,
    successful_sends INTEGER NOT NULL DEFAULT 0,
    failed_sends INTEGER NOT NULL DEFAULT 0,
    delivery_rate DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE 
            WHEN total_recipients > 0 
            THEN (successful_sends::DECIMAL / total_recipients::DECIMAL) * 100
            ELSE 0
        END
    ) STORED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recipients table for individual SMS tracking
CREATE TABLE IF NOT EXISTS recipients (
    id SERIAL PRIMARY KEY,
    message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    delivery_status VARCHAR(20) DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed', 'delivered')),
    external_id VARCHAR(255), -- Provider's message ID
    cost DECIMAL(10,4), -- SMS cost from provider
    error_message TEXT,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Message Templates for reusable content
CREATE TABLE IF NOT EXISTS message_templates (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    template_name VARCHAR(100) NOT NULL,
    template_content TEXT NOT NULL CHECK (LENGTH(template_content) <= 160),
    is_active BOOLEAN DEFAULT TRUE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contact Groups for organized bulk messaging
CREATE TABLE IF NOT EXISTS contact_groups (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    group_name VARCHAR(100) NOT NULL,
    description TEXT,
    contact_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contacts for organized recipient management
CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES contact_groups(id) ON DELETE SET NULL,
    full_name VARCHAR(255),
    phone_number VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Message Scheduling for future SMS delivery
CREATE TABLE IF NOT EXISTS scheduled_messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    message_content TEXT NOT NULL CHECK (LENGTH(message_content) <= 160),
    recipients TEXT[] NOT NULL, -- Array of phone numbers
    scheduled_for TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'failed', 'cancelled')),
    message_id INTEGER REFERENCES messages(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User API Keys for programmatic access
CREATE TABLE IF NOT EXISTS user_api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    api_key VARCHAR(64) UNIQUE NOT NULL,
    key_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SMS Analytics for reporting
CREATE TABLE IF NOT EXISTS sms_analytics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    messages_sent INTEGER DEFAULT 0,
    recipients_total INTEGER DEFAULT 0,
    delivery_rate DECIMAL(5,2) DEFAULT 0,
    total_cost DECIMAL(10,4) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_verified ON users(is_verified, phone_verified);

CREATE INDEX IF NOT EXISTS idx_otp_phone_purpose ON otp_verifications(phone_number, purpose);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_verifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_user_id ON otp_verifications(user_id);

CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_recipients_message_id ON recipients(message_id);
CREATE INDEX IF NOT EXISTS idx_recipients_phone ON recipients(phone_number);
CREATE INDEX IF NOT EXISTS idx_recipients_status ON recipients(delivery_status);

CREATE INDEX IF NOT EXISTS idx_contacts_user_group ON contacts(user_id, group_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone_number);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_user ON scheduled_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_time ON scheduled_messages(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status ON scheduled_messages(status);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON user_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key ON user_api_keys(api_key);

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update contact group count
CREATE OR REPLACE FUNCTION update_contact_group_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE contact_groups 
        SET contact_count = (
            SELECT COUNT(*) FROM contacts 
            WHERE group_id = NEW.group_id AND is_active = TRUE
        )
        WHERE id = NEW.group_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE contact_groups 
        SET contact_count = (
            SELECT COUNT(*) FROM contacts 
            WHERE group_id = OLD.group_id AND is_active = TRUE
        )
        WHERE id = OLD.group_id;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Update both old and new groups if group changed
        IF OLD.group_id IS DISTINCT FROM NEW.group_id THEN
            IF OLD.group_id IS NOT NULL THEN
                UPDATE contact_groups 
                SET contact_count = (
                    SELECT COUNT(*) FROM contacts 
                    WHERE group_id = OLD.group_id AND is_active = TRUE
                )
                WHERE id = OLD.group_id;
            END IF;
            IF NEW.group_id IS NOT NULL THEN
                UPDATE contact_groups 
                SET contact_count = (
                    SELECT COUNT(*) FROM contacts 
                    WHERE group_id = NEW.group_id AND is_active = TRUE
                )
                WHERE id = NEW.group_id;
            END IF;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Triggers for automatic updates
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON message_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON contact_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contact_count_trigger
    AFTER INSERT OR UPDATE OR DELETE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_contact_group_count();

-- Initial admin user (optional - remove in production)
-- INSERT INTO users (full_name, email, phone_number, password_hash, is_verified, phone_verified)
-- VALUES ('Admin User', 'admin@textpulse.com', '+1234567890', '$2b$12$hash_here', TRUE, TRUE);

-- Sample message templates
INSERT INTO message_templates (user_id, template_name, template_content) VALUES
(1, 'Welcome Message', 'Welcome to our service! Thank you for signing up.'),
(1, 'Reminder', 'This is a friendly reminder about your upcoming appointment.'),
(1, 'Promotion', 'Special offer! Get 20% off your next purchase. Use code SAVE20.')
ON CONFLICT DO NOTHING;