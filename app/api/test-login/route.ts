import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// This simulates the exact authorize() function in lib/auth.ts
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    console.log('Testing login for:', email);

    if (!email || !password) {
      return NextResponse.json({
        step: 'validation',
        error: 'Missing credentials',
      }, { status: 400 });
    }

    const client = await getDbClient();

    try {
      // Get user from database (same query as lib/auth.ts)
      const result = await client.query(
        `SELECT id, email, password_hash, role, is_active, mfa_enabled, mfa_secret 
         FROM users 
         WHERE email = $1`,
        [email]
      );

      console.log('Database query result:', result.rows.length, 'rows');

      if (result.rows.length === 0) {
        return NextResponse.json({
          step: 'database_query',
          error: 'Invalid credentials (user not found)',
        }, { status: 401 });
      }

      const user = result.rows[0];

      // Check if account is active
      if (!user.is_active) {
        return NextResponse.json({
          step: 'active_check',
          error: 'Account is disabled',
        }, { status: 401 });
      }

      // Verify password
      console.log('Comparing password...');
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      console.log('Password valid:', isValidPassword);

      if (!isValidPassword) {
        return NextResponse.json({
          step: 'password_verification',
          error: 'Invalid credentials (wrong password)',
          debug: {
            providedPassword: password,
            hashPreview: user.password_hash.substring(0, 30),
            bcryptResult: isValidPassword,
          }
        }, { status: 401 });
      }

      // Check MFA if enabled
      if (user.mfa_enabled) {
        return NextResponse.json({
          step: 'mfa_check',
          error: 'MFA is enabled but no token provided',
          note: 'This would require mfaToken in the request',
        }, { status: 401 });
      }

      // Success! This is what should be returned
      return NextResponse.json({
        success: true,
        step: 'complete',
        message: '✅ All checks passed! Login SHOULD work.',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        }
      });

    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Error in test:', error);
    return NextResponse.json({
      step: 'error',
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}

// Test with GET
export async function GET() {
  return NextResponse.json({
    message: 'Send POST request with { "email": "...", "password": "..." }',
    example: {
      method: 'POST',
      body: {
        email: 'alexander@buxtonhelmsley.com',
        password: 'Password123!'
      }
    }
  });
}
