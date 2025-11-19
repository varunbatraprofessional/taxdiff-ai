import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import FileUpload from './components/FileUpload';
import ResultsPanel from './components/ResultsPanel';
import BoundingBoxOverlay from './components/BoundingBoxOverlay';
import { loadPdf, renderPageToImage } from './services/pdfService';
import { analyzeDifferences } from './services/geminiService';
import { PdfFile, ViewMode, AnalysisState } from './types';
import { ChevronLeft, ChevronRight, Columns, Eye, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  // File State
  const [oldFile, setOldFile] = useState<PdfFile | null>(null);
  const [newFile, setNewFile] = useState<PdfFile | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  
  // Viewer State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.SIDE_BY_SIDE);
  const [opacity, setOpacity] = useState<number>(50);
  const [zoom, setZoom] = useState<number>(0.8); // Start with a slightly smaller zoom to fit pages
  
  // Image Data (Base64)
  const [oldPageImage, setOldPageImage] = useState<string | null>(null);
  const [newPageImage, setNewPageImage] = useState<string | null>(null);

  // Analysis State
  const [analysis, setAnalysis] = useState<AnalysisState>({
    isLoading: false,
    error: null,
    results: {},
  });

  // UI Interaction State
  const [hoveredChangeId, setHoveredChangeId] = useState<string | null>(null);

  // Handlers
  const handleFileSelect = async (file: File, isOld: boolean) => {
    setIsProcessingFile(true);
    try {
      const numPages = await loadPdf(file);
      const pdfFile: PdfFile = {
        file,
        name: file.name,
        url: URL.createObjectURL(file),
        numPages
      };
      
      if (isOld) setOldFile(pdfFile);
      else setNewFile(pdfFile);

      // Update total pages based on max of both files
      setTotalPages(prev => Math.max(prev, numPages));
      
      // Reset to page 1 when loading new files
      setCurrentPage(1);
    } catch (e) {
      console.error("Failed to load PDF", e);
      alert("Failed to load PDF. Please ensure it is a valid PDF file.");
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Effect: Render pages when current page changes or files change
  useEffect(() => {
    const renderPages = async () => {
      if (!oldFile && !newFile) return;
      
      try {
        // Render logic
        let oldImg = null;
        let newImg = null;

        // Only render if the file exists and page is within range
        if (oldFile && currentPage <= oldFile.numPages) {
          oldImg = await renderPageToImage(oldFile.file, currentPage);
        }
        if (newFile && currentPage <= newFile.numPages) {
          newImg = await renderPageToImage(newFile.file, currentPage);
        }

        setOldPageImage(oldImg);
        setNewPageImage(newImg);
      } catch (err) {
        console.error("Error rendering pages", err);
      }
    };

    renderPages();
  }, [currentPage, oldFile, newFile]);

  // Analysis Logic
  const runAnalysis = useCallback(async () => {
    if (!oldPageImage || !newPageImage) return;
    if (analysis.results[currentPage]) return; // Already analyzed this page

    setAnalysis(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await analyzeDifferences(oldPageImage, newPageImage, currentPage);
      
      // Add IDs to changes for hover effects
      const changesWithIds = result.changes.map((c, i) => ({
        ...c,
        id: `page-${currentPage}-change-${i}`
      }));

      setAnalysis(prev => ({
        ...prev,
        isLoading: false,
        results: {
          ...prev.results,
          [currentPage]: {
            summary: result.summary,
            changes: changesWithIds,
            pageNumber: currentPage
          }
        }
      }));
    } catch (err: any) {
      setAnalysis(prev => ({
        ...prev,
        isLoading: false,
        error: err.message || "Analysis failed"
      }));
    }
  }, [currentPage, oldPageImage, newPageImage, analysis.results]);

  // Render Content
  return (
    <div className="min-h-screen flex flex-col bg-slate-100 h-screen overflow-hidden">
      <Header />

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left: File Selection & Viewer */}
        <div className="flex-1 flex flex-col relative">
          
          {/* Setup View (if files missing) */}
          {(!oldFile || !newFile) && (
            <div className="absolute inset-0 z-20 bg-slate-50 flex items-center justify-center p-8">
              <div className="max-w-3xl w-full bg-white p-10 rounded-2xl shadow-xl relative">
                {isProcessingFile && (
                  <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center rounded-2xl">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                      <p className="text-slate-600 font-medium">Processing PDF...</p>
                    </div>
                  </div>
                )}
                
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Upload Tax Documents</h2>
                <p className="text-slate-500 mb-8">Select the previous year's version and the current version to identify changes.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <FileUpload 
                    label="Original / Previous Year" 
                    subLabel="Drag PDF here" 
                    onFileSelect={(f) => handleFileSelect(f, true)} 
                    selectedFileName={oldFile?.name}
                  />
                  <FileUpload 
                    label="New / Current Year" 
                    subLabel="Drag PDF here" 
                    onFileSelect={(f) => handleFileSelect(f, false)} 
                    selectedFileName={newFile?.name}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div className="h-14 bg-white border-b flex items-center justify-between px-4 shrink-0 z-10">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 hover:bg-slate-100 rounded disabled:opacity-30"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm font-medium w-24 text-center">
                Page {currentPage} of {totalPages}
              </span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 hover:bg-slate-100 rounded disabled:opacity-30"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-1">
              <button 
                onClick={() => setViewMode(ViewMode.SIDE_BY_SIDE)}
                className={`p-1.5 rounded text-xs font-medium flex items-center gap-1 transition-all ${viewMode === ViewMode.SIDE_BY_SIDE ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Columns className="w-4 h-4" /> Split
              </button>
              <button 
                onClick={() => setViewMode(ViewMode.OVERLAY)}
                className={`p-1.5 rounded text-xs font-medium flex items-center gap-1 transition-all ${viewMode === ViewMode.OVERLAY ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Eye className="w-4 h-4" /> Overlay
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} className="p-2 hover:bg-slate-100 rounded"><ZoomOut className="w-4 h-4" /></button>
              <span className="text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(2.5, z + 0.1))} className="p-2 hover:bg-slate-100 rounded"><ZoomIn className="w-4 h-4" /></button>
            </div>

            <button 
              onClick={runAnalysis}
              disabled={analysis.isLoading || !oldPageImage || !newPageImage}
              className={`
                ml-4 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors shadow-sm flex items-center gap-2
                ${analysis.isLoading ? 'bg-blue-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed'}
              `}
            >
              {analysis.isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {analysis.isLoading ? 'Analyzing...' : 'Analyze Page'}
            </button>
          </div>

          {/* Viewer Area */}
          <div className="flex-1 bg-slate-100 overflow-auto p-8 flex justify-center relative">
            
            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.1s' }}>
            
              {/* View Mode: Side by Side */}
              {viewMode === ViewMode.SIDE_BY_SIDE && (
                <div className="flex gap-8 items-start">
                  {oldPageImage ? (
                    <div className="relative shadow-lg bg-white">
                       <div className="absolute -top-6 left-0 text-xs font-bold text-slate-500">ORIGINAL</div>
                       <img src={oldPageImage} className="max-w-[600px] border border-slate-200" alt="Old Page" />
                    </div>
                  ) : (
                    <div className="w-[600px] h-[800px] bg-slate-200 rounded flex items-center justify-center text-slate-400">No Document</div>
                  )}
                  
                  {newPageImage ? (
                    <div className="relative shadow-lg bg-white">
                       <div className="absolute -top-6 left-0 text-xs font-bold text-slate-500">NEW VERSION</div>
                       <img src={newPageImage} className="max-w-[600px] border border-slate-200" alt="New Page" />
                       {/* Overlay changes on the NEW document */}
                       {analysis.results[currentPage] && (
                          <BoundingBoxOverlay 
                            changes={analysis.results[currentPage].changes} 
                            hoveredChangeId={hoveredChangeId}
                            onHover={setHoveredChangeId}
                          />
                       )}
                    </div>
                  ) : (
                    <div className="w-[600px] h-[800px] bg-slate-200 rounded flex items-center justify-center text-slate-400">No Document</div>
                  )}
                </div>
              )}

              {/* View Mode: Overlay/Slider */}
              {viewMode === ViewMode.OVERLAY && oldPageImage && newPageImage && (
                <div className="relative shadow-2xl max-w-[600px] border border-slate-200 bg-white">
                  {/* Base Layer (Old) */}
                  <img src={oldPageImage} className="block w-full" alt="Old Page" />
                  
                  {/* Top Layer (New) with Opacity */}
                  <div className="absolute inset-0" style={{ opacity: opacity / 100 }}>
                    <img src={newPageImage} className="block w-full" alt="New Page" />
                     {/* Only show bounding boxes if opacity is high enough to see the new doc clearly */}
                     {opacity > 30 && analysis.results[currentPage] && (
                        <BoundingBoxOverlay 
                          changes={analysis.results[currentPage].changes} 
                          hoveredChangeId={hoveredChangeId}
                          onHover={setHoveredChangeId}
                        />
                     )}
                  </div>

                  {/* Slider Control - Floating */}
                  <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-6 py-3 rounded-full shadow-xl border border-slate-200 flex items-center gap-4 z-50">
                    <span className="text-xs font-bold text-slate-500">Old</span>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={opacity} 
                      onChange={(e) => setOpacity(Number(e.target.value))}
                      className="w-48 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <span className="text-xs font-bold text-blue-600">New</span>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Right Sidebar: Analysis */}
        <div className="w-80 lg:w-96 bg-white border-l shrink-0 z-10 shadow-xl relative flex flex-col">
          <ResultsPanel 
            results={analysis.results[currentPage]} 
            isLoading={analysis.isLoading}
            hoveredChangeId={hoveredChangeId}
            onHoverChange={setHoveredChangeId}
          />
        </div>

      </div>
    </div>
  );
};

export default App;