'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardBody, Spinner } from '@/components/ui';
import api from '@/lib/api';
import { FileText, Heart, MessageSquare, Users, TrendingUp, Eye } from 'lucide-react';
import { logger } from '@/lib/logger';

interface DashboardData {
  totals: {
    blogs: number;
    likesReceived: number;
    commentsReceived: number;
    followers: number;
    following: number;
    communityPosts: number;
    eventsOrganized: number;
  };
  last30Days: {
    profileViews: number;
    newFollowers: number;
    followerTrend: Array<{ date: string; count: number }>;
    blogTrend: Array<{ date: string; count: number }>;
  };
  topContent: Array<{ id: string; title: string; slug: string; views: number; _count: { likes: number; comments: number } }>;
}

function StatTile({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card>
      <CardBody className="flex items-center gap-3 py-4">
        <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <Icon size={18} className="text-indigo-600" strokeWidth={1.75} />
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900 leading-none">{value}</p>
          <p className="text-xs text-gray-500 mt-1">{label}</p>
        </div>
      </CardBody>
    </Card>
  );
}

/** Tiny inline bar chart — no charting library dependency needed for a
 * simple 30-day trend line. */
function TrendBars({ data }: { data: Array<{ date: string; count: number }> }) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-400 py-6 text-center">No activity in the last 30 days yet.</p>;
  }
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="flex items-end gap-1 h-24 mt-2">
      {data.map((d) => (
        <div
          key={d.date}
          className="flex-1 bg-indigo-500 rounded-t min-w-[3px]"
          style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }}
          title={`${d.date}: ${d.count}`}
        />
      ))}
    </div>
  );
}

export function AnalyticsDashboard({ userId }: { userId: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api
      .get('/analytics/dashboard')
      .then((res) => setData(res.data.data))
      .catch((err) => logger.error('Failed to load dashboard', err))
      .finally(() => setIsLoading(false));
  }, [userId]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile icon={FileText} label="Published blogs" value={data.totals.blogs} />
        <StatTile icon={Heart} label="Likes received" value={data.totals.likesReceived} />
        <StatTile icon={MessageSquare} label="Comments received" value={data.totals.commentsReceived} />
        <StatTile icon={Users} label="Followers" value={data.totals.followers} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-gray-900 text-sm">New followers (30d)</h3>
              <span className="flex items-center gap-1 text-xs text-indigo-600 font-medium">
                <TrendingUp size={14} /> {data.last30Days.newFollowers}
              </span>
            </div>
            <TrendBars data={data.last30Days.followerTrend} />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-gray-900 text-sm">Profile views (30d)</h3>
              <span className="flex items-center gap-1 text-xs text-indigo-600 font-medium">
                <Eye size={14} /> {data.last30Days.profileViews}
              </span>
            </div>
            <TrendBars data={data.last30Days.blogTrend} />
            <p className="text-[11px] text-gray-400 mt-2">Bars show blogs published per day this period.</p>
          </CardBody>
        </Card>
      </div>

      {data.topContent.length > 0 && (
        <Card>
          <CardBody>
            <h3 className="font-semibold text-gray-900 text-sm mb-3">Your top-performing posts</h3>
            <div className="space-y-3">
              {data.topContent.map((blog) => (
                <Link
                  key={blog.id}
                  href={`/blogs/${blog.slug}`}
                  className="flex items-center justify-between text-sm hover:bg-gray-50 -mx-2 px-2 py-1.5 rounded-lg"
                >
                  <span className="text-gray-800 truncate flex-1">{blog.title}</span>
                  <span className="flex items-center gap-3 text-xs text-gray-500 flex-shrink-0 ml-3">
                    <span className="flex items-center gap-1">
                      <Eye size={12} /> {blog.views}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart size={12} /> {blog._count.likes}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
