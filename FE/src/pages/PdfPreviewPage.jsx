import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure the pdf.js worker for Vite
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

function PdfPreviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const pdfData = location.state?.pdfData;
  
  const [numPages, setNumPages] = useState(null);
  const [error, setError] = useState(null);

  if (!pdfData) {
    return (
      <div className="container" style={{ textAlign: 'center', marginTop: '2rem' }}>
        <h2>No Document Found</h2>
        <button onClick={() => navigate(-1)} className="btn btn-secondary" style={{ marginTop: '1rem' }}>
          &larr; Go Back
        </button>
      </div>
    );
  }

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
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <button onClick={() => navigate(-1)} className="btn btn-secondary">
          &larr; Kembali
        </button>
        <h2 style={{ margin: 0 }}>Preview Dokumen</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={handleDownload} className="btn btn-primary">
              Download PDF
            </button>
        </div>
      </div>

      <div className="card" style={{ padding: '0', backgroundColor: '#e2e8f0', minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '2rem', paddingBottom: '2rem' }}>
        {error && (
          <div style={{ color: '#dc2626', backgroundColor: '#fee2e2', padding: '1rem', borderRadius: '4px', marginBottom: '1rem', width: '90%', maxWidth: '800px' }}>
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
          loading={<div style={{ padding: '2rem', color: '#64748b' }}>Memuat PDF...</div>}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}
        >
          {Array.from(new Array(numPages || 0), (el, index) => (
            <div key={`page_${index + 1}`} style={{ marginBottom: '2rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', borderRadius: '4px', overflow: 'hidden' }}>
              <Page 
                pageNumber={index + 1} 
                renderTextLayer={false}
                renderAnnotationLayer={false}
                width={Math.min(window.innerWidth - 64, 800)}
              />
            </div>
          ))}
        </Document>
      </div>
    </div>
  );
}

export default PdfPreviewPage;
