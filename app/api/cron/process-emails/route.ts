import { NextResponse } from 'next/server';
import { processEmailQueue } from '@/lib/email';

export async function GET() {
  try {
    await processEmailQueue();
    
    return NextResponse.json({
      success: true,
      message: 'Email queue processed successfully',
    });
  } catch (error) {
    console.error('Email queue processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process email queue' },
      { status: 500 }
    );
  }
}
