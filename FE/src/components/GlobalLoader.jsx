import React, { useState, useEffect } from 'react';

const GlobalLoader = () => {
  const [loadingCount, setLoadingCount] = useState(0);

  useEffect(() => {
    const handleStart = () => setLoadingCount(c => c + 1);
    const handleEnd = () => setLoadingCount(c => Math.max(0, c - 1));

    window.addEventListener('loading:start', handleStart);
    window.addEventListener('loading:end', handleEnd);

    return () => {
      window.removeEventListener('loading:start', handleStart);
      window.removeEventListener('loading:end', handleEnd);
    };
  }, []);

  if (loadingCount === 0) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 9999, flexDirection: 'column', gap: '1rem', color: 'white' }}>
      <div className="spinner" style={{ borderTopColor: 'white', borderRightColor: 'white' }}></div>
      <p style={{ fontWeight: 'bold' }}>Processing...</p>
    </div>
  );
};

export default GlobalLoader;
