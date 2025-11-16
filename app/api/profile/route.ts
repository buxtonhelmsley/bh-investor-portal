import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { 
  getShareholderByUserId, 
  getShareholderInvestments, 
  getShareholderRSUs 
} from '@/lib/database';

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const shareholder = await getShareholderByUserId(session.user.id);

    if (!shareholder) {
      return NextResponse.json({
        message: 'No shareholder profile found',
      });
    }

    const investments = await getShareholderInvestments(shareholder.id);
    const rsuGrants = await getShareholderRSUs(shareholder.id);

    // Remove internal notes from shareholder data
    const { internal_notes, ...shareholderData } = shareholder;

    return NextResponse.json({
      shareholder: shareholderData,
      investments,
      rsuGrants,
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}
