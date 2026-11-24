import React from 'react';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'indigo' | 'white';
  fullScreen?: boolean;
}

const sizeMap = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

const colorMap = {
  indigo: 'text-indigo-600',
  white: 'text-white',
};

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', color = 'indigo', fullScreen = false }) => {
  const spinner = (
    <div className={`${sizeMap[size]} border-4 border-current border-t-transparent rounded-full animate-spin ${colorMap[color]}`} />
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
};
