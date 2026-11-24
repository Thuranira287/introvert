'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Avatar, Button } from './ui';
import { useAuth } from '../context/AuthContext';
import { VerificationBadge } from './VerificationBadge';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const initials =
    user?.displayName
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase() || '?';

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/icon.png" alt="Introvert Corner" width={32} height={32} className="rounded-lg" priority />
            <span className="font-bold text-lg text-gray-900">Introvert Corner</span>
          </Link>

          {user && (
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 font-medium">
                Home
              </Link>
              <Link href="/discover" className="text-gray-600 hover:text-gray-900 font-medium">
                Discover
              </Link>
              <Link href="/blogs" className="text-gray-600 hover:text-gray-900 font-medium">
                Blogs
              </Link>
              <Link href="/communities" className="text-gray-600 hover:text-gray-900 font-medium">
                Communities
              </Link>
              <Link href="/events" className="text-gray-600 hover:text-gray-900 font-medium">
                Events
              </Link>
              <Link href="/messages" className="text-gray-600 hover:text-gray-900 font-medium">
                Messages
              </Link>
              <Link href="/ai-chat" className="text-gray-600 hover:text-gray-900 font-medium">
                AI Assistant
              </Link>
              {['ADMIN', 'SUPER_ADMIN'].includes(user.role) && (
                <Link href="/admin" className="text-indigo-600 hover:text-indigo-700 font-medium">
                  Admin
                </Link>
              )}
            </nav>
          )}

          <div className="flex items-center gap-4">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="flex items-center gap-2 hover:opacity-80"
                >
                  <Avatar size="md" initials={initials} src={user.profile?.avatarUrl} />
                  <span className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-gray-700">
                    {user.displayName}
                    <VerificationBadge verificationType={user.verificationType} size={14} />
                  </span>
                </button>

                {isMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50">
                      <Link
                        href={`/profile/${user.username}`}
                        className="block px-4 py-2 hover:bg-gray-50"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Profile
                      </Link>
                      <hr className="my-2" />
                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          logout();
                        }}
                        className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50"
                      >
                        Logout
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/login">Login</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/register">Sign Up</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
