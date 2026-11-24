import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  /** When true, merges button styles/behavior onto the single child element (e.g. a Next.js Link) instead of rendering a <button>. */
  asChild?: boolean;
  children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    variant = 'primary',
    size = 'md',
    isLoading = false,
    icon,
    fullWidth = false,
    asChild = false,
    disabled,
    children,
    className = '',
    ...props
  }, ref) => {
    const baseStyles = 'font-medium rounded-lg transition-all duration-200 inline-flex items-center justify-center gap-2 cursor-pointer';

    const variantStyles = {
      primary: 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-gray-400',
      secondary: 'bg-indigo-100 text-indigo-900 hover:bg-indigo-200 active:bg-indigo-300 disabled:bg-gray-200',
      outline: 'border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 disabled:border-gray-400 disabled:text-gray-400',
      ghost: 'text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 disabled:text-gray-400',
      danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:bg-gray-400',
    };

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2.5 text-base',
      lg: 'px-6 py-3 text-lg',
    };

    const widthStyle = fullWidth ? 'w-full' : '';

    const finalClassName = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyle} ${className}`;

    if (asChild) {
      // Merge our classes/props onto the single child element instead of
      // wrapping it in a <button> — avoids invalid nested interactive
      // elements when the child is a Next.js <Link> or <a>.
      const child = React.Children.only(children) as React.ReactElement<any>;
      const childClassName = [finalClassName, child.props?.className].filter(Boolean).join(' ');

      return React.cloneElement(child, {
        ...props,
        ref,
        className: childClassName,
        'aria-disabled': disabled || isLoading || undefined,
        children: isLoading ? (
          <>
            <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
            Loading...
          </>
        ) : (
          <>
            {icon && <span>{icon}</span>}
            {child.props.children}
          </>
        ),
      });
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={finalClassName}
        {...props}
      >
        {isLoading ? (
          <>
            <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
            Loading...
          </>
        ) : (
          <>
            {icon && <span>{icon}</span>}
            {children}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
