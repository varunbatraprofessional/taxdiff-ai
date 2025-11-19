import React from 'react';
import { ComparisonResult, ChangeRecord } from '../types';
import { AlertTriangle, PlusCircle, MinusCircle, Edit2, Layout, FileText, ArrowRight } from 'lucide-react';

interface ResultsPanelProps {
  results: ComparisonResult | undefined;
  isLoading: boolean;
  onHoverChange: (id: string | null) => void;
  onSelectChange: (id: string | null) => void;
  onShowDiffMask: () => void;
  hoveredChangeId: string | null;
  selectedChangeId: string | null;
  isDiffMaskActive: boolean;
  oldPageImage: string | null;
  newPageImage: string | null;
}

// Sub-component for rendering the visual crop
const VisualCrop: React.FC<{ 
    image: string; 
    box: number[]; 
    label: string;
    color: string;
}> = ({ image, box, label, color }) => {
    // box is [ymin, xmin, ymax, xmax] in percentages
    const [ymin, xmin, ymax, xmax] = box;
    const widthPct = xmax - xmin;
    const heightPct = ymax - ymin;
    
    // Add some padding to the crop for context (5%)
    const pad = 2; 
    const cYmin = Math.max(0, ymin - pad);
    const cXmin = Math.max(0, xmin - pad);
    const cYmax = Math.min(100, ymax + pad);
    const cXmax = Math.min(100, xmax + pad);
    
    const cWidth = cXmax - cXmin;
    const cHeight = cYmax - cYmin;

    return (
        <div className="flex flex-col gap-1">
            <span className={`text-[10px] font-bold uppercase ${color}`}>{label}</span>
            <div className="relative w-full aspect-video bg-slate-100 rounded border border-slate-200 overflow-hidden">
                <div 
                    style={{
                        width: '100%',
                        height: '100%',
                        position: 'relative'
                    }}
                >
                    <img 
                        src={image} 
                        alt="crop"
                        style={{
                            position: 'absolute',
                            top: `-${cYmin * (100 / cHeight)}%`,
                            left: `-${cXmin * (100 / cWidth)}%`,
                            width: `${(100 / cWidth) * 100}%`,
                            maxWidth: 'none', // Allow image to overflow
                        }} 
                    />
                </div>
            </div>
        </div>
    );
};

const ResultsPanel: React.FC<ResultsPanelProps> = ({ 
  results, 
  isLoading, 
  onHoverChange, 
  onSelectChange,
  onShowDiffMask,
  hoveredChangeId,
  selectedChangeId,
  isDiffMaskActive,
  oldPageImage,
  newPageImage
}) => {
  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-slate-400 animate-pulse">
        <div className="w-16 h-16 bg-slate-200 rounded-full mb-4"></div>
        <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-slate-200 rounded w-1/2"></div>
        <p className="mt-6 text-sm font-medium text-slate-500">Gemini is analyzing regulations...</p>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-slate-400 text-center">
        <p>Select two files and click "Analyze Differences" to start.</p>
      </div>
    );
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'addition': return <PlusCircle className="w-4 h-4 text-green-600" />;
      case 'deletion': return <MinusCircle className="w-4 h-4 text-red-600" />;
      case 'modification': return <Edit2 className="w-4 h-4 text-blue-600" />;
      case 'layout': return <Layout className="w-4 h-4 text-purple-600" />;
      default: return <AlertTriangle className="w-4 h-4 text-amber-600" />;
    }
  };

  const getBadgeColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-amber-100 text-amber-700';
      case 'low': return 'bg-slate-100 text-slate-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-l overflow-hidden">
      <div className="p-5 border-b bg-slate-50">
        <div className="flex justify-between items-start mb-3">
            <h2 className="font-semibold text-slate-800">AI Analysis Summary</h2>
            <button 
                onClick={onShowDiffMask}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors ${
                    isDiffMaskActive 
                        ? 'bg-purple-100 text-purple-700 border-purple-200' 
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
                title="Show generated markdown diff"
            >
                <FileText className="w-3 h-3" />
                {isDiffMaskActive ? 'Hide Proof' : 'Text Proof'}
            </button>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          {results.summary}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Detected Changes</h3>
        
        {results.changes.length === 0 && (
          <p className="text-sm text-slate-400 italic">No significant changes detected on this page.</p>
        )}

        {results.changes.map((change) => {
          const isSelected = selectedChangeId === change.id;
          const isHovered = hoveredChangeId === change.id;
          
          // Use the first bounding box for the preview crop
          const previewBox = change.boundingBoxes && change.boundingBoxes.length > 0 
             ? change.boundingBoxes[0] 
             : change.boundingBox 
                ? change.boundingBox 
                : null;

          return (
            <div 
              key={change.id}
              onMouseEnter={() => onHoverChange(change.id)}
              onMouseLeave={() => onHoverChange(null)}
              onClick={() => onSelectChange(isSelected ? null : change.id)}
              className={`
                rounded-lg border transition-all duration-200 cursor-pointer overflow-hidden
                ${isSelected 
                  ? 'border-blue-500 bg-white shadow-lg ring-1 ring-blue-200' 
                  : isHovered
                    ? 'border-blue-300 bg-slate-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'
                }
              `}
            >
              {/* Header Section */}
              <div className={`p-3 ${isSelected ? 'bg-blue-50/50 border-b border-blue-100' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                    {getIcon(change.type)}
                    <span className="text-xs font-semibold text-slate-700 capitalize">{change.type}</span>
                    </div>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${getBadgeColor(change.severity)}`}>
                    {change.severity}
                    </span>
                </div>
                <p className="text-sm text-slate-800 font-medium mb-1">{change.section}</p>
                <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{change.description}</p>
              </div>

              {/* Expanded Proof Section */}
              {isSelected && (
                  <div className="p-3 bg-slate-50 space-y-4 animate-in slide-in-from-top-2 duration-200">
                    
                    {/* Text Evidence */}
                    <div className="space-y-2">
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Text Comparison</p>
                         <div className="grid gap-2 text-xs">
                             <div className="bg-red-50 border border-red-100 p-2 rounded">
                                 <span className="text-[10px] font-bold text-red-400 block mb-1">WAS:</span>
                                 <p className="text-red-900 font-mono leading-snug">{change.originalText || "(No text detected)"}</p>
                             </div>
                             <div className="flex justify-center -my-4 relative z-10">
                                 <div className="bg-white border rounded-full p-1 shadow-sm">
                                     <ArrowRight className="w-3 h-3 text-slate-400" />
                                 </div>
                             </div>
                             <div className="bg-green-50 border border-green-100 p-2 rounded">
                                 <span className="text-[10px] font-bold text-green-400 block mb-1">BECAME:</span>
                                 <p className="text-green-900 font-mono leading-snug">{change.revisedText || "(No text detected)"}</p>
                             </div>
                         </div>
                         <p className="text-[10px] text-blue-400 italic text-right">See highlighted Markdown Proof →</p>
                    </div>

                  </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ResultsPanel;