# Buxton Helmsley Investor Portal

## Production-Ready Shareholder Portal with Full Compliance Features

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Prerequisites](#prerequisites)
4. [Installation](#installation)
5. [Database Setup](#database-setup)
6. [Configuration](#configuration)
7. [Deployment](#deployment)
8. [Security Hardening](#security-hardening)
9. [Backup & Disaster Recovery](#backup--disaster-recovery)
10. [Cron Jobs & Automation](#cron-jobs--automation)
11. [Usage Guide](#usage-guide)
12. [Troubleshooting](#troubleshooting)
13. [Compliance Notes](#compliance-notes)

---

## Overview

This is a secure, compliant investor portal for Buxton Helmsley shareholders. It provides:

- Encrypted document storage and distribution
- Role-based access control (Shareholders, Board Members, Admins)
- RSU grant tracking with automated vesting calculations
- Comprehensive audit logging for SEC compliance
- Multi-factor authentication (MFA)
- Email notifications for new documents and vesting events
- Cap table visibility with privacy protections

**Technology Stack:**
- Next.js 14 with App Router
- NextAuth.js v5 for authentication
- PostgreSQL with encryption at rest
- Node.js email notifications via SMTP

---

## Features

### Document Management
- ✅ Upload financial statements, quarterly letters, board minutes
- ✅ Automatic encryption at rest (AES-256-GCM)
- ✅ Access control (All Shareholders vs Board/Management Only)
- ✅ Download tracking and audit logs
- ✅ Automatic email notifications on upload

### Shareholder Management
- ✅ Complete shareholder profiles with encrypted PII
- ✅ Investment tracking (multiple investments per shareholder)
- ✅ RSU grant management with custom vesting schedules
- ✅ Automated vesting calculations
- ✅ Pre-vest and vest notifications
- ✅ Accredited investor verification tracking

### Access Control
- ✅ Four role levels:
  - **Shareholder**: View documents, own profile, cap table summary
  - **Board Member**: View all data, no editing
  - **Admin (View Only)**: View all data, no editing
  - **Admin (Edit)**: Full control

### Compliance & Audit
- ✅ Complete audit trail of all access
- ✅ 7-year log retention for shareholders
- ✅ Unlimited log retention for insiders
- ✅ Rule 506(c) verification tracking
- ✅ Document integrity verification (SHA-256 hashing)

### Cap Table
- ✅ Share class tracking
- ✅ Anonymous cap table view for shareholders
- ✅ Full visibility for admins/board

---

## Prerequisites

### Server Requirements
- Ubuntu 24 LTS (or similar)
- Node.js 18+ and npm
- PostgreSQL 14+
- SSL certificate for HTTPS
- Minimum 2GB RAM, 20GB storage

### Access Required
- SSH access to dev.buxtonhelmsley.com
- PostgreSQL admin credentials
- SMTP server credentials
- Domain DNS control for investors.buxtonhelmsley.com

---

## Installation

### Step 1: Clone and Install Dependencies

```bash
# On dev.buxtonhelmsley.com
cd /var/www
git clone <repository-url> investor-portal
cd investor-portal

# Install dependencies
npm install

# Build the application
npm run build
```

### Step 2: Create Required Directories

```bash
# Create storage directories
sudo mkdir -p /var/www/investor-portal/storage/{documents,uploads,backups}
sudo mkdir -p /var/log/investor-portal

# Set permissions
sudo chown -R www-data:www-data /var/www/investor-portal/storage
sudo chown -R www-data:www-data /var/log/investor-portal
sudo chmod 700 /var/www/investor-portal/storage/documents
```

---

## Database Setup

### Step 1: Create Database

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database and users
CREATE DATABASE investor_portal;
CREATE USER app_user WITH PASSWORD 'STRONG_PASSWORD_HERE';
CREATE USER backup_user WITH PASSWORD 'STRONG_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON DATABASE investor_portal TO app_user;
GRANT CONNECT ON DATABASE investor_portal TO backup_user;
```

### Step 2: Run Database Schema

```bash
# From project directory
psql -U app_user -d investor_portal -f database/schema.sql
```

### Step 3: Verify Database

```bash
psql -U app_user -d investor_portal

# Check tables
\dt

# Should see: users, shareholders, investments, rsu_grants, documents, access_logs, etc.
```

---

## Configuration

### Step 1: Environment Variables

```bash
# Copy example environment file
cp .env.example .env.local

# Edit with your actual values
nano .env.local
```

### Critical Variables to Set:

```bash
# Database - REPLACE with actual password
DATABASE_URL=postgresql://app_user:YOUR_ACTUAL_PASSWORD@localhost:5432/investor_portal

# Authentication - Generate with: openssl rand -base64 32
AUTH_SECRET=YOUR_ACTUAL_SECRET_HERE

# Encryption Keys - Generate with: openssl rand -base64 32
ENCRYPTION_KEY=YOUR_ACTUAL_ENCRYPTION_KEY
DOCUMENT_ENCRYPTION_KEY=YOUR_ACTUAL_DOC_ENCRYPTION_KEY

# SMTP - Your actual SMTP credentials
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASSWORD=your_smtp_password

# Initial Admin Email
INITIAL_ADMIN_EMAIL=alexander@buxtonhelmsley.com
```

### Step 2: Generate Encryption Keys

```bash
# Generate all required secrets
echo "AUTH_SECRET=$(openssl rand -base64 32)"
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)"
echo "DOCUMENT_ENCRYPTION_KEY=$(openssl rand -base64 32)"
```

**⚠️ CRITICAL: Store these keys in a secure location (password manager, vault). If lost, encrypted data cannot be recovered.**

---

## Deployment

### Option 1: Deploy on Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Link to Vercel
vercel

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard
# Go to: Project Settings > Environment Variables
# Add all variables from .env.local
```

### Option 2: Deploy with PM2 (Self-Hosted)

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start npm --name "investor-portal" -- start

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup
```

### Option 3: Deploy with Nginx

```bash
# Install Nginx
sudo apt install nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/investors.buxtonhelmsley.com
```

Nginx configuration:

```nginx
server {
    listen 443 ssl http2;
    server_name investors.buxtonhelmsley.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Increase upload size for documents
    client_max_body_size 100M;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name investors.buxtonhelmsley.com;
    return 301 https://$server_name$request_uri;
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/investors.buxtonhelmsley.com /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

---

## Security Hardening

### 1. File Permissions

```bash
# Restrict access to sensitive files
chmod 600 .env.local
chmod 600 /var/www/investor-portal/storage/documents/*
chmod 700 /var/www/investor-portal/storage/documents

# Ensure proper ownership
chown -R www-data:www-data /var/www/investor-portal
```

### 2. PostgreSQL Security

```bash
# Edit PostgreSQL config
sudo nano /etc/postgresql/14/main/pg_hba.conf

# Add this line (restrict to localhost)
host    investor_portal    app_user        127.0.0.1/32            scram-sha-256

# Reload PostgreSQL
sudo systemctl reload postgresql
```

### 3. Firewall Configuration

```bash
# Allow only necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (for redirect)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### 4. SSL/TLS Configuration

Use Let's Encrypt for free SSL certificates:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d investors.buxtonhelmsley.com
sudo certbot renew --dry-run  # Test auto-renewal
```

### 5. Disable Root Login

```bash
sudo nano /etc/ssh/sshd_config

# Set these values:
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes

sudo systemctl restart sshd
```

---

## Backup & Disaster Recovery

### Automated Database Backup Script

Create `/var/www/investor-portal/scripts/backup.sh`:

```bash
#!/bin/bash

# Configuration
BACKUP_DIR="/var/www/investor-portal/backups"
DB_NAME="investor_portal"
DB_USER="backup_user"
DB_PASSWORD="YOUR_BACKUP_PASSWORD"
RETENTION_DAYS=365
ENCRYPTION_KEY="YOUR_BACKUP_ENCRYPTION_KEY"

# Create backup filename with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"
ENCRYPTED_FILE="$BACKUP_FILE.enc"

# Create database backup
PGPASSWORD=$DB_PASSWORD pg_dump -U $DB_USER -h localhost $DB_NAME > $BACKUP_FILE

# Encrypt backup
openssl enc -aes-256-cbc -salt -in $BACKUP_FILE -out $ENCRYPTED_FILE -k $ENCRYPTION_KEY

# Remove unencrypted backup
rm $BACKUP_FILE

# Remove old backups
find $BACKUP_DIR -name "backup_*.sql.enc" -mtime +$RETENTION_DAYS -delete

# Also backup files
tar -czf $BACKUP_DIR/files_$TIMESTAMP.tar.gz /var/www/investor-portal/storage/documents

echo "Backup completed: $ENCRYPTED_FILE"
```

Make it executable:

```bash
chmod +x /var/www/investor-portal/scripts/backup.sh
```

### Restore from Backup

```bash
# Decrypt backup
openssl enc -aes-256-cbc -d -in backup_TIMESTAMP.sql.enc -out backup_TIMESTAMP.sql -k YOUR_BACKUP_ENCRYPTION_KEY

# Restore database
psql -U app_user -d investor_portal < backup_TIMESTAMP.sql

# Restore files
tar -xzf files_TIMESTAMP.tar.gz -C /
```

---

## Cron Jobs & Automation

Add these to crontab (`crontab -e`):

```bash
# Daily database backup at 2 AM
0 2 * * * /var/www/investor-portal/scripts/backup.sh >> /var/log/investor-portal/backup.log 2>&1

# Process RSU vesting events daily at 9 AM
0 9 * * * curl https://investors.buxtonhelmsley.com/api/cron/process-vesting

# Process pre-vest notifications daily at 9 AM
0 9 * * * curl https://investors.buxtonhelmsley.com/api/cron/pre-vest-notifications

# Process email queue every 15 minutes
*/15 * * * * curl https://investors.buxtonhelmsley.com/api/cron/process-emails

# Clean up old temp files weekly
0 3 * * 0 find /var/www/investor-portal/storage/uploads -mtime +7 -delete
```

---

## Usage Guide

### Creating the First Admin User

On first deployment, you need to create your admin account manually:

```bash
# Connect to database
psql -U app_user -d investor_portal

# Insert your admin user (replace with your actual hashed password)
INSERT INTO users (email, password_hash, role, is_active, email_verified)
VALUES ('alexander@buxtonhelmsley.com', '$2a$12$HASHED_PASSWORD_HERE', 'admin_edit', TRUE, TRUE);
```

To generate the password hash:

```javascript
// Run in Node.js
const bcrypt = require('bcryptjs');
const password = 'YOUR_SECURE_PASSWORD';
bcrypt.hash(password, 12).then(hash => console.log(hash));
```

### Adding Shareholders

1. Log in as admin
2. Navigate to "Shareholders" > "Add New"
3. Fill in required information:
   - Legal Name
   - Email Address
   - Shareholder Type (Individual, Entity, Trust, IRA)
   - Tax ID (encrypted automatically)
   - Phone, Address
   - ERISA subject status
   - Accredited investor verification status
4. Click "Create Shareholder"
5. System automatically:
   - Generates temporary password
   - Sends welcome email
   - Creates audit log entry

### Uploading Documents

1. Log in as admin (edit role)
2. Navigate to "Documents" > "Upload New"
3. Select file (PDF, DOCX, or XLSX only)
4. Fill in metadata:
   - Title
   - Description
   - Document Type
   - Access Level (All Shareholders or Board/Management Only)
   - Period (for financial statements)
   - Audited status
   - Internal annotation
5. Click "Upload"
6. System automatically:
   - Encrypts file at rest
   - Generates SHA-256 hash
   - Sends email notifications (if accessible to all shareholders)
   - Logs upload in audit trail

### Managing RSU Grants

1. Navigate to shareholder profile
2. Click "Grant RSUs"
3. Enter grant details:
   - Share class
   - Total units
   - Grant date
   - Vesting start date
   - Cliff period (months)
   - Total vesting duration (months)
   - Vesting frequency (monthly/quarterly/annually)
4. Click "Create Grant"
5. System automatically:
   - Calculates complete vesting schedule
   - Creates vesting events in database
   - Schedules notifications

### Canceling RSU Grants

For terminated employees or forfeited grants:

1. Navigate to shareholder profile > RSUs
2. Find grant to cancel
3. Click "Cancel Grant"
4. Enter reason for cancellation
5. Confirm cancellation
6. System updates status to 'cancelled' and logs event

---

## Troubleshooting

### Database Connection Errors

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check connection
psql -U app_user -d investor_portal -h localhost

# Check logs
tail -f /var/log/postgresql/postgresql-14-main.log
```

### Email Not Sending

```bash
# Check email queue
psql -U app_user -d investor_portal
SELECT * FROM email_queue WHERE sent = FALSE ORDER BY created_at DESC LIMIT 10;

# Check SMTP credentials in .env.local
# Manually process email queue
curl https://investors.buxtonhelmsley.com/api/cron/process-emails
```

### File Encryption Errors

```bash
# Verify encryption keys are set
grep ENCRYPTION_KEY .env.local

# Check file permissions
ls -la /var/www/investor-portal/storage/documents

# Check storage space
df -h /var/www/investor-portal/storage
```

### Session/Authentication Issues

```bash
# Clear sessions
psql -U app_user -d investor_portal
TRUNCATE TABLE sessions;

# Regenerate AUTH_SECRET
openssl rand -base64 32

# Update .env.local and restart application
```

---

## Compliance Notes

### SEC Rule 506(c) Compliance

This portal tracks accredited investor verification:

1. Upload verification documents per investor
2. Record verification method and date
3. Track verifier information
4. Set expiration dates where applicable

### Data Retention Policies

- **Shareholders**: 7-year access log retention
- **Insiders (Admin/Board)**: Unlimited access log retention
- **Documents**: No automatic deletion (manual review required)
- **Database backups**: 365-day retention

### Audit Trail

All actions are logged in `access_logs` table:
- User logins/logouts
- Document uploads
- Document views/downloads
- Shareholder creation/modification
- RSU grant creation/cancellation
- System configuration changes

To export audit logs for compliance:

```bash
psql -U app_user -d investor_portal -c "COPY (SELECT * FROM access_logs WHERE created_at >= '2025-01-01') TO STDOUT CSV HEADER" > audit_export.csv
```

### ERISA Compliance

Shareholders subject to ERISA are flagged in the system. When adding shareholders:

1. Mark "Subject to ERISA" if applicable
2. Maintain separate records if required
3. Consult legal counsel for specific ERISA requirements

---

## Support & Maintenance

### Monitoring

Set up monitoring for:
- Database connections
- Disk space
- SSL certificate expiration
- Email queue depth
- Failed login attempts

### Regular Maintenance Tasks

**Daily:**
- Review error logs
- Check email queue

**Weekly:**
- Review access logs for anomalies
- Check backup completion
- Review disk space

**Monthly:**
- Rotate logs
- Review user access permissions
- Update dependencies (security patches)
- Test disaster recovery procedure

**Quarterly:**
- Review and update passwords
- Audit user accounts
- Test backup restoration
- Review compliance requirements

---

## Security Incident Response

If you suspect a security breach:

1. **Immediate Actions:**
   - Change all passwords (database, SMTP, admin users)
   - Regenerate encryption keys (requires re-encrypting all data)
   - Review access logs for suspicious activity
   - Disable affected user accounts

2. **Investigation:**
   - Export full audit trail
   - Review recent database changes
   - Check for unauthorized file access
   - Consult with legal counsel

3. **Notification:**
   - Notify affected shareholders if PII was accessed
   - Document incident for compliance
   - Report to appropriate authorities if required

---

## License & Legal

© 2025 Buxton Helmsley, Inc. All rights reserved.

This software is proprietary and confidential. Unauthorized copying, distribution, or use is strictly prohibited.

**Important Legal Disclaimer:**

This portal is designed to assist with investor relations and compliance but does not constitute legal advice. Always consult with qualified legal counsel regarding:

- Securities law compliance
- Data privacy regulations
- Investor communications
- Corporate governance matters

---

## Contact

For technical support or questions:
- Email: ir@buxtonhelmsley.com
- Internal documentation: [Link to internal wiki if applicable]

---

**Last Updated:** November 15, 2025
**Version:** 1.0.0
**Maintained by:** Buxton Helmsley Technology Team
