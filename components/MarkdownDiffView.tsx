import React, { useEffect, useRef } from 'react';
import { ChangeRecord } from '../types';

interface MarkdownDiffViewProps {
  oldMarkdown: string;
  newMarkdown: string;
  changes: ChangeRecord[];
  selectedChangeId: string | null;
  onSelectChange: (id: string | null) => void;
}

const HighlightedMarkdown: React.FC<{
  text: string;
  changeText: string | undefined;
  changeType: string | undefined;
  isActive: boolean;
  colorClass: string;
}> = ({ text, changeText, changeType, isActive, colorClass }) => {
  if (!changeText || !text.includes(changeText)) {
    return <div className="whitespace-pre-wrap font-mono text-xs text-slate-700">{text}</div>;
  }

  // Split text by the changeText to highlight occurrences
  // Note: This is a simple string match. If the AI text varies slightly from markdown, it won't highlight.
  const parts = text.split(changeText);

  return (
    <div className="whitespace-pre-wrap font-mono text-xs text-slate-700 leading-relaxed">
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {part}
          {i < parts.length - 1 && (
            <span 
                className={`
                    inline-block border-2 rounded px-1 mx-0.5 transition-all duration-300
                    ${colorClass}
                    ${isActive ? 'ring-2 ring-offset-1 ring-blue-400 shadow-lg scale-105 font-bold bg-white z-10 relative' : 'opacity-80'}
                `}
                id={isActive ? "active-highlight" : undefined}
            >
              {changeText}
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

const MarkdownDiffView: React.FC<MarkdownDiffViewProps> = ({
  oldMarkdown,
  newMarkdown,
  changes,
  selectedChangeId,
  onSelectChange
}) => {
  const selectedChange = changes.find(c => c.id === selectedChangeId);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to active highlight
  useEffect(() => {
    const el = document.getElementById("active-highlight");
    if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedChangeId]);

  const getBorderColor = (type: string) => {
     switch(type) {
         case 'addition': return 'border-green-500 bg-green-50 text-green-900';
         case 'deletion': return 'border-red-500 bg-red-50 text-red-900';
         case 'modification': return 'border-blue-500 bg-blue-50 text-blue-900';
         default: return 'border-amber-500 bg-amber-50';
     }
  };

  return (
    <div className="flex h-full overflow-hidden bg-white" ref={scrollRef}>
      {/* Old Version */}
      <div className="flex-1 flex flex-col border-r">
        <div className="p-3 border-b bg-red-50 flex items-center justify-between">
            <span className="text-xs font-bold text-red-800 uppercase tracking-wider">Original Text (Markdown)</span>
        </div>
        <div className="flex-1 overflow-auto p-6 bg-slate-50">
            <HighlightedMarkdown 
                text={oldMarkdown}
                changeText={selectedChange?.originalText}
                changeType={selectedChange?.type}
                isActive={!!selectedChange}
                colorClass={selectedChange ? getBorderColor('deletion') : ''}
            />
        </div>
      </div>

      {/* New Version */}
      <div className="flex-1 flex flex-col">
        <div className="p-3 border-b bg-green-50 flex items-center justify-between">
            <span className="text-xs font-bold text-green-800 uppercase tracking-wider">Revised Text (Markdown)</span>
        </div>
        <div className="flex-1 overflow-auto p-6 bg-white">
             <HighlightedMarkdown 
                text={newMarkdown}
                changeText={selectedChange?.revisedText}
                changeType={selectedChange?.type}
                isActive={!!selectedChange}
                colorClass={selectedChange ? getBorderColor('addition') : ''}
            />
        </div>
      </div>
    </div>
  );
};

export default MarkdownDiffView;