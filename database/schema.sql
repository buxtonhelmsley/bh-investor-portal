-- Buxton Helmsley Investor Portal Database Schema
-- PostgreSQL 14+
-- This schema implements full RBAC, audit logging, RSU tracking, and compliance features

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE user_role AS ENUM ('shareholder', 'board_member', 'admin_view', 'admin_edit');
CREATE TYPE shareholder_type AS ENUM ('individual', 'entity', 'trust', 'ira', 'other');
CREATE TYPE document_type AS ENUM ('financial_statement', 'quarterly_letter', 'board_minutes', 'material_disclosure', 'other');
CREATE TYPE document_access AS ENUM ('all_shareholders', 'board_and_management_only');
CREATE TYPE investment_status AS ENUM ('active', 'exited', 'cancelled');
CREATE TYPE rsu_status AS ENUM ('active', 'vested', 'cancelled', 'forfeited');
CREATE TYPE verification_method AS ENUM ('income', 'net_worth', 'professional_certification', 'broker_dealer', 'prior_investment', 'other');

-- ============================================================================
-- USERS & AUTHENTICATION
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    secondary_email VARCHAR(255),
    role user_role NOT NULL DEFAULT 'shareholder',
    is_active BOOLEAN DEFAULT TRUE,
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret TEXT,
    last_login TIMESTAMP WITH TIME ZONE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================================================
-- SHAREHOLDER INFORMATION
-- ============================================================================

CREATE TABLE shareholders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    legal_name VARCHAR(500) NOT NULL,
    shareholder_type shareholder_type NOT NULL,
    tax_id_encrypted TEXT, -- Encrypted with pgcrypto
    phone_number VARCHAR(50),
    mailing_address TEXT,
    is_erisa_subject BOOLEAN DEFAULT FALSE,
    is_accredited_verified BOOLEAN DEFAULT FALSE,
    internal_notes TEXT, -- Not visible to shareholder
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_shareholders_user_id ON shareholders(user_id);
CREATE INDEX idx_shareholders_legal_name ON shareholders(legal_name);

-- ============================================================================
-- ACCREDITED INVESTOR VERIFICATION
-- ============================================================================

CREATE TABLE accredited_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shareholder_id UUID REFERENCES shareholders(id) ON DELETE CASCADE,
    verification_date DATE NOT NULL,
    verification_method verification_method NOT NULL,
    verifier_name VARCHAR(255), -- Person/firm who verified
    verification_notes TEXT,
    document_path TEXT, -- Path to verification documents
    expires_at DATE, -- If verification has expiration
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_accredited_shareholder ON accredited_verifications(shareholder_id);

-- ============================================================================
-- INVESTMENTS & CAP TABLE
-- ============================================================================

CREATE TABLE share_classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_name VARCHAR(100) NOT NULL UNIQUE, -- e.g., "Common", "Preferred Series A"
    description TEXT,
    voting_rights DECIMAL(10,4), -- Votes per share
    liquidation_preference DECIMAL(10,4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE investments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shareholder_id UUID REFERENCES shareholders(id) ON DELETE CASCADE,
    share_class_id UUID REFERENCES share_classes(id),
    investment_date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL, -- Dollar amount invested
    shares_issued DECIMAL(15,4), -- Number of shares issued
    price_per_share DECIMAL(15,4),
    valuation_at_investment DECIMAL(15,2), -- Company valuation at time of investment
    status investment_status DEFAULT 'active',
    exit_date DATE,
    exit_amount DECIMAL(15,2),
    document_paths TEXT[], -- Array of paths to subscription docs, wire confirmations, etc.
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_investments_shareholder ON investments(shareholder_id);
CREATE INDEX idx_investments_date ON investments(investment_date);
CREATE INDEX idx_investments_status ON investments(status);

-- ============================================================================
-- RSU GRANTS & VESTING
-- ============================================================================

CREATE TABLE rsu_grants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shareholder_id UUID REFERENCES shareholders(id) ON DELETE CASCADE,
    share_class_id UUID REFERENCES share_classes(id),
    grant_date DATE NOT NULL,
    total_units DECIMAL(15,4) NOT NULL,
    vesting_start_date DATE NOT NULL,
    vesting_cliff_months INTEGER DEFAULT 0, -- Months before any vesting
    vesting_duration_months INTEGER NOT NULL, -- Total vesting period
    vesting_frequency VARCHAR(50) DEFAULT 'monthly', -- monthly, quarterly, annually
    status rsu_status DEFAULT 'active',
    cancellation_date DATE,
    cancellation_reason TEXT,
    grant_document_path TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rsu_vesting_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grant_id UUID REFERENCES rsu_grants(id) ON DELETE CASCADE,
    vesting_date DATE NOT NULL,
    units_vested DECIMAL(15,4) NOT NULL,
    is_projected BOOLEAN DEFAULT FALSE, -- TRUE for future vesting, FALSE for past
    notification_sent BOOLEAN DEFAULT FALSE,
    pre_vest_notification_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rsu_grants_shareholder ON rsu_grants(shareholder_id);
CREATE INDEX idx_rsu_grants_status ON rsu_grants(status);
CREATE INDEX idx_rsu_vesting_date ON rsu_vesting_events(vesting_date);
CREATE INDEX idx_rsu_vesting_grant ON rsu_vesting_events(grant_id);

-- ============================================================================
-- DOCUMENTS & DISCLOSURES
-- ============================================================================

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    document_type document_type NOT NULL,
    access_level document_access DEFAULT 'all_shareholders',
    file_path TEXT NOT NULL, -- Encrypted file path
    file_size BIGINT,
    file_hash VARCHAR(64), -- SHA-256 hash for integrity
    period_start DATE, -- For financial statements
    period_end DATE,
    is_audited BOOLEAN DEFAULT FALSE,
    annotation TEXT, -- Admin notes about the document
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_documents_type ON documents(document_type);
CREATE INDEX idx_documents_access ON documents(access_level);
CREATE INDEX idx_documents_uploaded ON documents(uploaded_at DESC);

-- ============================================================================
-- AUDIT LOGS & ACCESS TRACKING
-- ============================================================================

CREATE TABLE access_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- 'view', 'download', 'login', 'logout', etc.
    ip_address INET,
    user_agent TEXT,
    metadata JSONB, -- Additional context
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_access_logs_user ON access_logs(user_id);
CREATE INDEX idx_access_logs_document ON access_logs(document_id);
CREATE INDEX idx_access_logs_created ON access_logs(created_at DESC);
CREATE INDEX idx_access_logs_action ON access_logs(action);

-- For 7-year retention policy for shareholders, forever for insiders
CREATE TABLE audit_retention_policy (
    user_id UUID REFERENCES users(id),
    retention_years INTEGER NOT NULL,
    PRIMARY KEY (user_id)
);

-- ============================================================================
-- EMAIL NOTIFICATIONS
-- ============================================================================

CREATE TABLE email_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_queue_sent ON email_queue(sent);
CREATE INDEX idx_email_queue_created ON email_queue(created_at);

-- ============================================================================
-- SYSTEM CONFIGURATION
-- ============================================================================

CREATE TABLE system_config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);

