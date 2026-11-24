import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, fullWidth = false, className = '', ...props }, ref) => {
    return (
      <div className={fullWidth ? 'w-full' : ''}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            className={`
              w-full px-4 py-2 border rounded-lg transition-colors
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
              ${error ? 'border-red-500 bg-red-50' : 'border-gray-300 focus:bg-white'}
              ${icon ? 'pl-10' : ''}
              ${className}
            `}
            {...props}
          />
          {icon && (
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
              {icon}
            </span>
          )}
        </div>
        {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
        {hint && !error && <p className="text-gray-500 text-sm mt-1">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
