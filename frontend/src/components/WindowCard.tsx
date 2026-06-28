import React from 'react';
import { Minus, Square, X } from 'lucide-react';

interface WindowCardProps {
  title: string;
  children: React.ReactNode;
  light?: boolean;
  className?: string;
}

const WindowCard: React.FC<WindowCardProps> = ({ title, children, light, className = '' }) => {
  return (
    <div className={`brutalist-card${light ? '-light' : ''} ${className}`}>
      <div className="window-header">
        <span>{title}</span>
        <div className="window-controls">
          <div className="window-box" />
          <div className="window-box filled" />
          <div className="window-box" />
        </div>
      </div>
      <div style={{ padding: '1.5rem' }}>
        {children}
      </div>
    </div>
  );
};

export default WindowCard;
