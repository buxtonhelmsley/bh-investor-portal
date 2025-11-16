import { Pool } from 'pg';
import { addMonths, addYears, differenceInMonths, isAfter, isBefore, format } from 'date-fns';
import { notifyRSUVesting } from './email';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

interface VestingSchedule {
  vestingDate: Date;
  unitsToVest: number;
  isProjected: boolean;
}

/**
 * Calculate complete vesting schedule for an RSU grant
 */
export function calculateVestingSchedule(
  grantDate: Date,
  vestingStartDate: Date,
  totalUnits: number,
  cliffMonths: number,
  durationMonths: number,
  frequency: 'monthly' | 'quarterly' | 'annually'
): VestingSchedule[] {
  const schedule: VestingSchedule[] = [];
  const today = new Date();
  
  // Determine vesting interval
  let intervalMonths: number;
  switch (frequency) {
    case 'monthly':
      intervalMonths = 1;
      break;
    case 'quarterly':
      intervalMonths = 3;
      break;
    case 'annually':
      intervalMonths = 12;
      break;
    default:
      intervalMonths = 1;
  }
  
  // Calculate number of vesting events
  const totalVestingEvents = Math.floor(durationMonths / intervalMonths);
  const unitsPerEvent = totalUnits / totalVestingEvents;
  
  // Generate vesting schedule
  for (let i = 0; i < totalVestingEvents; i++) {
    const monthsFromStart = (i + 1) * intervalMonths;
    
    // Skip if before cliff
    if (monthsFromStart < cliffMonths) continue;
    
    const vestingDate = addMonths(vestingStartDate, monthsFromStart);
    const isProjected = isAfter(vestingDate, today);
    
    // If cliff hasn't been reached yet, accumulate units
    let unitsToVest = unitsPerEvent;
    if (i === Math.floor(cliffMonths / intervalMonths) && cliffMonths > 0) {
      // First vesting after cliff includes accumulated units
      const eventsBeforeCliff = Math.floor(cliffMonths / intervalMonths);
      unitsToVest = unitsPerEvent * (eventsBeforeCliff + 1);
    }
    
    schedule.push({
      vestingDate,
      unitsToVest,
      isProjected,
    });
  }
  
  return schedule;
}

/**
 * Create RSU grant and generate vesting schedule
 */
export async function createRSUGrant(data: {
  shareholderId: string;
  shareClassId: string;
  grantDate: string;
  totalUnits: number;
  vestingStartDate: string;
  vestingCliffMonths: number;
  vestingDurationMonths: number;
  vestingFrequency: 'monthly' | 'quarterly' | 'annually';
  grantDocumentPath?: string;
  notes?: string;
}): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create grant
    const grantResult = await client.query(
      `INSERT INTO rsu_grants 
       (shareholder_id, share_class_id, grant_date, total_units, 
        vesting_start_date, vesting_cliff_months, vesting_duration_months, 
        vesting_frequency, grant_document_path, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')
       RETURNING id`,
      [
        data.shareholderId,
        data.shareClassId,
        data.grantDate,
        data.totalUnits,
        data.vestingStartDate,
        data.vestingCliffMonths,
        data.vestingDurationMonths,
        data.vestingFrequency,
        data.grantDocumentPath,
        data.notes,
      ]
    );

    const grantId = grantResult.rows[0].id;

    // Calculate and insert vesting schedule
    const schedule = calculateVestingSchedule(
      new Date(data.grantDate),
      new Date(data.vestingStartDate),
      data.totalUnits,
      data.vestingCliffMonths,
      data.vestingDurationMonths,
      data.vestingFrequency
    );

    for (const event of schedule) {
      await client.query(
        `INSERT INTO rsu_vesting_events 
         (grant_id, vesting_date, units_vested, is_projected)
         VALUES ($1, $2, $3, $4)`,
        [
          grantId,
          format(event.vestingDate, 'yyyy-MM-dd'),
          event.unitsToVest,
          event.isProjected,
        ]
      );
    }

    await client.query('COMMIT');
    return grantId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Cancel RSU grant
 */
export async function cancelRSUGrant(
  grantId: string,
  reason: string
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE rsu_grants 
       SET status = 'cancelled', 
           cancellation_date = CURRENT_DATE,
           cancellation_reason = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [reason, grantId]
    );
  } finally {
    client.release();
  }
}

/**
 * Process vesting events (should be run daily via cron)
 */
