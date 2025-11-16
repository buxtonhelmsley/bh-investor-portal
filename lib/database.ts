import { Pool, PoolClient } from 'pg';
import { encryptText, decryptText } from './encryption';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export interface Shareholder {
  id: string;
  user_id: string;
  legal_name: string;
  shareholder_type: string;
  tax_id?: string;
  phone_number?: string;
  mailing_address?: string;
  is_erisa_subject: boolean;
  is_accredited_verified: boolean;
  internal_notes?: string;
  email: string;
  secondary_email?: string;
}

export interface Investment {
  id: string;
  shareholder_id: string;
  share_class_id: string;
  share_class_name: string;
  investment_date: string;
  amount: number;
  shares_issued: number;
  price_per_share: number;
  valuation_at_investment: number;
  status: string;
}

export interface Document {
  id: string;
  title: string;
  description?: string;
  document_type: string;
  access_level: string;
  file_path: string;
  file_size: number;
  period_start?: string;
  period_end?: string;
  is_audited: boolean;
  annotation?: string;
  uploaded_at: string;
}

export interface RSUGrant {
  id: string;
  shareholder_id: string;
  share_class_id: string;
  grant_date: string;
  total_units: number;
  vesting_start_date: string;
  vesting_cliff_months: number;
  vesting_duration_months: number;
  vesting_frequency: string;
  status: string;
  units_vested: number;
  units_unvested: number;
}

/**
 * Get database client from pool
 */
export async function getClient(): Promise<PoolClient> {
  return await pool.connect();
}

/**
 * Execute query with automatic client handling
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Get shareholder by ID with decrypted sensitive data
 */
export async function getShareholderById(
  id: string
): Promise<Shareholder | null> {
  const result = await query<any>(
    `SELECT s.*, u.email, u.secondary_email 
     FROM shareholders s
     JOIN users u ON s.user_id = u.id
     WHERE s.id = $1`,
    [id]
  );

  if (result.length === 0) return null;

  const shareholder = result[0];
  
  // Decrypt tax ID if present
  if (shareholder.tax_id_encrypted) {
    shareholder.tax_id = decryptText(shareholder.tax_id_encrypted);
    delete shareholder.tax_id_encrypted;
  }

  return shareholder;
}

/**
 * Get shareholder by user ID
 */
