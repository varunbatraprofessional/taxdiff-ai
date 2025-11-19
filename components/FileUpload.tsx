import React, { useRef } from 'react';
import { UploadCloud, FileType } from 'lucide-react';

interface FileUploadProps {
  label: string;
  subLabel: string;
  onFileSelect: (file: File) => void;
  selectedFileName?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ label, subLabel, onFileSelect, selectedFileName }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div 
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className={`
        relative group cursor-pointer border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all duration-200
        ${selectedFileName 
          ? 'border-blue-400 bg-blue-50' 
          : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'
        }
      `}
    >
      <input 
        type="file" 
        ref={inputRef} 
        accept="application/pdf" 
        className="hidden" 
        onChange={(e) => e.target.files && onFileSelect(e.target.files[0])}
      />
      
      {selectedFileName ? (
        <>
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3 shadow-sm">
            <FileType className="w-6 h-6" />
          </div>
          <p className="font-medium text-blue-900 truncate max-w-full px-4">{selectedFileName}</p>
          <p className="text-xs text-blue-500 mt-1">Click to replace</p>
        </>
      ) : (
        <>
          <div className="w-12 h-12 bg-slate-100 text-slate-400 group-hover:text-blue-500 group-hover:bg-blue-100 rounded-full flex items-center justify-center mb-3 transition-colors">
            <UploadCloud className="w-6 h-6" />
          </div>
          <p className="font-medium text-slate-700">{label}</p>
          <p className="text-xs text-slate-400 mt-1">{subLabel}</p>
        </>
      )}
    </div>
  );
};

export default FileUpload;