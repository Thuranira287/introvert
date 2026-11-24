import React from 'react';

export interface AvatarProps {
  src?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  initials?: string;
  onClick?: () => void;
}

const sizeMap = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = 'Avatar',
  size = 'md',
  initials,
  onClick,
}) => {
  return (
    <div
      className={`${sizeMap[size]} rounded-full bg-indigo-600 text-white flex items-center justify-center font-semibold flex-shrink-0 ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
      onClick={onClick}
    >
      {src ? (
        // Avatars are user-supplied URLs on arbitrary hosts, which next/image cannot allow-list.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="w-full h-full rounded-full object-cover" />
      ) : (
        initials || '?'
      )}
    </div>
  );
};
