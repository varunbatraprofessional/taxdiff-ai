import React, { useEffect, useRef } from 'react';
import { ChangeRecord } from '../types';

interface MarkdownDiffViewProps {
  oldMarkdown: string;
  newMarkdown: string;
  changes: ChangeRecord[];
  selectedChangeId: string | null;
  onSelectChange: (id: string | null) => void;
}

const TaggedMarkdownRenderer: React.FC<{
  text: string;
  changes: ChangeRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isOld: boolean;
}> = ({ text, changes, selectedId, onSelect, isOld }) => {
  // Regex to find <change id="...">...</change>
  // Matches <change id="any">content</change> with support for single/double quotes and whitespace
  const regex = /<change\s+id=["']([^"']+)["']\s*>([\s\S]*?)<\/change>/gi;
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const [_, id, content] = match;
    const index = match.index;
    
    // 1. Text before the tag
    if (index > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`} className="text-slate-700">
          {text.substring(lastIndex, index)}
        </span>
      );
    }

    // 2. The Tagged Content
    const change = changes.find(c => c.id === id);
    const isActive = selectedId === id;
    
    // Base styles
    let className = "inline-block rounded px-0.5 mx-0.5 border-b-2 transition-all duration-200 cursor-pointer ";
    
    if (change) {
      // Determine Color Scheme based on change type and whether it is active
      if (isActive) {
         className += "ring-2 ring-offset-1 ring-blue-400 font-bold z-10 relative shadow-md scale-105 ";
         if (isOld) className += "bg-red-100 border-red-500 text-red-900 ";
         else className += "bg-green-100 border-green-500 text-green-900 ";
      } else {
         // Passive state colors
         if (change.type === 'addition') {
            className += "bg-green-50 border-green-200 text-green-800 ";
         } else if (change.type === 'deletion') {
            className += "bg-red-50 border-red-200 text-red-800 ";
         } else {
            // Modification
             if (isOld) className += "bg-red-50 border-red-200 text-red-800 ";
             else className += "bg-green-50 border-green-200 text-green-800 ";
         }
         className += "hover:opacity-100 hover:shadow-sm ";
      }
    } else {
       // Fallback if ID is found in markdown but not in changes list
       className += "bg-slate-100 border-slate-300 text-slate-500 ";
    }

    parts.push(
      <span 
        key={`change-${id}-${index}`}
        id={isActive ? "active-markdown-change" : `change-${id}`}
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(id);
        }}
        title={change ? `${change.type.toUpperCase()}: ${change.description}` : "Unknown Change"}
      >
        {content}
      </span>
    );

    lastIndex = regex.lastIndex;
  }

  // 3. Remaining text
  if (lastIndex < text.length) {
    parts.push(
        <span key={`text-${lastIndex}`} className="text-slate-700">
          {text.substring(lastIndex)}
        </span>
    );
  }

  return <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed">{parts}</div>;
};

const MarkdownDiffView: React.FC<MarkdownDiffViewProps> = ({
  oldMarkdown,
  newMarkdown,
  changes,
  selectedChangeId,
  onSelectChange
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to active highlight
  useEffect(() => {
    const el = document.getElementById("active-markdown-change");
    if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedChangeId]);

  return (
    <div className="flex h-full overflow-hidden bg-white" ref={scrollRef}>
      {/* Old Version */}
      <div className="flex-1 flex flex-col border-r min-w-0">
        <div className="p-3 border-b bg-red-50 flex items-center justify-between shrink-0">
            <span className="text-xs font-bold text-red-800 uppercase tracking-wider">Original Text (Markdown)</span>
        </div>
        <div className="flex-1 overflow-auto p-6 bg-slate-50">
            <TaggedMarkdownRenderer 
                text={oldMarkdown}
                changes={changes}
                selectedId={selectedChangeId}
                onSelect={onSelectChange}
                isOld={true}
            />
        </div>
      </div>

      {/* New Version */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-3 border-b bg-green-50 flex items-center justify-between shrink-0">
            <span className="text-xs font-bold text-green-800 uppercase tracking-wider">Revised Text (Markdown)</span>
        </div>
        <div className="flex-1 overflow-auto p-6 bg-white">
             <TaggedMarkdownRenderer 
                text={newMarkdown}
                changes={changes}
                selectedId={selectedChangeId}
                onSelect={onSelectChange}
                isOld={false}
            />
        </div>
      </div>
    </div>
  );
};

export default MarkdownDiffView;