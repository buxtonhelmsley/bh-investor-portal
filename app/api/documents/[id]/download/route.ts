import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, logDocumentAccess } from '@/lib/database';
import { decryptFile } from '@/lib/encryption';
import { readFile } from 'fs/promises';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const documentId = params.id;

    // Get document details
    const documents = await query<any>(
      `SELECT * FROM documents WHERE id = $1`,
      [documentId]
    );

    if (documents.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const document = documents[0];

    // Check access level
    const userRole = session.user.role;
    const canAccess = 
      document.access_level === 'all_shareholders' ||
      ['admin_edit', 'admin_view', 'board_member'].includes(userRole);

    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Decrypt file
    const decryptedBuffer = await decryptFile(document.file_path);

    // Log access
    await logDocumentAccess(
      session.user.id,
      documentId,
      'download',
      {
        title: document.title,
        size: document.file_size,
      }
    );

    // Determine content type
    let contentType = 'application/octet-stream';
    if (document.title.endsWith('.pdf')) {
      contentType = 'application/pdf';
    } else if (document.title.endsWith('.docx')) {
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (document.title.endsWith('.xlsx')) {
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    // Return decrypted file
    return new NextResponse(decryptedBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${document.title}"`,
        'Content-Length': decryptedBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('Document download error:', error);
    return NextResponse.json(
      { error: 'Failed to download document' },
      { status: 500 }
    );
  }
}
