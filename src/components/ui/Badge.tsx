import { cn } from '../../lib/utils';
import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  className?: string;
}

export const Badge = ({ children, variant = 'neutral', className }: BadgeProps) => {
  const variants = {
    success: "bg-success-bg text-success border-success/20",
    warning: "bg-warning-bg text-warning border-warning/20",
    danger: "bg-danger-bg text-danger border-danger/20",
    info: "bg-blue-50 text-blue-600 border-blue-200",
    neutral: "bg-gray-100 text-gray-600 border-gray-200",
  };

  return (
    <span className={cn(
      "status-badge border inline-flex items-center",
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
};
