import React from 'react';
import { ChangeRecord } from '../types';

interface BoundingBoxOverlayProps {
  changes: ChangeRecord[];
  hoveredChangeId: string | null;
  onHover: (id: string | null) => void;
}

const BoundingBoxOverlay: React.FC<BoundingBoxOverlayProps> = ({ changes, hoveredChangeId, onHover }) => {
  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {changes.map((change) => {
        if (!change.boundingBox || change.boundingBox.length !== 4) return null;

        const [ymin, xmin, ymax, xmax] = change.boundingBox;
        const isHovered = hoveredChangeId === change.id;

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
          <div
            key={change.id}
            className={`absolute border-2 transition-all duration-200 pointer-events-auto cursor-help ${borderColor} ${isHovered ? bgColor : 'bg-transparent'}`}
            style={{
              top: `${ymin}%`,
              left: `${xmin}%`,
              height: `${ymax - ymin}%`,
              width: `${xmax - xmin}%`,
              opacity: isHovered ? 1 : 0.6,
              boxShadow: isHovered ? '0 0 10px rgba(0,0,0,0.2)' : 'none'
            }}
            onMouseEnter={() => onHover(change.id)}
            onMouseLeave={() => onHover(null)}
          >
            {isHovered && (
                <div className="absolute -top-8 left-0 bg-slate-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-50">
                    {change.type.toUpperCase()}: {change.section}
                </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default BoundingBoxOverlay;