"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";

interface CapTableData {
  shareClasses: {
    className: string;
    shareholderCount: number;
    totalShares?: number;
    totalCapital?: number;
  }[];
  totalShareholders: number;
  lastValuation: number;
  totalCapitalRaised?: number;
}

export default function CapTablePage() {
  const { data: session } = useSession();
  const [capTable, setCapTable] = useState<CapTableData | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = session?.user?.role === "admin_edit" || session?.user?.role === "admin_view";
  const isBoard = session?.user?.role === "board_member";
  const canSeeDetails = isAdmin || isBoard;

  useEffect(() => {
    async function fetchCapTable() {
      try {
        const res = await fetch("/api/cap-table");
        const data = await res.json();
        setCapTable(data);
      } catch (error) {
        console.error("Error fetching cap table:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchCapTable();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading cap table...</div>
      </div>
    );
  }

  if (!capTable) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Failed to load cap table</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bh-header">
        <h1 className="text-3xl font-bold">Cap Table</h1>
        <p className="text-gray-600 mt-1">
          Company ownership structure and capitalization
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Shareholders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{capTable.totalShareholders}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              Last Valuation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatCurrency(capTable.lastValuation)}
            </div>
          </CardContent>
        </Card>

        {canSeeDetails && capTable.totalCapitalRaised !== undefined && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Capital Raised
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatCurrency(capTable.totalCapitalRaised)}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Share Classes Table */}
      <Card>
        <CardHeader>
          <CardTitle>Share Classes</CardTitle>
          <CardDescription>
            {canSeeDetails
              ? "Complete breakdown by share class"
              : "Shareholder count by share class (individual shareholder names are kept confidential)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="bh-table">
              <thead>
                <tr>
                  <th>Share Class</th>
                  <th className="text-right">Shareholders</th>
                  {canSeeDetails && (
                    <>
                      <th className="text-right">Total Shares</th>
                      <th className="text-right">Total Capital</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {capTable.shareClasses.map((shareClass) => (
                  <tr key={shareClass.className}>
                    <td className="font-medium">{shareClass.className}</td>
                    <td className="text-right">{shareClass.shareholderCount}</td>
                    {canSeeDetails && (
                      <>
                        <td className="text-right">
                          {shareClass.totalShares
                            ? formatNumber(shareClass.totalShares)
                            : "0"}
                        </td>
                        <td className="text-right">
                          {shareClass.totalCapital
                            ? formatCurrency(shareClass.totalCapital)
                            : "$0"}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!canSeeDetails && (
            <div className="mt-6 p-4 bg-blue-50 border-l-4 border-blue-400 rounded">
              <p className="text-sm text-blue-900">
                <strong>Privacy Notice:</strong> For confidentiality, individual shareholder names
                and specific ownership percentages are not displayed to shareholders. Board members
                and management have access to complete cap table details.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
