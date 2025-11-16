"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [showMfa, setShowMfa] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
        mfaToken: showMfa ? mfaToken : undefined,
      });

      if (result?.error) {
        if (result.error === "MFA_REQUIRED") {
          setShowMfa(true);
          setError("Please enter your two-factor authentication code");
        } else {
          setError("Invalid credentials. Please try again.");
        }
      } else if (result?.ok) {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold">Buxton Helmsley</h1>
          <p className="mt-2 text-sm text-gray-600">Investor Portal</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access the investor portal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={showMfa || loading}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={showMfa || loading}
                    className="mt-1"
                  />
                </div>

                {showMfa && (
                  <div>
                    <Label htmlFor="mfaToken">Two-Factor Code</Label>
                    <Input
                      id="mfaToken"
                      name="mfaToken"
                      type="text"
                      placeholder="000000"
                      maxLength={6}
                      required
                      value={mfaToken}
                      onChange={(e) => setMfaToken(e.target.value)}
                      disabled={loading}
                      className="mt-1"
                      autoFocus
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Enter the 6-digit code from your authenticator app
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <a
                  href="/auth/reset-password"
                  className="text-sm text-gray-600 hover:text-black"
                >
                  Forgot password?
                </a>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>

              {showMfa && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setShowMfa(false);
                    setMfaToken("");
                    setError("");
                  }}
                >
                  Back to login
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-500">
          © {new Date().getFullYear()} Buxton Helmsley, Inc. All rights reserved.
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-4xl font-bold">Buxton Helmsley</h1>
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}
