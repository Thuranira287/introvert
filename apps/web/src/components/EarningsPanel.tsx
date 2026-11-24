'use client';

import { useEffect, useState } from 'react';
import { Card, CardBody, Button, Spinner } from '@/components/ui';
import api from '@/lib/api';
import { DollarSign, Info } from 'lucide-react';
import { logger } from '@/lib/logger';

interface EarningsSummary {
  isEligible: boolean;
  adsEnabled: boolean;
  totalEarnedCents: number;
  recentTransactions: Array<{ id: string; amountCents: number; reason: string; createdAt: string }>;
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function EarningsPanel() {
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);

  const fetchSummary = () => {
    api
      .get('/monetization/earnings')
      .then((res) => setSummary(res.data.data))
      .catch((err) => logger.error('Failed to load earnings', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(fetchSummary, []);

  const toggleAds = async () => {
    if (!summary) return;
    setIsToggling(true);
    try {
      await api.post('/monetization/profile-ads', { enabled: !summary.adsEnabled });
      fetchSummary();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update ads setting');
    } finally {
      setIsToggling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (!summary) return null;

  if (!summary.isEligible) {
    return (
      <Card>
        <CardBody className="text-center py-8">
          <p className="text-gray-600 text-sm">
            Verified and Premium members can run ads on their profile and earn a share of the estimated ad value.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900">Ads on your profile</p>
            <p className="text-sm text-gray-500 mt-1">
              {summary.adsEnabled ? 'Ads are currently shown on your profile.' : 'Turn on ads to start earning.'}
            </p>
          </div>
          <Button
            variant={summary.adsEnabled ? 'secondary' : 'primary'}
            onClick={toggleAds}
            isLoading={isToggling}
            disabled={isToggling}
          >
            {summary.adsEnabled ? 'Turn off' : 'Turn on'}
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={18} className="text-green-600" />
            <p className="text-2xl font-bold text-gray-900">{formatCents(summary.totalEarnedCents)}</p>
          </div>
          <p className="text-xs text-gray-500 mb-4">Total estimated earnings</p>

          <div className="flex items-start gap-2 bg-gray-50 rounded-lg p-3 mb-4">
            <Info size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-500">
              Earnings are an internal estimate based on your profile views, followers, and likes — not a live sync
              with ad network revenue. Amounts are added periodically, not in real time.
            </p>
          </div>

          {summary.recentTransactions.length > 0 ? (
            <div className="space-y-2">
              {summary.recentTransactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm border-t border-gray-100 pt-2">
                  <div>
                    <p className="text-gray-700">{t.reason}</p>
                    <p className="text-xs text-gray-400">{new Date(t.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className="font-medium text-green-600">+{formatCents(t.amountCents)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">
              No earnings yet — they&apos;re calculated periodically once ads are on.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
