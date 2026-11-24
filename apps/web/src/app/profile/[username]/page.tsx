'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardBody, Avatar, Button, Badge, Spinner } from '@/components/ui';
import { Header } from '@/components/Header';
import { VerificationBadge } from '@/components/VerificationBadge';
import { AchievementsGrid } from '@/components/AchievementsGrid';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';
import { EarningsPanel } from '@/components/EarningsPanel';
import { AdUnit } from '@/components/ads/AdUnit';
import { AD_SLOTS } from '@/components/ads/ad-slots';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { Heart, MapPin, Sparkles } from 'lucide-react';
import { logger } from '@/lib/logger';

interface ProfileData {
  id: string;
  username: string;
  displayName: string;
  isFollowing: boolean;
  isVerified?: boolean;
  verificationType?: 'ADMIN_GRANTED' | 'PREMIUM' | null;
  profile?: { bio?: string; interests?: string[]; location?: string; adsEnabled?: boolean };
  _count: { followers: number; following: number; blogs: number };
}

interface UserBlog {
  id: string;
  title: string;
  excerpt?: string;
  slug: string;
  createdAt: string;
  _count: { likes: number };
}

type Tab = 'blogs' | 'achievements' | 'about' | 'dashboard' | 'earnings';

function initialsOf(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase();
}

