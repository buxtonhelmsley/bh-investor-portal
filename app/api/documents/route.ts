import { NextRequest, NextResponse } from 'next/server';
import { auth, requireEditAccess } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { encryptFile, generateFileHash, sanitizeFilename } from '@/lib/encryption';
import { query } from '@/lib/database';
import { notifyNewDocument } from '@/lib/email';
import { nanoid } from 'nanoid';

export async function POST(request: NextRequest) {
  try {
    // Check authentication and edit access
    const session = await requireEditAccess();

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const documentType = formData.get('documentType') as string;
    const accessLevel = formData.get('accessLevel') as string || 'all_shareholders';
    const periodStart = formData.get('periodStart') as string;
    const periodEnd = formData.get('periodEnd') as string;
    const isAudited = formData.get('isAudited') === 'true';
    const annotation = formData.get('annotation') as string;

    if (!file || !title || !documentType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check file size
    const maxSize = parseInt(process.env.MAX_FILE_SIZE || '104857600'); // 100MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large' },
        { status: 400 }
      );
    }

    // Validate file type (only allow PDFs and common document types)
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF, DOCX, and XLSX files are allowed.' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate file hash
    const fileHash = generateFileHash(buffer);

    // Generate unique filename
    const fileId = nanoid();
    const sanitizedOriginalName = sanitizeFilename(file.name);
    const tempFilename = `${fileId}_${sanitizedOriginalName}`;
    const encryptedFilename = `${fileId}.enc`;

    // Ensure upload directory exists
    const uploadsDir = process.env.UPLOADS_PATH || '/var/www/investor-portal/storage/uploads';
    const documentsDir = process.env.DOCUMENTS_PATH || '/var/www/investor-portal/storage/documents';
    
    await mkdir(uploadsDir, { recursive: true });
    await mkdir(documentsDir, { recursive: true });

    // Save temp file
    const tempPath = join(uploadsDir, tempFilename);
    await writeFile(tempPath, buffer);

    // Encrypt file
    const encryptedPath = join(documentsDir, encryptedFilename);
    await encryptFile(tempPath, encryptedPath);

    // Delete temp file
    const { unlink } = await import('fs/promises');
    await unlink(tempPath);

    // Save to database
    const result = await query<any>(
      `INSERT INTO documents 
       (title, description, document_type, access_level, file_path, 
        file_size, file_hash, period_start, period_end, is_audited, 
        annotation, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        title,
        description,
        documentType,
        accessLevel,
        encryptedPath,
        file.size,
        fileHash,
        periodStart || null,
        periodEnd || null,
        isAudited,
        annotation,
        session.user.id,
      ]
    );

    const documentId = result[0].id;

    // Send notifications to shareholders if accessible to all
    if (accessLevel === 'all_shareholders') {
      await notifyNewDocument(documentId, title, documentType);
    }

    return NextResponse.json({
      success: true,
      documentId,
      message: 'Document uploaded successfully',
    });

  } catch (error) {
    console.error('Document upload error:', error);
    
    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }

    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get documents based on user role
    let accessLevels = ['all_shareholders'];
    
    if (['admin_edit', 'admin_view', 'board_member'].includes(session.user.role)) {
      accessLevels.push('board_and_management_only');
    }

    const documents = await query(
      `SELECT id, title, description, document_type, access_level, 
              file_size, period_start, period_end, is_audited, 
              annotation, uploaded_at
       FROM documents
       WHERE access_level = ANY($1)
       ORDER BY uploaded_at DESC`,
      [accessLevels]
    );

    return NextResponse.json({ documents });

  } catch (error) {
    console.error('Document fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}
