'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Flag, Building2, Calendar, ArrowLeft, type LucideIcon } from 'lucide-react';

const NAV_ITEMS: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/reports', label: 'Reports', icon: Flag },
  { href: '/admin/communities', label: 'Communities', icon: Building2 },
  { href: '/admin/events', label: 'Events', icon: Calendar },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="w-56 flex-shrink-0 border-r border-gray-200 bg-white min-h-[calc(100vh-64px)] py-6 px-3">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400 px-3 mb-3">Admin</p>
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium mb-1 transition-colors ${
              isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Icon size={18} strokeWidth={2} />
            {item.label}
          </Link>
        );
      })}
      <Link
        href="/dashboard"
        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium mt-6 text-gray-500 hover:bg-gray-50"
      >
        <ArrowLeft size={16} strokeWidth={2} />
        Back to app
      </Link>
    </nav>
  );
}