export async function getShareholderByUserId(
  userId: string
): Promise<Shareholder | null> {
  const result = await query<any>(
    `SELECT s.*, u.email, u.secondary_email 
     FROM shareholders s
     JOIN users u ON s.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );

  if (result.length === 0) return null;

  const shareholder = result[0];
  
  if (shareholder.tax_id_encrypted) {
    shareholder.tax_id = decryptText(shareholder.tax_id_encrypted);
    delete shareholder.tax_id_encrypted;
  }

  return shareholder;
}

/**
 * Get all investments for a shareholder
 */
export async function getShareholderInvestments(
  shareholderId: string
): Promise<Investment[]> {
  return await query<Investment>(
    `SELECT i.*, sc.class_name as share_class_name
     FROM investments i
     JOIN share_classes sc ON i.share_class_id = sc.id
     WHERE i.shareholder_id = $1
     ORDER BY i.investment_date DESC`,
    [shareholderId]
  );
}

/**
 * Get all RSU grants for a shareholder
 */
export async function getShareholderRSUs(
  shareholderId: string
): Promise<RSUGrant[]> {
  return await query<RSUGrant>(
    `SELECT rg.*, rv.units_vested, rv.units_unvested
     FROM rsu_grants rg
     LEFT JOIN rsu_vested_summary rv ON rg.id = rv.grant_id
     WHERE rg.shareholder_id = $1
     ORDER BY rg.grant_date DESC`,
    [shareholderId]
  );
}

/**
 * Get documents accessible to a user
 */
export async function getAccessibleDocuments(
  userRole: string
): Promise<Document[]> {
  let accessLevels = ['all_shareholders'];
  
  if (['admin_edit', 'admin_view', 'board_member'].includes(userRole)) {
    accessLevels.push('board_and_management_only');
  }

  return await query<Document>(
    `SELECT id, title, description, document_type, access_level, 
            file_size, period_start, period_end, is_audited, 
            annotation, uploaded_at
     FROM documents
     WHERE access_level = ANY($1)
     ORDER BY uploaded_at DESC`,
    [accessLevels]
  );
}

/**
 * Log document access
 */
export async function logDocumentAccess(
  userId: string,
  documentId: string,
  action: 'view' | 'download',
  metadata?: any
): Promise<void> {
  await query(
    `INSERT INTO access_logs (user_id, document_id, action, metadata)
     VALUES ($1, $2, $3, $4)`,
    [userId, documentId, action, metadata ? JSON.stringify(metadata) : null]
  );
}

/**
 * Get cap table summary
 */
export async function getCapTableSummary(): Promise<any[]> {
  return await query(
    `SELECT * FROM cap_table_summary ORDER BY share_class_id`
  );
}

/**
 * Get company statistics
 */
export async function getCompanyStats(): Promise<{
  total_shareholders: number;
  last_valuation: number;
  total_capital_raised: number;
}> {
  const result = await query<any>(
    `SELECT 
      (SELECT COUNT(DISTINCT id) FROM shareholders) as total_shareholders,
      (SELECT value::numeric FROM system_config WHERE key = 'last_valuation') as last_valuation,
      (SELECT COALESCE(SUM(amount), 0) FROM investments WHERE status = 'active') as total_capital_raised`
  );

  return result[0];
}

/**
 * Get access logs for a user
 */
export async function getUserAccessLogs(
  userId: string,
  limit: number = 100
): Promise<any[]> {
  const client = await pool.connect();
  try {
    // Check user role to determine retention period
    const userResult = await client.query(
      `SELECT role FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) return [];

    const role = userResult.rows[0].role;
    const isInsider = ['admin_edit', 'admin_view', 'board_member'].includes(role);
    
    let query = `
      SELECT al.*, d.title as document_title
      FROM access_logs al
      LEFT JOIN documents d ON al.document_id = d.id
      WHERE al.user_id = $1
    `;

    // Apply retention policy
    if (!isInsider) {
      query += ` AND al.created_at >= CURRENT_DATE - INTERVAL '7 years'`;
    }

    query += ` ORDER BY al.created_at DESC LIMIT $2`;

    const result = await client.query(query, [userId, limit]);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Create new shareholder
 */
export async function createShareholder(data: {
  user_id: string;
  legal_name: string;
  shareholder_type: string;
  tax_id?: string;
  phone_number?: string;
  mailing_address?: string;
  is_erisa_subject?: boolean;
  is_accredited_verified?: boolean;
  internal_notes?: string;
}): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Encrypt tax ID if provided
    const taxIdEncrypted = data.tax_id ? encryptText(data.tax_id) : null;

    const result = await client.query(
      `INSERT INTO shareholders 
       (user_id, legal_name, shareholder_type, tax_id_encrypted, phone_number, 
        mailing_address, is_erisa_subject, is_accredited_verified, internal_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        data.user_id,
        data.legal_name,
        data.shareholder_type,
        taxIdEncrypted,
        data.phone_number,
        data.mailing_address,
        data.is_erisa_subject || false,
        data.is_accredited_verified || false,
        data.internal_notes,
      ]
    );

    await client.query('COMMIT');
    return result.rows[0].id;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update shareholder
 */
export async function updateShareholder(
  id: string,
  data: Partial<Shareholder>
): Promise<void> {
  const client = await pool.connect();
  try {
    // Encrypt tax ID if being updated
    if (data.tax_id) {
      (data as any).tax_id_encrypted = encryptText(data.tax_id);
      delete data.tax_id;
    }

    const fields = Object.keys(data)
      .filter(key => key !== 'id' && key !== 'user_id')
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');

    const values = Object.keys(data)
      .filter(key => key !== 'id' && key !== 'user_id')
      .map(key => (data as any)[key]);

    if (fields.length > 0) {
      await client.query(
        `UPDATE shareholders SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [id, ...values]
      );
    }
  } finally {
    client.release();
  }
}

/**
 * Create investment
 */
export async function createInvestment(data: {
  shareholder_id: string;
  share_class_id: string;
  investment_date: string;
  amount: number;
  shares_issued: number;
  price_per_share: number;
  valuation_at_investment: number;
  document_paths?: string[];
  notes?: string;
}): Promise<string> {
  const result = await query<any>(
    `INSERT INTO investments 
     (shareholder_id, share_class_id, investment_date, amount, shares_issued, 
      price_per_share, valuation_at_investment, document_paths, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      data.shareholder_id,
      data.share_class_id,
      data.investment_date,
      data.amount,
      data.shares_issued,
      data.price_per_share,
      data.valuation_at_investment,
      data.document_paths || [],
      data.notes,
    ]
  );

  return result[0].id;
}

/**
 * Check if pool is healthy
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const result = await query('SELECT 1');
    return result.length > 0;
  } catch {
    return false;
  }
}

/**
 * Close database pool
 */
export async function closePool(): Promise<void> {
  await pool.end();
}
