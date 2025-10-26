import { useState, useEffect, useCallback } from 'react';
import { padAnalyzer } from '../utils/padAnalyzer';

export const usePadAnalysis = () => {
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize the analyzer on mount
  useEffect(() => {
    const init = async () => {
      try {
        await padAnalyzer.initialize();
        setIsReady(true);
        console.log('Pad analyzer ready');
      } catch (err) {
        console.error('Failed to initialize analyzer:', err);
        setError('Failed to initialize AI analyzer');
      }
    };

    init();

    // Cleanup on unmount
    return () => {
      padAnalyzer.dispose();
    };
  }, []);

  // Main analyze function
  const analyze = useCallback(async (imageUrl) => {
    if (!isReady) {
      throw new Error('Analyzer not initialized');
    }

    setLoading(true);
    setError(null);

    try {
      const result = await padAnalyzer.analyzePadImage(imageUrl);
      return result;
    } catch (err) {
      console.error('Analysis error:', err);
      setError('Failed to analyze image');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [isReady]);

  return {
    isReady,
    loading,
    error,
    analyze
  };
};