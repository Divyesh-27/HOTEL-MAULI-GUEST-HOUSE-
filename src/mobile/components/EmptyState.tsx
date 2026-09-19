import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => {
  return (
    <div className="m-empty-state">
      {icon && (
        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-3 text-muted-foreground">
          {icon}
        </div>
      )}
      <h4 className="text-sm font-semibold text-foreground mb-1">{title}</h4>
      {description && (
        <p className="text-xs text-muted-foreground max-w-[240px]">{description}</p>
      )}
      {action && (
        <div className="mt-4">{action}</div>
      )}
    </div>
  );
};

export default EmptyState;
