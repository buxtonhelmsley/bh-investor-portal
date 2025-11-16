"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus, Search } from "lucide-react";
import { formatShortDate } from "@/lib/utils";
import Link from "next/link";

interface Shareholder {
  id: string;
  legal_name: string;
  shareholder_type: string;
  email: string;
  phone_number?: string;
  is_accredited_verified: boolean;
  is_active: boolean;
  role: string;
}

export default function ShareholdersPage() {
  const { data: session } = useSession();
  const [shareholders, setShareholders] = useState<Shareholder[]>([]);
  const [filteredShareholders, setFilteredShareholders] = useState<Shareholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const canEdit = session?.user?.role === "admin_edit";

  useEffect(() => {
    async function fetchShareholders() {
      try {
        const res = await fetch("/api/shareholders");
        const data = await res.json();
        setShareholders(data.shareholders || []);
        setFilteredShareholders(data.shareholders || []);
      } catch (error) {
        console.error("Error fetching shareholders:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchShareholders();
  }, []);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredShareholders(shareholders);
      return;
    }

    const filtered = shareholders.filter(
      (sh) =>
        sh.legal_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sh.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredShareholders(filtered);
  }, [searchTerm, shareholders]);

  const getShareholderTypeLabel = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      shareholder: "bg-blue-100 text-blue-800",
      board_member: "bg-purple-100 text-purple-800",
      admin_view: "bg-gray-100 text-gray-800",
      admin_edit: "bg-green-100 text-green-800",
    };

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colors[role] || "bg-gray-100 text-gray-800"}`}>
        {role.replace(/_/g, " ")}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading shareholders...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bh-header flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Shareholders</h1>
          <p className="text-gray-600 mt-1">
            Manage shareholders, investments, and RSU grants
          </p>
        </div>
        {canEdit && (
          <Link href="/admin/shareholders/new">
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Shareholder
            </Button>
          </Link>
        )}
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Shareholders Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Shareholders</CardTitle>
          <CardDescription>
            {filteredShareholders.length} of {shareholders.length} shareholders
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredShareholders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="bh-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Type</th>
                    <th>Role</th>
                    <th>Accredited</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredShareholders.map((shareholder) => (
                    <tr key={shareholder.id}>
                      <td className="font-medium">{shareholder.legal_name}</td>
                      <td>{shareholder.email}</td>
                      <td>{getShareholderTypeLabel(shareholder.shareholder_type)}</td>
                      <td>{getRoleBadge(shareholder.role)}</td>
                      <td>
                        {shareholder.is_accredited_verified ? (
                          <span className="text-green-600 text-sm">✓ Verified</span>
                        ) : (
                          <span className="text-amber-600 text-sm">Pending</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            shareholder.is_active
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {shareholder.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="text-right">
                        <Link href={`/admin/shareholders/${shareholder.id}`}>
                          <Button variant="ghost" size="sm">
                            View Details
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              {searchTerm ? "No shareholders found matching your search" : "No shareholders yet"}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
