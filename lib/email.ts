import nodemailer from 'nodemailer';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
};

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send email immediately
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  if (process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'true') {
    console.log('Email notifications disabled. Would have sent:', options.subject);
    return;
  }

  const transporter = createTransporter();
  
  await transporter.sendMail({
    from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text || stripHtml(options.html),
  });
}

/**
 * Queue email for later delivery
 */
export async function queueEmail(options: EmailOptions): Promise<void> {
  const client = await pool.connect();
  try {
    const recipients = Array.isArray(options.to) ? options.to : [options.to];
    
    for (const recipient of recipients) {
      await client.query(
        `INSERT INTO email_queue (recipient_email, subject, body) 
         VALUES ($1, $2, $3)`,
        [recipient, options.subject, options.html]
      );
    }
  } finally {
    client.release();
  }
}

/**
 * Process email queue
 */
export async function processEmailQueue(): Promise<void> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, recipient_email, subject, body, retry_count 
       FROM email_queue 
       WHERE sent = FALSE AND retry_count < 3 
       ORDER BY created_at ASC 
       LIMIT 50`
    );

    const transporter = createTransporter();

    for (const email of result.rows) {
      try {
        await transporter.sendMail({
          from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM}>`,
          to: email.recipient_email,
          subject: email.subject,
          html: email.body,
        });

        await client.query(
          `UPDATE email_queue 
           SET sent = TRUE, sent_at = CURRENT_TIMESTAMP 
           WHERE id = $1`,
          [email.id]
        );
      } catch (error) {
        await client.query(
          `UPDATE email_queue 
           SET retry_count = retry_count + 1, 
               error_message = $1 
           WHERE id = $2`,
          [error instanceof Error ? error.message : 'Unknown error', email.id]
        );
      }
    }
  } finally {
    client.release();
  }
}

/**
 * Send new document notification to all shareholders
 */
export async function notifyNewDocument(
  documentId: string,
  documentTitle: string,
  documentType: string
): Promise<void> {
  const client = await pool.connect();
  try {
    // Get all active shareholders
    const result = await client.query(
      `SELECT u.email, s.legal_name 
       FROM users u
       JOIN shareholders s ON u.id = s.user_id
       WHERE u.is_active = TRUE AND u.role = 'shareholder'`
    );

    const html = generateDocumentNotificationEmail(documentTitle, documentType);

    for (const user of result.rows) {
      await queueEmail({
        to: user.email,
        subject: `New Document Available: ${documentTitle}`,
        html: html,
      });
    }
  } finally {
    client.release();
  }
}

/**
 * Send RSU vesting notification
 */
export async function notifyRSUVesting(
  shareholderId: string,
  unitsVested: number,
  vestingDate: string,
  isPreVest: boolean = false
): Promise<void> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT u.email, s.legal_name 
       FROM users u
       JOIN shareholders s ON u.id = s.user_id
       WHERE s.id = $1`,
      [shareholderId]
    );

    if (result.rows.length === 0) return;

    const user = result.rows[0];
    const subject = isPreVest 
      ? `Upcoming RSU Vesting: ${unitsVested} units on ${vestingDate}`
      : `RSU Vested: ${unitsVested} units`;

    const html = generateRSUVestingEmail(
      user.legal_name,
      unitsVested,
      vestingDate,
      isPreVest
    );

    await queueEmail({
      to: user.email,
      subject,
      html,
    });
  } finally {
    client.release();
  }
}

/**
 * Send welcome email to new shareholder
 */
export async function sendWelcomeEmail(
  email: string,
  name: string,
  temporaryPassword: string
): Promise<void> {
  const html = generateWelcomeEmail(name, temporaryPassword);

  await queueEmail({
    to: email,
    subject: 'Welcome to Buxton Helmsley Investor Portal',
    html,
  });
}

// Email Templates

function generateDocumentNotificationEmail(title: string, type: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 3px solid #1a1a1a; padding-bottom: 20px; margin-bottom: 30px; }
    .button { display: inline-block; padding: 12px 24px; background: #1a1a1a; color: #fff; text-decoration: none; border-radius: 4px; margin: 20px 0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">Buxton Helmsley</h1>
    </div>
    
    <h2>New Document Available</h2>
    
    <p>A new ${type} has been uploaded to the investor portal:</p>
    
    <p><strong>${title}</strong></p>
    
    <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" class="button">View Document</a>
    
    <p>If you have any questions, please contact us at ir@buxtonhelmsley.com</p>
    
    <div class="footer">
      <p>This is an automated message from Buxton Helmsley Investor Relations.</p>
      <p>© ${new Date().getFullYear()} Buxton Helmsley, Inc. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
}

function generateRSUVestingEmail(
  name: string,
  units: number,
  date: string,
  isPreVest: boolean
): string {
  const message = isPreVest
    ? `This is a reminder that ${units.toLocaleString()} RSUs are scheduled to vest on ${date}.`
    : `${units.toLocaleString()} RSUs have vested as of ${date}.`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 3px solid #1a1a1a; padding-bottom: 20px; margin-bottom: 30px; }
    .highlight { background: #f5f5f5; padding: 15px; border-left: 4px solid #1a1a1a; margin: 20px 0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">Buxton Helmsley</h1>
    </div>
    
    <h2>${isPreVest ? 'Upcoming' : 'Completed'} RSU Vesting</h2>
    
    <p>Dear ${name},</p>
    
    <div class="highlight">
      <p style="margin: 0;">${message}</p>
    </div>
    
    <p>You can view your complete vesting schedule in the investor portal.</p>
    
    <p>If you have any questions about your RSU grant, please contact ir@buxtonhelmsley.com</p>
    
    <div class="footer">
      <p>This is an automated message from Buxton Helmsley Investor Relations.</p>
      <p>© ${new Date().getFullYear()} Buxton Helmsley, Inc. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
}

function generateWelcomeEmail(name: string, tempPassword: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 3px solid #1a1a1a; padding-bottom: 20px; margin-bottom: 30px; }
    .credentials { background: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0; }
    .button { display: inline-block; padding: 12px 24px; background: #1a1a1a; color: #fff; text-decoration: none; border-radius: 4px; margin: 20px 0; }
    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">Buxton Helmsley</h1>
    </div>
    
    <h2>Welcome to the Investor Portal</h2>
    
    <p>Dear ${name},</p>
    
    <p>Your account has been created for the Buxton Helmsley Investor Portal. You now have access to quarterly financial statements, investor letters, and other important disclosures.</p>
    
    <div class="credentials">
      <p><strong>Temporary Password:</strong> ${tempPassword}</p>
    </div>
    
    <div class="warning">
      <p><strong>Important:</strong> Please change your password immediately after your first login. We also strongly recommend enabling two-factor authentication (MFA) for additional security.</p>
    </div>
    
    <a href="${process.env.NEXT_PUBLIC_APP_URL}/auth/signin" class="button">Access Portal</a>
    
    <p>If you have any questions or need assistance, please contact us at ir@buxtonhelmsley.com</p>
    
    <div class="footer">
      <p>This is an automated message from Buxton Helmsley Investor Relations.</p>
      <p>© ${new Date().getFullYear()} Buxton Helmsley, Inc. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}
