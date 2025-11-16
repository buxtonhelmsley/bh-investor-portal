"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Upload } from "lucide-react";
import { formatShortDate } from "@/lib/utils";
import Link from "next/link";

interface Document {
  id: string;
  title: string;
  description?: string;
  document_type: string;
  access_level: string;
  file_size: number;
  period_start?: string;
  period_end?: string;
  is_audited: boolean;
  annotation?: string;
  uploaded_at: string;
}

export default function DocumentsPage() {
  const { data: session } = useSession();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const canUpload = session?.user?.role === "admin_edit";

  useEffect(() => {
    async function fetchDocuments() {
      try {
        const res = await fetch("/api/documents");
        const data = await res.json();
        setDocuments(data.documents || []);
      } catch (error) {
        console.error("Error fetching documents:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDocuments();
  }, []);

  const documentTypes = [
    { value: "all", label: "All Documents" },
    { value: "financial_statement", label: "Financial Statements" },
    { value: "quarterly_letter", label: "Quarterly Letters" },
    { value: "material_disclosure", label: "Material Disclosures" },
    { value: "board_minutes", label: "Board Minutes" },
  ];

  const filteredDocuments = documents.filter(
    (doc) => filter === "all" || doc.document_type === filter
  );

  const getDocumentTypeLabel = (type: string) => {
    return type.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading documents...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bh-header flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Documents</h1>
          <p className="text-gray-600 mt-1">Financial statements and investor communications</p>
        </div>
        {canUpload && (
          <Link href="/admin/documents/upload">
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </Link>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {documentTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => setFilter(type.value)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                filter === type.value
                  ? "border-black text-black"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {type.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Documents Grid */}
      {filteredDocuments.length > 0 ? (
        <div className="grid gap-6">
          {filteredDocuments.map((doc) => (
            <Card key={doc.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <FileText className="h-6 w-6 text-gray-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{doc.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {doc.description || "No description"}
                      </CardDescription>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                        <span>{getDocumentTypeLabel(doc.document_type)}</span>
                        <span>•</span>
                        <span>{formatFileSize(doc.file_size)}</span>
                        <span>•</span>
                        <span>{formatShortDate(doc.uploaded_at)}</span>
                        {doc.is_audited && (
                          <>
                            <span>•</span>
                            <span className="text-green-600 font-medium">Audited</span>
                          </>
                        )}
                      </div>
                      {doc.period_start && doc.period_end && (
                        <div className="mt-1 text-sm text-gray-500">
                          Period: {formatShortDate(doc.period_start)} - {formatShortDate(doc.period_end)}
                        </div>
                      )}
                      {doc.annotation && (
                        <div className="mt-2 p-3 bg-blue-50 border-l-4 border-blue-400 text-sm">
                          <p className="font-medium text-blue-900">Note:</p>
                          <p className="text-blue-800 mt-1">{doc.annotation}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <a
                    href={`/api/documents/${doc.id}/download`}
                    download
                  >
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </a>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500 text-center">
              {filter === "all"
                ? "No documents available yet"
                : `No ${documentTypes.find(t => t.value === filter)?.label.toLowerCase()} available`}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
