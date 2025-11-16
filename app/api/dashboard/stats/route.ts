import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, getCompanyStats, getShareholderByUserId, getShareholderInvestments } from '@/lib/database';
import { getVestingSummary } from '@/lib/rsu';

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = session.user.role === 'admin_edit' || session.user.role === 'admin_view';
    const isBoard = session.user.role === 'board_member';

    const stats: any = {};

    // Get company-wide stats for admins and board members
    if (isAdmin || isBoard) {
      const companyStats = await getCompanyStats();
      stats.shareholderStats = {
        totalShareholders: companyStats.total_shareholders,
        lastValuation: parseFloat(companyStats.last_valuation),
      };
    }

    // Get personal stats for shareholders
    if (!isAdmin && !isBoard) {
      const shareholder = await getShareholderByUserId(session.user.id);
      
      if (shareholder) {
        const investments = await getShareholderInvestments(shareholder.id);
        const vestingSummary = await getVestingSummary(shareholder.id);

        const totalInvested = investments
          .filter(inv => inv.status === 'active')
          .reduce((sum, inv) => sum + parseFloat(inv.amount.toString()), 0);

        const shareCount = investments
          .filter(inv => inv.status === 'active')
          .reduce((sum, inv) => sum + parseFloat(inv.shares_issued.toString()), 0);

        stats.personalStats = {
          totalInvested,
          shareCount,
          rsuVested: vestingSummary.totalVested,
          rsuUnvested: vestingSummary.totalUnvested,
        };
      }
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
