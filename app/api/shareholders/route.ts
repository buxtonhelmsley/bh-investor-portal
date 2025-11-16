import { NextRequest, NextResponse } from 'next/server';
import { auth, requireEditAccess, requireRole } from '@/lib/auth';
import { 
  query, 
  createShareholder, 
  updateShareholder,
  getShareholderById,
  getShareholderInvestments,
  getShareholderRSUs 
} from '@/lib/database';
import { hashPassword, generateSecureToken } from '@/lib/encryption';
import { sendWelcomeEmail } from '@/lib/email';

// GET all shareholders (admin/board only)
export async function GET(request: NextRequest) {
  try {
    await requireRole(['admin_edit', 'admin_view', 'board_member']);

    const shareholders = await query(
      `SELECT s.*, u.email, u.secondary_email, u.is_active, u.role
       FROM shareholders s
       JOIN users u ON s.user_id = u.id
       ORDER BY s.legal_name ASC`
    );

    return NextResponse.json({ shareholders });
  } catch (error) {
    console.error('Get shareholders error:', error);
    
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch shareholders' },
      { status: 500 }
    );
  }
}

// POST create new shareholder
export async function POST(request: NextRequest) {
  try {
    const session = await requireEditAccess();

    const body = await request.json();
    const {
      email,
      secondary_email,
      legal_name,
      shareholder_type,
      tax_id,
      phone_number,
      mailing_address,
      is_erisa_subject,
      is_accredited_verified,
      internal_notes,
    } = body;

    // Validate required fields
    if (!email || !legal_name || !shareholder_type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existing = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      );
    }

    // Generate temporary password
    const temporaryPassword = generateSecureToken(16);
    const passwordHash = await hashPassword(temporaryPassword);

    // Create user account
    const userResult = await query<any>(
      `INSERT INTO users (email, secondary_email, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'shareholder', TRUE)
       RETURNING id`,
      [email, secondary_email, passwordHash]
    );

    const userId = userResult[0].id;

    // Create shareholder record
    const shareholderId = await createShareholder({
      user_id: userId,
      legal_name,
      shareholder_type,
      tax_id,
      phone_number,
      mailing_address,
      is_erisa_subject,
      is_accredited_verified,
      internal_notes,
    });

    // Send welcome email with temporary password
    await sendWelcomeEmail(email, legal_name, temporaryPassword);

    // Log the creation
    await query(
      `INSERT INTO access_logs (user_id, action, metadata)
       VALUES ($1, 'shareholder_created', $2)`,
      [
        session.user.id,
        JSON.stringify({ 
          shareholder_id: shareholderId, 
          email, 
          legal_name 
        })
      ]
    );

    return NextResponse.json({
      success: true,
      shareholderId,
      userId,
      message: 'Shareholder created successfully. Welcome email sent.',
    });

  } catch (error) {
    console.error('Create shareholder error:', error);
    
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    return NextResponse.json(
      { error: 'Failed to create shareholder' },
      { status: 500 }
    );
  }
}
