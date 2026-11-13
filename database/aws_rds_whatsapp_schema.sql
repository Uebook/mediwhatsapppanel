-- =========================================================================
-- MEDICONNECT WHATSAPP SUPPORT & OPERATIONS PANEL
-- AWS RDS / AURORA POSTGRESQL PRODUCTION IMPORT SCRIPT
-- Compatible with PostgreSQL 13, 14, 15, 16, 17+
-- =========================================================================

BEGIN;

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUM TYPES
DO $$ BEGIN
    CREATE TYPE wa_user_role AS ENUM (
        'Super Admin',
        'Support Agent',
        'Medical Operations',
        'Nurse Lead',
        'Billing Staff'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE wa_user_status AS ENUM (
        'Active',
        'Suspended',
        'Invited'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE wa_msg_direction AS ENUM (
        'INBOUND',
        'OUTBOUND'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE wa_msg_status AS ENUM (
        'sent',
        'delivered',
        'read',
        'failed',
        'received'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE wa_takeover_status AS ENUM (
        'ACTIVE',
        'COMPLETED',
        'RELEASED',
        'ESCALATED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. TABLES DEFINITIONS

-- -------------------------------------------------------------------------
-- TABLE 1: whatsapp_users (Admin & Agent Accounts with RBAC)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(150) NOT NULL,
    role wa_user_role NOT NULL DEFAULT 'Support Agent',
    phone VARCHAR(30),
    department VARCHAR(100) DEFAULT 'Customer Support',
    employee_code VARCHAR(50),
    permissions JSONB NOT NULL DEFAULT '["LIVE_TAKEOVER", "REPLY_WHATSAPP", "SEND_TEMPLATES"]'::jsonb,
    status wa_user_status NOT NULL DEFAULT 'Active',
    last_login_at TIMESTAMPTZ,
    last_login_ip VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wa_users_email ON whatsapp_users(email);
CREATE INDEX IF NOT EXISTS idx_wa_users_status ON whatsapp_users(status);
CREATE INDEX IF NOT EXISTS idx_wa_users_role ON whatsapp_users(role);

-- -------------------------------------------------------------------------
-- TABLE 2: whatsapp_messages (Live Inbound / Outbound Chat Stream)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wa_message_id VARCHAR(150) UNIQUE,
    phone_number VARCHAR(30) NOT NULL,
    patient_name VARCHAR(150),
    direction wa_msg_direction NOT NULL DEFAULT 'INBOUND',
    sender_type VARCHAR(30) NOT NULL DEFAULT 'PATIENT',
    agent_id UUID REFERENCES whatsapp_users(id) ON DELETE SET NULL,
    agent_name VARCHAR(150),
    message_type VARCHAR(30) NOT NULL DEFAULT 'text',
    text TEXT,
    media_url TEXT,
    media_mime_type VARCHAR(100),
    status wa_msg_status NOT NULL DEFAULT 'received',
    raw_timestamp BIGINT NOT NULL,
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wa_msg_phone ON whatsapp_messages(phone_number);
CREATE INDEX IF NOT EXISTS idx_wa_msg_timestamp ON whatsapp_messages(raw_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_wa_msg_wamid ON whatsapp_messages(wa_message_id);
CREATE INDEX IF NOT EXISTS idx_wa_msg_agent ON whatsapp_messages(agent_id);
CREATE INDEX IF NOT EXISTS idx_wa_msg_status ON whatsapp_messages(status);

-- -------------------------------------------------------------------------
-- TABLE 3: whatsapp_takeovers (Human Support Sessions)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_takeovers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(30) NOT NULL,
    patient_name VARCHAR(150),
    agent_id UUID NOT NULL REFERENCES whatsapp_users(id) ON DELETE CASCADE,
    agent_name VARCHAR(150) NOT NULL,
    status wa_takeover_status NOT NULL DEFAULT 'ACTIVE',
    handover_reason VARCHAR(255),
    resolution_notes TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wa_takeover_phone_status ON whatsapp_takeovers(phone_number, status);
CREATE INDEX IF NOT EXISTS idx_wa_takeover_agent ON whatsapp_takeovers(agent_id);

-- -------------------------------------------------------------------------
-- TABLE 4: whatsapp_templates (Approved Meta WhatsApp Templates)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(120) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'en_US',
    header_type VARCHAR(30) DEFAULT 'NONE',
    body_text TEXT NOT NULL,
    example_params JSONB DEFAULT '[]'::jsonb,
    meta_status VARCHAR(50) DEFAULT 'APPROVED',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wa_templates_name ON whatsapp_templates(template_name);

-- -------------------------------------------------------------------------
-- TABLE 5: whatsapp_broadcast_campaigns (Broadcast Batch Headers)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_broadcast_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    template_id UUID REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
    template_name VARCHAR(120) NOT NULL,
    audience_type VARCHAR(100) NOT NULL,
    total_recipients INT NOT NULL DEFAULT 0,
    sent_count INT NOT NULL DEFAULT 0,
    delivered_count INT NOT NULL DEFAULT 0,
    read_count INT NOT NULL DEFAULT 0,
    failed_count INT NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    created_by UUID REFERENCES whatsapp_users(id) ON DELETE SET NULL,
    scheduled_for TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wa_campaigns_status ON whatsapp_broadcast_campaigns(status);

-- -------------------------------------------------------------------------
-- TABLE 6: whatsapp_broadcast_recipients (Per-Patient Delivery Status)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_broadcast_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES whatsapp_broadcast_campaigns(id) ON DELETE CASCADE,
    phone_number VARCHAR(30) NOT NULL,
    patient_name VARCHAR(150),
    wa_message_id VARCHAR(150),
    status wa_msg_status NOT NULL DEFAULT 'sent',
    error_message TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wa_recipients_campaign ON whatsapp_broadcast_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_wa_recipients_phone ON whatsapp_broadcast_recipients(phone_number);

-- -------------------------------------------------------------------------
-- TABLE 7: whatsapp_audit_logs (Compliance & Operational Audit Trail)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES whatsapp_users(id) ON DELETE SET NULL,
    user_name VARCHAR(150) NOT NULL,
    action VARCHAR(100) NOT NULL,
    target_entity VARCHAR(100),
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wa_audit_user ON whatsapp_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_wa_audit_action ON whatsapp_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_wa_audit_created ON whatsapp_audit_logs(created_at DESC);

-- -------------------------------------------------------------------------
-- 4. AUTO-UPDATING TIMESTAMP TRIGGER FUNCTION
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_whatsapp_users_updated ON whatsapp_users;
CREATE TRIGGER trigger_whatsapp_users_updated
BEFORE UPDATE ON whatsapp_users
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trigger_whatsapp_takeovers_updated ON whatsapp_takeovers;
CREATE TRIGGER trigger_whatsapp_takeovers_updated
BEFORE UPDATE ON whatsapp_takeovers
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trigger_whatsapp_templates_updated ON whatsapp_templates;
CREATE TRIGGER trigger_whatsapp_templates_updated
BEFORE UPDATE ON whatsapp_templates
FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- -------------------------------------------------------------------------
-- 5. INITIAL PRODUCTION SEED DATA (ACTIVE TEAM & ADMIN ACCOUNTS)
-- Default Password for all accounts is: admin123
-- -------------------------------------------------------------------------
INSERT INTO whatsapp_users (
    email,
    password_hash,
    name,
    role,
    phone,
    department,
    employee_code,
    permissions,
    status
)
VALUES
(
    'admin@mediconnect.fit',
    crypt('admin123', gen_salt('bf', 10)),
    'Super Admin',
    'Super Admin',
    '+919667019010',
    'Administration',
    'MC00000',
    '["ALL_ACCESS", "BROADCASTS", "TEMPLATES_CRUD", "TAKEOVERS", "AUDIT_EXPORT"]'::jsonb,
    'Active'
),
(
    'support@mediconnect.fit',
    crypt('admin123', gen_salt('bf', 10)),
    'Support Desk',
    'Support Agent',
    '+919667019010',
    'Customer Support',
    'MC00001',
    '["LIVE_TAKEOVER", "REPLY_WHATSAPP", "SEND_TEMPLATES"]'::jsonb,
    'Active'
),
(
    'muskan@mediconnect.fit',
    crypt('admin123', gen_salt('bf', 10)),
    'Muskan Sharma',
    'Support Agent',
    '+919667019010',
    'Customer Support',
    'MC00002',
    '["LIVE_TAKEOVER", "REPLY_WHATSAPP"]'::jsonb,
    'Active'
),
(
    'surajkr7804@gmail.com',
    crypt('admin123', gen_salt('bf', 10)),
    'Suraj Kumar',
    'Billing Staff',
    '7808455740',
    'Marketing & Billing',
    'MC00005',
    '["LIVE_TAKEOVER", "REPLY_WHATSAPP", "PATIENT_RECORDS_VIEW"]'::jsonb,
    'Active'
),
(
    'kajalnishad26378@gmail.com',
    crypt('admin123', gen_salt('bf', 10)),
    'Kajal',
    'Support Agent',
    '8800215310',
    'Customer Support',
    'MC00004',
    '["LIVE_TAKEOVER", "REPLY_WHATSAPP", "PATIENT_RECORDS_VIEW"]'::jsonb,
    'Active'
),
(
    'ranjeet03092004@gmail.com',
    crypt('admin123', gen_salt('bf', 10)),
    'Ranjeet Kumar',
    'Medical Operations',
    '7887067046',
    'Operations',
    'MC00003',
    '["LIVE_TAKEOVER", "REPLY_WHATSAPP", "PATIENT_RECORDS_VIEW"]'::jsonb,
    'Active'
),
(
    'seema.nirbhay1@gmail.com',
    crypt('admin123', gen_salt('bf', 10)),
    'Seema Nirbhay',
    'Support Agent',
    '9650444929',
    'Business Development',
    'MC00002',
    '["LIVE_TAKEOVER", "REPLY_WHATSAPP", "SEND_TEMPLATES"]'::jsonb,
    'Active'
),
(
    'devsharma06.developer@gmail.com',
    crypt('admin123', gen_salt('bf', 10)),
    'Dev Kumar Sharma',
    'Nurse Lead',
    '7877763332',
    'Nurse Leads',
    'MC00001',
    '["LIVE_TAKEOVER", "REPLY_WHATSAPP", "PATIENT_RECORDS_VIEW"]'::jsonb,
    'Active'
)
ON CONFLICT (email) DO UPDATE SET
    role = EXCLUDED.role,
    department = EXCLUDED.department,
    permissions = EXCLUDED.permissions,
    phone = EXCLUDED.phone,
    employee_code = EXCLUDED.employee_code,
    status = EXCLUDED.status;

COMMIT;

