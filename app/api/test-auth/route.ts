import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// DEBUG ROUTE - DELETE AFTER FIXING LOGIN
// Visit: /api/test-auth to check database and password

export async function GET() {
  try {
    const client = await getDbClient();
    
    try {
      // Get user
      const result = await client.query(
        'SELECT id, email, password_hash, role, is_active FROM users WHERE email = $1',
        ['alexander@buxtonhelmsley.com']
      );

      if (result.rows.length === 0) {
        return NextResponse.json({
          error: 'User not found',
          debug: 'No user with email alexander@buxtonhelmsley.com exists in database'
        }, { status: 404 });
      }

      const user = result.rows[0];

      // Test password
      const testPassword = 'Password123!';
      const isMatch = await bcrypt.compare(testPassword, user.password_hash);

      return NextResponse.json({
        success: true,
        database: {
          connected: true,
          userExists: true,
          email: user.email,
          role: user.role,
          isActive: user.is_active,
          hashPreview: user.password_hash.substring(0, 30) + '...',
          hashAlgorithm: user.password_hash.substring(0, 4),
        },
        passwordTest: {
          testPassword: testPassword,
          matches: isMatch,
          bcryptVersion: 'bcryptjs',
        },
        message: isMatch 
          ? '✅ Password matches! Login should work with Password123!'
          : '❌ Password does NOT match. Hash might be wrong.',
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    return NextResponse.json({
      error: 'Database connection failed',
      details: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}

// Also test with POST to simulate login
export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    
    const client = await getDbClient();
    
    try {
      const result = await client.query(
        'SELECT password_hash FROM users WHERE email = $1',
        ['alexander@buxtonhelmsley.com']
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const user = result.rows[0];
      const isMatch = await bcrypt.compare(password, user.password_hash);

      return NextResponse.json({
        passwordProvided: password,
        matches: isMatch,
        message: isMatch ? '✅ Correct password!' : '❌ Wrong password',
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
    }, { status: 500 });
  }
}
