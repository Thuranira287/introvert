import { BadgeCheck } from 'lucide-react';

export interface VerificationBadgeProps {
  verificationType?: 'ADMIN_GRANTED' | 'PREMIUM' | null;
  size?: number;
  showLabel?: boolean;
}

/**
 * A small checkmark badge shown next to a verified user's name. Both
 * verification paths (admin-granted and premium-purchased) render the same
 * visual mark — the distinction matters for admin tooling and the user's
 * own settings, not for how other people see the badge, mirroring how
 * most platforms treat "verified" as a single visible status regardless
 * of how it was obtained.
 */
export function VerificationBadge({ verificationType, size = 16, showLabel = false }: VerificationBadgeProps) {
  if (!verificationType) return null;

  const label = verificationType === 'ADMIN_GRANTED' ? 'Verified' : 'Verified (Premium)';

  return (
    <span
      className="inline-flex items-center gap-1 text-indigo-600"
      title={label}
      aria-label={label}
    >
      <BadgeCheck size={size} className="text-indigo-600" />
      {showLabel && <span className="text-xs font-medium">{label}</span>}
    </span>
  );
}
