import React from 'react';
import { ICON_MAP } from '@/lib/constants';
import type { Department } from '@/lib/constants';

interface CategoryBarProps {
  departments: Department[];
  activeDept: string | null;
  onSelect: (deptId: string) => void;
}

const CategoryBar: React.FC<CategoryBarProps> = ({ departments, activeDept, onSelect }) => {
  const sorted = [...departments].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  return (
    <div className="flex gap-2 px-4 py-3 overflow-x-auto kiosk-scrollbar bg-secondary/50 border-b border-border">
      {sorted.map(dept => {
        const Icon = ICON_MAP[dept.iconName] || ICON_MAP.Utensils;
        const isActive = activeDept === dept.id;
        
        return (
          <button
            key={dept.id}
            onClick={() => onSelect(dept.id)}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${
              isActive
                ? 'kiosk-gradient text-primary-foreground kiosk-shadow scale-105'
                : 'bg-card text-foreground hover:bg-kiosk-surface-hover active:scale-95'
            }`}
          >
            <Icon size={18} />
            <span className="whitespace-nowrap">{dept.name}</span>
          </button>
        );
      })}
    </div>
  );
};

export default CategoryBar;