export async function processVestingEvents(): Promise<void> {
  if (process.env.ENABLE_RSU_AUTO_CALCULATION !== 'true') {
    console.log('RSU auto-calculation disabled');
    return;
  }

  const client = await pool.connect();
  try {
    const today = format(new Date(), 'yyyy-MM-dd');

    // Find all vesting events that occurred today and haven't been notified
    const vestingToday = await client.query(
      `SELECT ve.*, rg.shareholder_id, rg.total_units
       FROM rsu_vesting_events ve
       JOIN rsu_grants rg ON ve.grant_id = rg.id
       WHERE ve.vesting_date = $1 
         AND ve.is_projected = FALSE
         AND ve.notification_sent = FALSE
         AND rg.status = 'active'`,
      [today]
    );

    // Send notifications for vesting events
    for (const event of vestingToday.rows) {
      await notifyRSUVesting(
        event.shareholder_id,
        event.units_vested,
        event.vesting_date,
        false // not a pre-vest notification
      );

      await client.query(
        `UPDATE rsu_vesting_events 
         SET notification_sent = TRUE 
         WHERE id = $1`,
        [event.id]
      );
    }

    console.log(`Processed ${vestingToday.rows.length} vesting events for ${today}`);
  } finally {
    client.release();
  }
}

/**
 * Process pre-vest notifications (should be run daily via cron)
 */
export async function processPreVestNotifications(): Promise<void> {
  if (process.env.ENABLE_PRE_VEST_NOTIFICATIONS !== 'true') {
    console.log('Pre-vest notifications disabled');
    return;
  }

  const client = await pool.connect();
  try {
    const preVestDays = parseInt(process.env.PRE_VEST_NOTIFICATION_DAYS || '7');
    const notificationDate = format(
      addMonths(new Date(), 0).setDate(new Date().getDate() + preVestDays),
      'yyyy-MM-dd'
    );

    // Find all vesting events that will occur in X days
    const upcomingVesting = await client.query(
      `SELECT ve.*, rg.shareholder_id, rg.total_units
       FROM rsu_vesting_events ve
       JOIN rsu_grants rg ON ve.grant_id = rg.id
       WHERE ve.vesting_date = $1 
         AND ve.is_projected = TRUE
         AND ve.pre_vest_notification_sent = FALSE
         AND rg.status = 'active'`,
      [notificationDate]
    );

    // Send pre-vest notifications
    for (const event of upcomingVesting.rows) {
      await notifyRSUVesting(
        event.shareholder_id,
        event.units_vested,
        event.vesting_date,
        true // this is a pre-vest notification
      );

      await client.query(
        `UPDATE rsu_vesting_events 
         SET pre_vest_notification_sent = TRUE 
         WHERE id = $1`,
        [event.id]
      );
    }

    console.log(`Sent ${upcomingVesting.rows.length} pre-vest notifications for ${notificationDate}`);
  } finally {
    client.release();
  }
}

/**
 * Get vesting summary for a shareholder
 */
export async function getVestingSummary(shareholderId: string): Promise<{
  totalGranted: number;
  totalVested: number;
  totalUnvested: number;
  nextVestingDate: string | null;
  nextVestingAmount: number | null;
}> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
        COALESCE(SUM(rg.total_units), 0) as total_granted,
        COALESCE(SUM(rv.units_vested), 0) as total_vested,
        COALESCE(SUM(rv.units_unvested), 0) as total_unvested
       FROM rsu_grants rg
       LEFT JOIN rsu_vested_summary rv ON rg.id = rv.grant_id
       WHERE rg.shareholder_id = $1 AND rg.status = 'active'`,
      [shareholderId]
    );

    const summary = result.rows[0];

    // Get next vesting event
    const nextVesting = await client.query(
      `SELECT ve.vesting_date, ve.units_vested
       FROM rsu_vesting_events ve
       JOIN rsu_grants rg ON ve.grant_id = rg.id
       WHERE rg.shareholder_id = $1 
         AND ve.is_projected = TRUE
         AND rg.status = 'active'
       ORDER BY ve.vesting_date ASC
       LIMIT 1`,
      [shareholderId]
    );

    return {
      totalGranted: parseFloat(summary.total_granted),
      totalVested: parseFloat(summary.total_vested),
      totalUnvested: parseFloat(summary.total_unvested),
      nextVestingDate: nextVesting.rows.length > 0 ? nextVesting.rows[0].vesting_date : null,
      nextVestingAmount: nextVesting.rows.length > 0 ? parseFloat(nextVesting.rows[0].units_vested) : null,
    };
  } finally {
    client.release();
  }
}

/**
 * Get complete vesting schedule for a grant
 */
export async function getGrantVestingSchedule(grantId: string): Promise<any[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT vesting_date, units_vested, is_projected, 
              notification_sent, pre_vest_notification_sent
       FROM rsu_vesting_events
       WHERE grant_id = $1
       ORDER BY vesting_date ASC`,
      [grantId]
    );

    return result.rows;
  } finally {
    client.release();
  }
}
