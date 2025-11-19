import React from 'react';
import { ComparisonResult, ChangeRecord } from '../types';
import { AlertTriangle, PlusCircle, MinusCircle, Edit2, Layout } from 'lucide-react';

interface ResultsPanelProps {
  results: ComparisonResult | undefined;
  isLoading: boolean;
  onHoverChange: (id: string | null) => void;
  hoveredChangeId: string | null;
}

const ResultsPanel: React.FC<ResultsPanelProps> = ({ results, isLoading, onHoverChange, hoveredChangeId }) => {
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
        <h2 className="font-semibold text-slate-800 mb-1">AI Analysis Summary</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          {results.summary}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Detected Changes</h3>
        
        {results.changes.length === 0 && (
          <p className="text-sm text-slate-400 italic">No significant changes detected on this page.</p>
        )}

        {results.changes.map((change) => (
          <div 
            key={change.id}
            onMouseEnter={() => onHoverChange(change.id)}
            onMouseLeave={() => onHoverChange(null)}
            className={`
              p-3 rounded-lg border transition-all duration-200 cursor-pointer
              ${hoveredChangeId === change.id 
                ? 'border-blue-400 bg-blue-50 shadow-md scale-[1.02]' 
                : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
              }
            `}
          >
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
            <p className="text-xs text-slate-600 leading-relaxed">{change.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ResultsPanel;