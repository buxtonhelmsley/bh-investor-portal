# Buxton Helmsley Investor Portal - Deployment Checklist

## Pre-Deployment Checklist

### Infrastructure Setup
- [ ] Server provisioned (dev.buxtonhelmsley.com accessible)
- [ ] PostgreSQL 14+ installed and running
- [ ] Node.js 18+ installed
- [ ] SSL certificate obtained for investors.buxtonhelmsley.com
- [ ] DNS configured (A record pointing to server IP)
- [ ] Storage directories created with proper permissions
- [ ] Firewall configured (ports 22, 80, 443 open)

### Database Setup
- [ ] Database `investor_portal` created
- [ ] Users `app_user` and `backup_user` created with strong passwords
- [ ] Schema deployed (`database/schema.sql` executed)
- [ ] Database permissions granted correctly
- [ ] Database connection tested from application
- [ ] PostgreSQL configured to accept local connections only

### Application Configuration
- [ ] Repository cloned to `/var/www/investor-portal`
- [ ] Dependencies installed (`npm install`)
- [ ] `.env.local` created from `.env.example`
- [ ] `AUTH_SECRET` generated and set (openssl rand -base64 32)
- [ ] `ENCRYPTION_KEY` generated and set (openssl rand -base64 32)
- [ ] `DOCUMENT_ENCRYPTION_KEY` generated and set (openssl rand -base64 32)
- [ ] Database URL configured with actual credentials
- [ ] SMTP credentials configured and tested
- [ ] Storage paths configured correctly
- [ ] Application built successfully (`npm run build`)

### Security Configuration
- [ ] All encryption keys backed up in secure location (password manager/vault)
- [ ] Database passwords stored securely
- [ ] `.env.local` permissions set to 600
- [ ] Document storage directory permissions set to 700
- [ ] Root login disabled on server
- [ ] SSH key-based authentication configured
- [ ] Fail2ban or similar intrusion prevention installed
- [ ] UFW/firewall enabled and configured

### Initial Data Setup
- [ ] Default share class created (Common Stock)
- [ ] Initial admin user created (alexander@buxtonhelmsley.com)
- [ ] Admin password set and tested
- [ ] System configuration values set in `system_config` table
- [ ] Last valuation set

### Email Configuration
- [ ] SMTP credentials tested
- [ ] Welcome email template reviewed
- [ ] Document notification template reviewed
- [ ] RSU notification templates reviewed
- [ ] Email sending from ir@buxtonhelmsley.com verified

### Backup Configuration
- [ ] Backup script created and tested (`/var/www/investor-portal/scripts/backup.sh`)
- [ ] Backup directory created (`/var/www/investor-portal/backups`)
- [ ] Backup encryption key generated and stored securely
- [ ] Test backup created and restore verified
- [ ] Backup cron job configured (daily at 2 AM)
- [ ] Backup retention policy configured (365 days)

### Deployment
- [ ] Application deployed to production (Vercel or PM2)
- [ ] Nginx configured and tested (if self-hosting)
- [ ] SSL certificate installed and auto-renewal configured
- [ ] Application accessible at https://investors.buxtonhelmsley.com
- [ ] HTTP to HTTPS redirect working
- [ ] Security headers verified (check with securityheaders.com)

### Cron Jobs
- [ ] Daily backup cron job configured
- [ ] RSU vesting process cron job configured (daily 9 AM)
- [ ] Pre-vest notification cron job configured (daily 9 AM)
- [ ] Email queue processing cron job configured (every 15 minutes)
- [ ] Temp file cleanup cron job configured (weekly)
- [ ] All cron jobs tested manually

### Monitoring & Logging
- [ ] Application logs directory created (`/var/log/investor-portal`)
- [ ] Log rotation configured
- [ ] Error monitoring set up
- [ ] Uptime monitoring configured
- [ ] Disk space alerts configured
- [ ] Database connection monitoring active
- [ ] SSL certificate expiration monitoring active

