import React from 'react';
import { ChangeRecord } from '../types';

interface BoundingBoxOverlayProps {
  changes: ChangeRecord[];
  hoveredChangeId: string | null;
  selectedChangeId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
}

const BoundingBoxOverlay: React.FC<BoundingBoxOverlayProps> = ({ 
  changes, 
  hoveredChangeId, 
  selectedChangeId,
  onHover,
  onSelect
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {changes.map((change) => {
        // normalize to array of boxes, whether it has one or many
        const boxes = change.boundingBoxes || (change.boundingBox ? [change.boundingBox] : []);
        
        if (boxes.length === 0) return null;

        const isHovered = hoveredChangeId === change.id;
        const isSelected = selectedChangeId === change.id;
        const isActive = isHovered || isSelected;

        let borderColor = 'border-blue-500';
        let bgColor = 'bg-blue-500/10';

        if (change.type === 'addition') {
            borderColor = 'border-green-500';
            bgColor = 'bg-green-500/10';
        } else if (change.type === 'deletion') {
            borderColor = 'border-red-500';
            bgColor = 'bg-red-500/10';
        }

        return (
          <React.Fragment key={change.id}>
            {boxes.map((box, index) => {
               const [ymin, xmin, ymax, xmax] = box;
               return (
                <div
                  key={`${change.id}-${index}`}
                  className={`
                    absolute border-2 transition-all duration-200 pointer-events-auto cursor-pointer
                    ${borderColor} 
                    ${isActive ? bgColor : 'bg-transparent'}
                    ${isSelected ? 'ring-2 ring-offset-1 ring-blue-400 z-20' : 'z-10'}
                  `}
                  style={{
                    top: `${ymin}%`,
                    left: `${xmin}%`,
                    height: `${ymax - ymin}%`,
                    width: `${xmax - xmin}%`,
                    opacity: isActive ? 1 : 0.4,
                    boxShadow: isActive ? '0 0 15px rgba(0,0,0,0.15)' : 'none'
                  }}
                  onMouseEnter={() => onHover(change.id)}
                  onMouseLeave={() => onHover(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(isSelected ? null : change.id);
                  }}
                >
                  {/* Only show label on the first box of the group to avoid clutter */}
                  {isActive && index === 0 && (
                      <div className="absolute -top-8 left-0 bg-slate-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-50">
                          {change.type.toUpperCase()}: {change.section}
                      </div>
                  )}
                </div>
               );
            })}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default BoundingBoxOverlay;