import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure the pdf.js worker for Vite
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const PdfPreviewModal = ({ isOpen, onClose, pdfData }) => {
  const [numPages, setNumPages] = useState(null);
  const [error, setError] = useState(null);

  if (!isOpen || !pdfData) return null;

  const handleDownload = () => {
    const url = URL.createObjectURL(pdfData.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = pdfData.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4 sm:p-6">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">Preview Dokumen</h2>
          <div className="flex space-x-3">
            <button
              onClick={handleDownload}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 transition shadow-sm"
            >
              Download PDF
            </button>
            <button
              onClick={onClose}
              className="bg-gray-200 text-gray-800 px-5 py-2 rounded-lg font-medium hover:bg-gray-300 transition"
            >
              Tutup
            </button>
          </div>
        </div>
        
        {/* PDF Viewer Content */}
        <div className="flex-1 overflow-auto p-4 flex flex-col items-center bg-gray-100">
          {error && (
            <div className="text-red-500 bg-red-50 p-4 rounded-lg w-full text-center mb-4">
              Gagal memuat PDF: {error.message}
            </div>
          )}
          <Document
            file={pdfData.blob}
            onLoadSuccess={({ numPages }) => {
              setNumPages(numPages);
              setError(null);
            }}
            onLoadError={setError}
            loading={
              <div className="p-10 flex flex-col items-center justify-center text-gray-500">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
                <p>Memuat PDF...</p>
              </div>
            }
            className="flex flex-col items-center w-full"
          >
            {Array.from(new Array(numPages || 0), (el, index) => (
              <div key={`page_${index + 1}`} className="mb-6 shadow-lg rounded-sm overflow-hidden border border-gray-200 max-w-full">
                <Page 
                  pageNumber={index + 1} 
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  width={Math.min(window.innerWidth - 64, 800)}
                  className="max-w-full"
                />
              </div>
            ))}
          </Document>
        </div>
      </div>
    </div>
  );
};

export default PdfPreviewModal;
