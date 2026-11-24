'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardBody, Badge, Button, Spinner } from '@/components/ui';
import { Header } from '@/components/Header';
import { AdminNav } from '@/components/admin/AdminNav';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import api from '@/lib/api';
import { logger } from '@/lib/logger';

interface Report {
  id: string;
  entityType: string;
  entityId: string;
  reason: string;
  status: 'PENDING' | 'REVIEWED' | 'ACTIONED' | 'DISMISSED';
  createdAt: string;
  reporter: { username: string; displayName: string };
  reportedUser?: { username: string; displayName: string } | null;
}

const STATUS_VARIANT: Record<Report['status'], 'warning' | 'info' | 'danger' | 'default'> = {
  PENDING: 'warning',
  REVIEWED: 'info',
  ACTIONED: 'danger',
  DISMISSED: 'default',
};

const FILTERS: Array<{ label: string; value?: string }> = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Reviewed', value: 'REVIEWED' },
  { label: 'Actioned', value: 'ACTIONED' },
  { label: 'Dismissed', value: 'DISMISSED' },
  { label: 'All', value: undefined },
];

export default function AdminReportsPage() {
  const { isAuthorized, isLoading: authLoading } = useRequireAdmin();
  const [reports, setReports] = useState<Report[]>([]);
  const [statusFilter, setStatusFilter] = useState<string | undefined>('PENDING');
  const [isLoading, setIsLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const fetchReports = useCallback(async (status?: string) => {
    setIsLoading(true);
    try {
      const response = await api.get('/admin/reports', { params: { status } });
      setReports(response.data.data);
    } catch (err) {
      logger.error('Failed to load reports', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthorized) return;
    fetchReports(statusFilter);
  }, [isAuthorized, statusFilter, fetchReports]);

  const updateStatus = async (reportId: string, status: Report['status']) => {
    setActioningId(reportId);
    try {
      await api.patch(`/admin/reports/${reportId}`, { status });
      setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, status } : r)));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Action failed');
    } finally {
      setActioningId(null);
    }
  };

  if (authLoading || !isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className="flex">
        <AdminNav />

        <main className="flex-1 bg-gray-50 min-h-[calc(100vh-64px)] p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Reports</h1>

          <div className="flex gap-2 mb-6">
            {FILTERS.map((f) => (
              <button
                key={f.label}
                onClick={() => setStatusFilter(f.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  statusFilter === f.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : reports.length === 0 ? (
            <Card>
              <CardBody className="text-center py-12 text-gray-500">No reports in this category.</CardBody>
            </Card>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <Card key={report.id}>
                  <CardBody>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={STATUS_VARIANT[report.status]} size="sm">
                            {report.status}
                          </Badge>
                          <span className="text-xs text-gray-500 uppercase tracking-wide">{report.entityType}</span>
                        </div>
                        <p className="text-sm text-gray-500">
                          Reported by <strong>{report.reporter.displayName}</strong> (@{report.reporter.username})
                          {report.reportedUser && (
                            <>
                              {' '}
                              — against <strong>{report.reportedUser.displayName}</strong> (@{report.reportedUser.username})
                            </>
                          )}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400">{new Date(report.createdAt).toLocaleDateString()}</span>
                    </div>

                    <p className="text-gray-800 text-sm mb-4 bg-gray-50 rounded-lg p-3">{report.reason}</p>

                    {report.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => updateStatus(report.id, 'ACTIONED')}
                          isLoading={actioningId === report.id}
                        >
                          Take Action
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateStatus(report.id, 'REVIEWED')}
                          disabled={actioningId === report.id}
                        >
                          Mark Reviewed
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateStatus(report.id, 'DISMISSED')}
                          disabled={actioningId === report.id}
                        >
                          Dismiss
                        </Button>
                      </div>
                    )}
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
