import { NextResponse } from 'next/server';
import { processVestingEvents } from '@/lib/rsu';

export async function GET() {
  try {
    await processVestingEvents();
    
    return NextResponse.json({
      success: true,
      message: 'Vesting events processed successfully',
    });
  } catch (error) {
    console.error('Vesting processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process vesting events' },
      { status: 500 }
    );
  }
}
