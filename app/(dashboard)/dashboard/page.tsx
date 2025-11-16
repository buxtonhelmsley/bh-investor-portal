"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Users, TrendingUp, DollarSign } from "lucide-react";
import { formatCurrency, formatNumber, formatShortDate } from "@/lib/utils";

interface DashboardStats {
  totalDocuments: number;
  recentDocuments: any[];
  shareholderStats?: {
    totalShareholders: number;
    lastValuation: number;
  };
  personalStats?: {
    totalInvested: number;
    shareCount: number;
    rsuVested: number;
    rsuUnvested: number;
  };
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = session?.user?.role === "admin_edit" || session?.user?.role === "admin_view";
  const isBoard = session?.user?.role === "board_member";

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const [documentsRes, statsRes] = await Promise.all([
          fetch("/api/documents"),
          fetch("/api/dashboard/stats"),
        ]);

        const documents = await documentsRes.json();
        const dashboardStats = await statsRes.json();

        setStats({
          totalDocuments: documents.documents?.length || 0,
          recentDocuments: documents.documents?.slice(0, 5) || [],
          ...dashboardStats,
        });
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bh-header">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Welcome back, {session?.user?.email}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <FileText className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalDocuments || 0}</div>
            <p className="text-xs text-gray-500">Available to you</p>
          </CardContent>
        </Card>

        {(isAdmin || isBoard) && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Shareholders</CardTitle>
              <Users className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.shareholderStats?.totalShareholders || 0}
              </div>
              <p className="text-xs text-gray-500">Total investors</p>
            </CardContent>
          </Card>
        )}

        {(isAdmin || isBoard) && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last Valuation</CardTitle>
              <TrendingUp className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(stats?.shareholderStats?.lastValuation || 0)}
              </div>
              <p className="text-xs text-gray-500">Company valuation</p>
            </CardContent>
          </Card>
        )}

        {!isAdmin && !isBoard && stats?.personalStats && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Your Investment</CardTitle>
                <DollarSign className="h-4 w-4 text-gray-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(stats.personalStats.totalInvested)}
                </div>
                <p className="text-xs text-gray-500">
                  {formatNumber(stats.personalStats.shareCount)} shares
                </p>
              </CardContent>
            </Card>

            {stats.personalStats.rsuVested > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">RSUs Vested</CardTitle>
                  <TrendingUp className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatNumber(stats.personalStats.rsuVested)}
                  </div>
                  <p className="text-xs text-gray-500">
                    {formatNumber(stats.personalStats.rsuUnvested)} unvested
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Recent Documents */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Documents</CardTitle>
          <CardDescription>Latest financial statements and disclosures</CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.recentDocuments && stats.recentDocuments.length > 0 ? (
            <div className="space-y-4">
              {stats.recentDocuments.map((doc: any) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <FileText className="h-5 w-5 text-gray-600" />
                    <div>
                      <p className="font-medium">{doc.title}</p>
                      <p className="text-sm text-gray-500">
                        {doc.document_type.replace(/_/g, " ")} • {formatShortDate(doc.uploaded_at)}
                      </p>
                    </div>
                  </div>
                  <a
                    href={`/api/documents/${doc.id}/download`}
                    className="text-sm text-black hover:underline"
                    download
                  >
                    Download
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No documents available yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
