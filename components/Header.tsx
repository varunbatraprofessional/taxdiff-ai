import React from 'react';
import { Scale, FileText } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="h-16 border-b bg-white px-6 flex items-center justify-between sticky top-0 z-50 shadow-sm">
      <div className="flex items-center gap-2 text-blue-700">
        <Scale className="w-6 h-6" />
        <h1 className="text-xl font-bold tracking-tight">TaxDiff AI</h1>
      </div>
      <div className="flex items-center gap-4 text-sm text-slate-500">
        <div className="flex items-center gap-1">
          <FileText className="w-4 h-4" />
          <span>IRS Form Comparator</span>
        </div>
        <div className="h-4 w-px bg-slate-200"></div>
        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">Gemini 2.5 Flash</span>
      </div>
    </header>
  );
};

export default Header;