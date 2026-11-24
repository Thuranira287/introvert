'use client';

import { useState } from 'react';
import { MailWarning } from 'lucide-react';
import { Button } from '@/components/ui';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

export function EmailVerificationBanner() {
  const [isSending, setIsSending] = useState(false);
  const [wasSent, setWasSent] = useState(false);
  const [error, setError] = useState('');

  const resend = async () => {
    setIsSending(true);
    setError('');
    try {
      await api.post('/auth/resend-verification');
      setWasSent(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not send the email right now. Please try again shortly.'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6">
      <div className="flex items-start gap-3">
        <MailWarning size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-900">Please verify your email address</p>
          <p className="text-xs text-amber-800">
            {wasSent ? 'A new verification link is on its way. Check your inbox.' : 'We sent a link when you signed up.'}
          </p>
          {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
        </div>
      </div>
      {!wasSent && (
        <Button variant="outline" size="sm" onClick={resend} isLoading={isSending} disabled={isSending}>
          Resend email
        </Button>
      )}
    </div>
  );
}