### Testing
- [ ] Admin login tested
- [ ] Shareholder creation tested
- [ ] Welcome email received
- [ ] Document upload tested
- [ ] Document encryption verified
- [ ] Document download tested
- [ ] Document notification email received
- [ ] Investment creation tested
- [ ] RSU grant creation tested
- [ ] RSU vesting schedule generated correctly
- [ ] Cap table displayed correctly
- [ ] Access logs being created
- [ ] MFA setup and login tested
- [ ] Password reset flow tested

### Compliance
- [ ] Accredited investor verification tracking reviewed
- [ ] Data retention policies configured
  - [ ] 7-year retention for shareholders
  - [ ] Unlimited retention for insiders
- [ ] Audit log completeness verified
- [ ] Document access controls tested
- [ ] Board-only documents restricted properly
- [ ] PII encryption verified (tax IDs)

### Documentation
- [ ] README.md reviewed and updated
- [ ] Deployment documentation current
- [ ] Admin procedures documented
- [ ] Backup/restore procedures documented
- [ ] Security incident response plan documented
- [ ] Contact information updated

## Post-Deployment Checklist

### Immediate (Day 1)
- [ ] Verify all cron jobs executed successfully
- [ ] Check application logs for errors
- [ ] Verify backup completed successfully
- [ ] Test document upload/download
- [ ] Create first test shareholder
- [ ] Verify email notifications working
- [ ] Monitor disk space
- [ ] Monitor database connections

### First Week
- [ ] Daily log review
- [ ] Monitor email queue depth
- [ ] Verify backup completion daily
- [ ] Check SSL certificate status
- [ ] Review access logs for anomalies
- [ ] Test disaster recovery (restore from backup)
- [ ] Document any issues encountered

### First Month
- [ ] Review all user accounts
- [ ] Audit access permissions
- [ ] Review and optimize database performance
- [ ] Check disk usage trends
- [ ] Review and update documentation
- [ ] Conduct security review
- [ ] Test all notification types

### Ongoing Maintenance
- [ ] Daily error log review
- [ ] Weekly backup verification
- [ ] Monthly security updates
- [ ] Quarterly disaster recovery test
- [ ] Quarterly access audit
- [ ] Quarterly password rotation
- [ ] Annual security audit

## Emergency Contacts

### Technical Issues
- Primary: Alexander Parker (alexander@buxtonhelmsley.com)
- Infrastructure: [Server provider contact]
- Database: [Database admin contact]

### Security Incidents
- Security Lead: Alexander Parker
- Legal Counsel: Alex Spiro (Quinn Emanuel)
- Law Enforcement: [Local FBI cyber division]

### Service Providers
- SMTP Provider: [Contact info]
- SSL Certificate: Let's Encrypt (automated)
- Hosting: dev.buxtonhelmsley.com ([provider contact])

## Rollback Plan

If critical issues are discovered post-deployment:

1. **Immediate Actions:**
   - [ ] Switch DNS back to maintenance page
   - [ ] Stop application (PM2 or Vercel)
   - [ ] Create emergency backup
   - [ ] Document all issues

2. **Investigation:**
   - [ ] Review application logs
   - [ ] Review database logs
   - [ ] Check for data corruption
   - [ ] Identify root cause

3. **Resolution:**
   - [ ] Fix issues in staging environment
   - [ ] Test fixes thoroughly
   - [ ] Restore from backup if necessary
   - [ ] Redeploy with fixes
   - [ ] Verify all functionality

4. **Communication:**
   - [ ] Notify affected users
   - [ ] Update status page
   - [ ] Document lessons learned

## Sign-Off

Deployment completed by: _____________________ Date: _____

Verified by: _____________________ Date: _____

Security review by: _____________________ Date: _____

Approved for production: _____________________ Date: _____

---

## Notes

Use this section to document any deviations from the checklist, specific configuration choices, or issues encountered during deployment:

_________________________________________________________________________

_________________________________________________________________________

_________________________________________________________________________

_________________________________________________________________________

---

**Important:** Keep this checklist with your deployment documentation and update it based on lessons learned from each deployment.