export default function ProfilePage() {
  const { user: currentUser, isLoading: authLoading } = useRequireAuth();
  const { refreshUser } = useAuth();
  const params = useParams<{ username: string }>();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [blogs, setBlogs] = useState<UserBlog[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('blogs');
  const [isLoading, setIsLoading] = useState(true);
  const [friendRequestSent, setFriendRequestSent] = useState(false);

  const isOwnProfile = currentUser?.username === params.username;

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const profileRes = await api.get(`/users/${params.username}`);
      setProfile(profileRes.data.data);
    } catch (err) {
      logger.error('Failed to load profile', err);
    } finally {
      setIsLoading(false);
    }
  }, [params.username]);

  useEffect(() => {
    if (!currentUser || !params.username) return;
    fetchProfile();
  }, [currentUser, params.username, fetchProfile]);

  // Blog listing endpoint is keyed by userId, not username — fetch once we
  // know the profile's id.
  useEffect(() => {
    if (!profile) return;
    api
      .get(`/blogs/user/${profile.id}/blogs`)
      .then((res) => setBlogs(res.data.data))
      .catch((err) => logger.error('Failed to load user blogs', err));
  }, [profile]);

  // Record a profile view (for the owner's earnings estimate) whenever a
  // different, signed-in user visits — never counts self-views, matching
  // the backend's own guard, but skipping the call here too avoids noise.
  useEffect(() => {
    if (!profile || isOwnProfile) return;
    api.post(`/profile-views/${profile.id}`).catch(() => {
      // Non-critical — don't disrupt the page if this fails.
    });
  }, [profile, isOwnProfile]);

  const toggleFollow = async () => {
    if (!profile) return;
    const wasFollowing = profile.isFollowing;
    setProfile({
      ...profile,
      isFollowing: !wasFollowing,
      _count: { ...profile._count, followers: profile._count.followers + (wasFollowing ? -1 : 1) },
    });
    try {
      wasFollowing ? await api.delete(`/users/${profile.id}/follow`) : await api.post(`/users/${profile.id}/follow`);
      if (isOwnProfile) await refreshUser();
    } catch (err) {
      logger.error('Follow toggle failed', err);
      fetchProfile(); // resync on failure
    }
  };

  const sendFriendRequest = async () => {
    if (!profile) return;
    try {
      await api.post(`/friendships/${profile.id}/request`);
      setFriendRequestSent(true);
    } catch (err) {
      logger.error('Friend request failed', err);
    }
  };

  if (authLoading || !currentUser || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!profile) {
    return (
      <>
        <Header />
        <main className="max-w-3xl mx-auto py-16 px-4 text-center text-gray-600">User not found.</main>
      </>
    );
  }

  const initials = initialsOf(profile.displayName);
  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'blogs', label: `Blogs (${blogs.length})` },
    { key: 'achievements', label: 'Achievements' },
    { key: 'about', label: 'About' },
    ...(isOwnProfile ? ([{ key: 'dashboard', label: 'My Progress' }, { key: 'earnings', label: 'Earnings' }] as const) : []),
  ];

  return (
    <>
      <Header />

      <main className="bg-gray-50 min-h-screen py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <Card className="mb-6">
            <CardBody className="p-8">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <Avatar size="xl" initials={initials} />

                <div className="flex-1 text-center sm:text-left">
                  <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 justify-center sm:justify-start">
                    {profile.displayName}
                    <VerificationBadge verificationType={profile.verificationType} size={20} />
                  </h1>
                  <p className="text-gray-600 mb-3">@{profile.username}</p>
                  {profile.profile?.bio && <p className="text-gray-700 mb-4 max-w-lg">{profile.profile.bio}</p>}

                  {profile.profile?.interests && profile.profile.interests.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-center sm:justify-start mb-4">
                      {profile.profile.interests.map((interest) => (
                        <Badge key={interest} variant="info" size="sm">
                          {interest}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-6 justify-center sm:justify-start text-sm">
                    <span>
                      <strong className="text-gray-900">{profile._count.followers}</strong>{' '}
                      <span className="text-gray-600">Followers</span>
                    </span>
                    <span>
                      <strong className="text-gray-900">{profile._count.following}</strong>{' '}
                      <span className="text-gray-600">Following</span>
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 w-full sm:w-auto">
                  {isOwnProfile ? (
                    <>
                      <Button variant="outline" asChild>
                        <Link href="/dashboard">Back to Dashboard</Link>
                      </Button>
                      {!profile.verificationType && (
                        <Button asChild>
                          <Link href="/premium" className="flex items-center gap-1.5 justify-center">
                            <Sparkles size={16} /> Get Verified
                          </Link>
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <Button variant={profile.isFollowing ? 'secondary' : 'primary'} onClick={toggleFollow}>
                        {profile.isFollowing ? 'Following' : 'Follow'}
                      </Button>
                      <Button variant="outline" asChild>
                        <Link href="/messages">Message</Link>
                      </Button>
                      <Button variant="ghost" onClick={sendFriendRequest} disabled={friendRequestSent}>
                        {friendRequestSent ? 'Request Sent' : 'Add Friend'}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>

          {!isOwnProfile && profile.isVerified && profile.profile?.adsEnabled && (
            <Card bordered={false} className="p-2 mb-6">
              <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1 px-1">Advertisement</p>
              <AdUnit slot={AD_SLOTS.dashboardSidebar} style={{ minHeight: 120 }} />
            </Card>
          )}

          <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'blogs' && (
            <div className="space-y-4">
              {blogs.length === 0 ? (
                <Card>
                  <CardBody className="text-center py-8 text-gray-500">No blogs published yet.</CardBody>
                </Card>
              ) : (
                blogs.map((blog) => (
                  <Card key={blog.id} hoverable>
                    <CardBody>
                      <Link href={`/blogs/${blog.slug}`}>
                        <h3 className="text-lg font-bold text-gray-900 hover:text-indigo-600 mb-2">{blog.title}</h3>
                      </Link>
                      <p className="text-gray-600 text-sm mb-3">{blog.excerpt}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{new Date(blog.createdAt).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1">
                          <Heart size={14} /> {blog._count.likes}
                        </span>
                      </div>
                    </CardBody>
                  </Card>
                ))
              )}
            </div>
          )}

          {activeTab === 'achievements' && <AchievementsGrid userId={profile.id} isOwnProfile={isOwnProfile} />}

          {activeTab === 'about' && (
            <Card>
              <CardBody>
                <h3 className="font-bold text-gray-900 mb-3">About {profile.displayName}</h3>
                <p className="text-gray-700 leading-relaxed">
                  {profile.profile?.bio || 'No bio yet.'}
                </p>
                {profile.profile?.location && (
                  <p className="text-gray-500 text-sm mt-3 flex items-center gap-1">
                    <MapPin size={14} /> {profile.profile.location}
                  </p>
                )}
              </CardBody>
            </Card>
          )}

          {activeTab === 'dashboard' && isOwnProfile && <AnalyticsDashboard userId={profile.id} />}
          {activeTab === 'earnings' && isOwnProfile && <EarningsPanel />}
        </div>
      </main>
    </>
  );
}
