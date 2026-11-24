'use client';

import { useEffect, useState } from 'react';
import { Card, CardBody, Spinner } from '@/components/ui';
import api from '@/lib/api';
import { logger } from '@/lib/logger';
import {
  Edit3,
  BookOpen,
  MessageCircle,
  TrendingUp,
  HeartHandshake,
  ThumbsUp,
  Award,
  CalendarCheck,
  Users,
  Lock,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  'edit-3': Edit3,
  'book-open': BookOpen,
  'message-circle': MessageCircle,
  'trending-up': TrendingUp,
  'heart-handshake': HeartHandshake,
  'thumbs-up': ThumbsUp,
  award: Award,
  'calendar-check': CalendarCheck,
  users: Users,
};

interface AchievementProgress {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  criteriaThreshold: number;
  currentValue: number;
  isEarned: boolean;
  earnedAt: string | null;
}

export function AchievementsGrid({ userId, isOwnProfile }: { userId: string; isOwnProfile: boolean }) {
  const [achievements, setAchievements] = useState<AchievementProgress[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const endpoint = isOwnProfile ? '/achievements/progress' : `/users/${userId}/achievements`;
    api
      .get(endpoint)
      .then((res) => {
        // The public endpoint (other users' profiles) only returns earned
        // achievements, already in the achievement-progress shape via the
        // `.achievement` include — normalize both shapes to one list here.
        const data = res.data.data;
        const normalized = isOwnProfile
          ? data
          : data.map((ua: any) => ({ ...ua.achievement, isEarned: true, earnedAt: ua.earnedAt, currentValue: ua.achievement.criteriaThreshold }));
        setAchievements(normalized);
      })
      .catch((err) => logger.error('Failed to load achievements', err))
      .finally(() => setIsLoading(false));
  }, [userId, isOwnProfile]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (!achievements) return null;

  const visible = isOwnProfile ? achievements : achievements.filter((a) => a.isEarned);

  if (visible.length === 0) {
    return (
      <Card>
        <CardBody className="text-center py-8 text-gray-500">
          {isOwnProfile ? 'No achievements yet — start posting to earn your first badge!' : 'No achievements earned yet.'}
        </CardBody>
      </Card>
    );
  }

  const earnedCount = achievements.filter((a) => a.isEarned).length;

  return (
    <div>
      {isOwnProfile && (
        <p className="text-sm text-gray-500 mb-4">
          {earnedCount} of {achievements.length} unlocked
        </p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {visible.map((a) => {
          const Icon = ICON_MAP[a.icon] ?? Award;
          const progressPct = Math.min(100, Math.round((a.currentValue / a.criteriaThreshold) * 100));

          return (
            <Card key={a.id} className={a.isEarned ? '' : 'opacity-60'}>
              <CardBody className="text-center py-6">
                <div
                  className={`w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center ${
                    a.isEarned ? 'bg-indigo-50' : 'bg-gray-100'
                  }`}
                >
                  {a.isEarned ? (
                    <Icon size={26} className="text-indigo-600" strokeWidth={1.75} />
                  ) : (
                    <Lock size={22} className="text-gray-400" strokeWidth={1.75} />
                  )}
                </div>
                <p className="font-semibold text-gray-900 text-sm">{a.name}</p>
                <p className="text-xs text-gray-500 mt-1">{a.description}</p>
                {isOwnProfile && !a.isEarned && (
                  <div className="mt-3">
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="bg-indigo-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {a.currentValue} / {a.criteriaThreshold}
                    </p>
                  </div>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
