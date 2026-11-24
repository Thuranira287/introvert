import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  bordered?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ hoverable = false, bordered = true, className = '', ...props }, ref) => {
    const baseStyles = 'rounded-lg bg-white overflow-hidden';
    const borderStyles = bordered ? 'border border-gray-200' : 'shadow-md';
    const hoverStyles = hoverable ? 'hover:shadow-lg hover:border-gray-300 transition-all duration-200 cursor-pointer' : '';
    
    return (
      <div
        ref={ref}
        className={`${baseStyles} ${borderStyles} ${hoverStyles} ${className}`}
        {...props}
      />
    );
  }
);

Card.displayName = 'Card';

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = '', ...props }, ref) => (
    <div ref={ref} className={`px-6 py-4 border-b border-gray-200 ${className}`} {...props} />
  )
);

CardHeader.displayName = 'CardHeader';

export interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardBody = React.forwardRef<HTMLDivElement, CardBodyProps>(
  ({ className = '', ...props }, ref) => (
    <div ref={ref} className={`px-6 py-4 ${className}`} {...props} />
  )
);

CardBody.displayName = 'CardBody';

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className = '', ...props }, ref) => (
    <div ref={ref} className={`px-6 py-4 border-t border-gray-200 bg-gray-50 ${className}`} {...props} />
  )
);

CardFooter.displayName = 'CardFooter';