-- Insert default configuration
INSERT INTO system_config (key, value, description) VALUES
('last_valuation', '0', 'Last valuation at which company sold shares'),
('smtp_host', 'PLACEHOLDER', 'SMTP server host'),
('smtp_port', '587', 'SMTP server port'),
('smtp_secure', 'true', 'Use TLS/SSL'),
('smtp_from', 'ir@buxtonhelmsley.com', 'From email address'),
('backup_enabled', 'true', 'Enable automated backups'),
('backup_frequency_hours', '24', 'Backup frequency in hours'),
('rsu_pre_vest_notification_days', '7', 'Days before vesting to send pre-vest notification');

-- ============================================================================
-- VIEWS FOR REPORTING
-- ============================================================================

-- Cap table summary view
CREATE VIEW cap_table_summary AS
SELECT 
    sc.class_name,
    sc.id as share_class_id,
    COUNT(DISTINCT s.id) as shareholder_count,
    SUM(i.shares_issued) as total_shares,
    SUM(i.amount) as total_capital
FROM share_classes sc
LEFT JOIN investments i ON sc.id = i.share_class_id AND i.status = 'active'
LEFT JOIN shareholders s ON i.shareholder_id = s.id
GROUP BY sc.id, sc.class_name;

-- Vested RSU summary
CREATE VIEW rsu_vested_summary AS
SELECT 
    rg.shareholder_id,
    rg.id as grant_id,
    rg.total_units,
    COALESCE(SUM(CASE WHEN ve.is_projected = FALSE AND ve.vesting_date <= CURRENT_DATE THEN ve.units_vested ELSE 0 END), 0) as units_vested,
    rg.total_units - COALESCE(SUM(CASE WHEN ve.is_projected = FALSE AND ve.vesting_date <= CURRENT_DATE THEN ve.units_vested ELSE 0 END), 0) as units_unvested
FROM rsu_grants rg
LEFT JOIN rsu_vesting_events ve ON rg.id = ve.grant_id
WHERE rg.status = 'active'
GROUP BY rg.id, rg.shareholder_id, rg.total_units;

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shareholders_updated_at BEFORE UPDATE ON shareholders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_investments_updated_at BEFORE UPDATE ON investments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rsu_grants_updated_at BEFORE UPDATE ON rsu_grants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to encrypt sensitive data
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(data TEXT, key TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(pgp_sym_encrypt(data, key), 'base64');
END;
$$ LANGUAGE plpgsql;

-- Function to decrypt sensitive data
CREATE OR REPLACE FUNCTION decrypt_sensitive_data(encrypted_data TEXT, key TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN pgp_sym_decrypt(decode(encrypted_data, 'base64'), key);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECURITY & PERMISSIONS
-- ============================================================================

-- Create read-only role for backups
CREATE ROLE backup_user WITH LOGIN PASSWORD 'CHANGE_THIS_PASSWORD';
GRANT CONNECT ON DATABASE postgres TO backup_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_user;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO backup_user;

-- Create application role with appropriate permissions
CREATE ROLE app_user WITH LOGIN PASSWORD 'CHANGE_THIS_PASSWORD';
GRANT CONNECT ON DATABASE postgres TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Create default share class
INSERT INTO share_classes (class_name, description, voting_rights, liquidation_preference)
VALUES ('Common', 'Common Stock', 1.0, 1.0);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Additional composite indexes for common queries
CREATE INDEX idx_investments_shareholder_status ON investments(shareholder_id, status);
CREATE INDEX idx_documents_access_uploaded ON documents(access_level, uploaded_at DESC);
CREATE INDEX idx_access_logs_user_created ON access_logs(user_id, created_at DESC);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE users IS 'Core authentication and user management table';
COMMENT ON TABLE shareholders IS 'Detailed shareholder information with PII';
COMMENT ON TABLE investments IS 'Investment transactions and cap table data';
COMMENT ON TABLE rsu_grants IS 'Restricted stock unit grants to employees and board members';
COMMENT ON TABLE documents IS 'Financial statements, disclosures, and board materials';
COMMENT ON TABLE access_logs IS 'Comprehensive audit trail for compliance';
COMMENT ON COLUMN shareholders.tax_id_encrypted IS 'Encrypted using pgcrypto - decrypt with encryption key';
COMMENT ON COLUMN documents.file_path IS 'Path to encrypted file on server';

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
