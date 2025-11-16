import { NextResponse } from 'next/server';
import { processPreVestNotifications } from '@/lib/rsu';

export async function GET() {
  try {
    await processPreVestNotifications();
    
    return NextResponse.json({
      success: true,
      message: 'Pre-vest notifications processed successfully',
    });
  } catch (error) {
    console.error('Pre-vest notification processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process pre-vest notifications' },
      { status: 500 }
    );
  }
}
