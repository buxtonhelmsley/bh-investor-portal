import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getCapTableSummary, getCompanyStats } from '@/lib/database';

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = session.user.role === 'admin_edit' || session.user.role === 'admin_view';
    const isBoard = session.user.role === 'board_member';

    // Get cap table summary
    const capTable = await getCapTableSummary();
    
    // Get company stats
    const stats = await getCompanyStats();

    // For shareholders, return anonymized data
    if (!isAdmin && !isBoard) {
      return NextResponse.json({
        shareClasses: capTable.map((row: any) => ({
          className: row.class_name,
          shareholderCount: parseInt(row.shareholder_count),
          // Don't show total shares or capital to regular shareholders
        })),
        totalShareholders: stats.total_shareholders,
        lastValuation: Number(stats.last_valuation),
      });
    }

    // For admins and board, return full data
    return NextResponse.json({
      shareClasses: capTable.map((row: any) => ({
        className: row.class_name,
        shareholderCount: parseInt(row.shareholder_count),
        totalShares: parseFloat(row.total_shares || 0),
        totalCapital: parseFloat(row.total_capital || 0),
      })),
      totalShareholders: stats.total_shareholders,
      lastValuation: Number(stats.last_valuation),
      totalCapitalRaised: Number(stats.total_capital_raised),
    });
  } catch (error) {
    console.error('Cap table error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cap table' },
      { status: 500 }
    );
  }
}
