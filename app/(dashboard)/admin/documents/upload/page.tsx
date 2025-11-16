"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Upload } from "lucide-react";
import Link from "next/link";

export default function UploadDocumentPage() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    documentType: "financial_statement",
    accessLevel: "all_shareholders",
    periodStart: "",
    periodEnd: "",
    isAudited: false,
    annotation: "",
  });

  const handleFileUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setUploading(true);

    try {
      const form = e.currentTarget;
      const fileInput = form.elements.namedItem("file") as HTMLInputElement;
      const file = fileInput.files?.[0];

      if (!file) {
        setError("Please select a file");
        return;
      }

      const data = new FormData();
      data.append("file", file);
      data.append("title", formData.title);
      data.append("description", formData.description);
      data.append("documentType", formData.documentType);
      data.append("accessLevel", formData.accessLevel);
      data.append("periodStart", formData.periodStart);
      data.append("periodEnd", formData.periodEnd);
      data.append("isAudited", formData.isAudited.toString());
      data.append("annotation", formData.annotation);

      const res = await fetch("/api/documents", {
        method: "POST",
        body: data,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Upload failed");
      }

      router.push("/documents");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center space-x-4">
        <Link href="/documents">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>

      <div className="bh-header">
        <h1 className="text-3xl font-bold">Upload Document</h1>
        <p className="text-gray-600 mt-1">
          Upload financial statements, quarterly letters, or other investor communications
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Document Details</CardTitle>
          <CardDescription>
            All documents are automatically encrypted before storage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleFileUpload} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <Label htmlFor="file">File (PDF, DOCX, or XLSX only)</Label>
                <Input
                  id="file"
                  name="file"
                  type="file"
                  accept=".pdf,.docx,.xlsx"
                  required
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">Maximum file size: 100MB</p>
              </div>

              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  placeholder="Q3 2024 Financial Statements"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Unaudited quarterly financial statements for Q3 2024..."
                  className="mt-1 flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="documentType">Document Type *</Label>
                  <select
                    id="documentType"
                    value={formData.documentType}
                    onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
                    className="mt-1 flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                  >
                    <option value="financial_statement">Financial Statement</option>
                    <option value="quarterly_letter">Quarterly Letter</option>
                    <option value="material_disclosure">Material Disclosure</option>
                    <option value="board_minutes">Board Minutes</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="accessLevel">Access Level *</Label>
                  <select
                    id="accessLevel"
                    value={formData.accessLevel}
                    onChange={(e) => setFormData({ ...formData, accessLevel: e.target.value })}
                    className="mt-1 flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                  >
                    <option value="all_shareholders">All Shareholders</option>
                    <option value="board_and_management_only">Board & Management Only</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="periodStart">Period Start</Label>
                  <Input
                    id="periodStart"
                    type="date"
                    value={formData.periodStart}
                    onChange={(e) => setFormData({ ...formData, periodStart: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="periodEnd">Period End</Label>
                  <Input
                    id="periodEnd"
                    type="date"
                    value={formData.periodEnd}
                    onChange={(e) => setFormData({ ...formData, periodEnd: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  id="isAudited"
                  type="checkbox"
                  checked={formData.isAudited}
                  onChange={(e) => setFormData({ ...formData, isAudited: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="isAudited" className="cursor-pointer">
                  This document has been audited
                </Label>
              </div>

              <div>
                <Label htmlFor="annotation">Internal Annotation (visible to admins/board only)</Label>
                <textarea
                  id="annotation"
                  value={formData.annotation}
                  onChange={(e) => setFormData({ ...formData, annotation: e.target.value })}
                  placeholder="Note: Q3 results reflect Fossil board seat impact..."
                  className="mt-1 flex min-h-[60px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-4">
              <Link href="/documents">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={uploading}>
                {uploading ? (
                  "Uploading..."
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Document
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
