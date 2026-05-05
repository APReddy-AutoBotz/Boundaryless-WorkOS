import { Search, Filter, Download, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ReactNode } from 'react';

interface FilterBarProps {
  children?: ReactNode;
  onSearchChange?: (val: string) => void;
  onFilterClick?: () => void;
  onExportClick?: () => void;
  onAddClick?: () => void;
  addButtonText?: string;
  placeholder?: string;
}

export const FilterBar = ({ 
  children, 
  onSearchChange, 
  onFilterClick, 
  onExportClick, 
  onAddClick,
  addButtonText = "Add New",
  placeholder = "Search records..."
}: FilterBarProps) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input 
          type="text" 
          placeholder={placeholder}
          onChange={(e) => onSearchChange?.(e.target.value)}
          className="w-full bg-white border border-border-light rounded-md py-2 pl-10 pr-4 text-xs focus:outline-none focus:border-primary transition-all"
        />
      </div>
      
      <div className="flex items-center gap-2">
        <button 
          onClick={onFilterClick}
          className="btn-secondary py-2 px-4 text-[11px] font-bold uppercase tracking-wider flex items-center gap-2"
        >
          <Filter size={14} /> Filters
        </button>
        
        <button 
          onClick={onExportClick}
          className="btn-secondary py-2 px-4 text-[11px] font-bold uppercase tracking-wider flex items-center gap-2"
        >
          <Download size={14} /> Export
        </button>
        
        {onAddClick && (
          <button 
            onClick={onAddClick}
            className="btn-primary py-2 px-4 text-[11px] font-bold uppercase tracking-wider flex items-center gap-2"
          >
            <Plus size={14} /> {addButtonText}
          </button>
        )}
      </div>

      {children && (
        <div className="w-full flex items-center gap-4 pt-4 border-t border-border-light">
          {children}
        </div>
      )}
    </div>
  );
};
