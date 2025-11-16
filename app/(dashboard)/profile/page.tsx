"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatShortDate, formatNumber } from "@/lib/utils";

interface ProfileData {
  shareholder?: {
    legal_name: string;
    shareholder_type: string;
    phone_number?: string;
    mailing_address?: string;
    is_erisa_subject: boolean;
    is_accredited_verified: boolean;
  };
  investments?: any[];
  rsuGrants?: any[];
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/profile");
        const data = await res.json();
        setProfile(data);
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading profile...</div>
      </div>
    );
  }

  const getShareholderTypeLabel = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bh-header">
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-gray-600 mt-1">Your account information and investment details</p>
      </div>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-600">Email Address</Label>
              <p className="font-medium">{session?.user?.email}</p>
            </div>
            <div>
              <Label className="text-gray-600">Role</Label>
              <p className="font-medium capitalize">
                {session?.user?.role?.replace(/_/g, " ")}
              </p>
            </div>
          </div>

          {profile?.shareholder && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-600">Legal Name</Label>
                  <p className="font-medium">{profile.shareholder.legal_name}</p>
                </div>
                <div>
                  <Label className="text-gray-600">Shareholder Type</Label>
                  <p className="font-medium">
                    {getShareholderTypeLabel(profile.shareholder.shareholder_type)}
                  </p>
                </div>
              </div>

              {profile.shareholder.phone_number && (
                <div>
                  <Label className="text-gray-600">Phone Number</Label>
                  <p className="font-medium">{profile.shareholder.phone_number}</p>
                </div>
              )}

              {profile.shareholder.mailing_address && (
                <div>
                  <Label className="text-gray-600">Mailing Address</Label>
                  <p className="font-medium whitespace-pre-line">
                    {profile.shareholder.mailing_address}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-600">ERISA Subject</Label>
                  <p className="font-medium">
                    {profile.shareholder.is_erisa_subject ? "Yes" : "No"}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-600">Accredited Investor</Label>
                  <p className="font-medium">
                    {profile.shareholder.is_accredited_verified ? (
                      <span className="text-green-600">Verified</span>
                    ) : (
                      <span className="text-amber-600">Pending Verification</span>
                    )}
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Investments */}
      {profile?.investments && profile.investments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Investments</CardTitle>
            <CardDescription>Investment history and current holdings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="bh-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Share Class</th>
                    <th className="text-right">Amount</th>
                    <th className="text-right">Shares</th>
                    <th className="text-right">Price/Share</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.investments.map((inv: any) => (
                    <tr key={inv.id}>
                      <td>{formatShortDate(inv.investment_date)}</td>
                      <td>{inv.share_class_name}</td>
                      <td className="text-right">
                        {formatCurrency(parseFloat(inv.amount))}
                      </td>
                      <td className="text-right">
                        {formatNumber(parseFloat(inv.shares_issued))}
                      </td>
                      <td className="text-right">
                        {formatCurrency(parseFloat(inv.price_per_share))}
                      </td>
                      <td>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            inv.status === "active"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* RSU Grants */}
      {profile?.rsuGrants && profile.rsuGrants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>RSU Grants</CardTitle>
            <CardDescription>Your restricted stock unit grants and vesting schedule</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="bh-table">
                <thead>
                  <tr>
                    <th>Grant Date</th>
                    <th className="text-right">Total Units</th>
                    <th className="text-right">Vested</th>
                    <th className="text-right">Unvested</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.rsuGrants.map((grant: any) => (
                    <tr key={grant.id}>
                      <td>{formatShortDate(grant.grant_date)}</td>
                      <td className="text-right">
                        {formatNumber(parseFloat(grant.total_units))}
                      </td>
                      <td className="text-right">
                        {formatNumber(parseFloat(grant.units_vested || 0))}
                      </td>
                      <td className="text-right">
                        {formatNumber(parseFloat(grant.units_unvested || 0))}
                      </td>
                      <td>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            grant.status === "active"
                              ? "bg-green-100 text-green-800"
                              : grant.status === "cancelled"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {grant.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Security Settings</CardTitle>
          <CardDescription>Manage your password and two-factor authentication</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Password</p>
              <p className="text-sm text-gray-500">
                Last changed: Never (set your own password)
              </p>
            </div>
            <Button variant="outline">Change Password</Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Two-Factor Authentication</p>
              <p className="text-sm text-gray-500">
                {session?.user?.mfaEnabled
                  ? "Enabled - your account is protected with 2FA"
                  : "Not enabled - add an extra layer of security"}
              </p>
            </div>
            <Button variant="outline">
              {session?.user?.mfaEnabled ? "Manage 2FA" : "Enable 2FA"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
