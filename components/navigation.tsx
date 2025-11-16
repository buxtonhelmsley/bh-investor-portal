"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  Users, 
  LayoutDashboard, 
  Settings, 
  LogOut,
  PieChart
} from "lucide-react";

export function Navigation() {
  const { data: session } = useSession();
  const pathname = usePathname();

  if (!session?.user) return null;

  const isAdmin = session.user.role === "admin_edit" || session.user.role === "admin_view";
  const canEdit = session.user.role === "admin_edit";
  const isBoard = session.user.role === "board_member";

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
    { href: "/documents", label: "Documents", icon: FileText, show: true },
    { href: "/cap-table", label: "Cap Table", icon: PieChart, show: true },
    { href: "/admin/shareholders", label: "Shareholders", icon: Users, show: isAdmin || isBoard },
    { href: "/profile", label: "Profile", icon: Settings, show: true },
  ];

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/dashboard" className="text-xl font-bold">
                Buxton Helmsley
              </Link>
            </div>
            <div className="hidden sm:ml-8 sm:flex sm:space-x-6">
              {navItems.filter(item => item.show).map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      isActive
                        ? "border-black text-black"
                        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                    }`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              {session.user.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
