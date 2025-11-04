// src/hooks/usePadAnalysis.js
import { useState, useEffect, useCallback } from 'react';
import { padAnalyzer } from '../utils/padAnalyzer';

export const usePadAnalysis = () => {
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [initError, setInitError] = useState(null);

  // Initialize the analyzer on mount
  useEffect(() => {
    const init = async () => {
      try {
        console.log('🚀 Initializing AI Pad Analyzer...');
        
        // Initialize with your model path
        // Make sure your model files are in public/my_model/
        await padAnalyzer.initialize('/my_model/');
        
        setIsReady(true);
        setInitError(null);
        console.log('✅ Pad analyzer ready');
      } catch (err) {
        console.error('❌ Failed to initialize analyzer:', err);
        setInitError(err.message);
        setIsReady(false);
      }
    };

    init();

    // Cleanup on unmount
    return () => {
      padAnalyzer.dispose();
    };
  }, []);

  // Main analyze function
  const analyze = useCallback(async (imageSource) => {
    if (!isReady) {
      throw new Error('Analyzer not initialized. Please check that model files are loaded.');
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Starting image analysis...');
      const result = await padAnalyzer.analyzePadImage(imageSource);
      console.log('✅ Analysis complete:', result);
      return result;
    } catch (err) {
      console.error('❌ Analysis error:', err);
      setError(err.message || 'Failed to analyze image');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [isReady]);

  return {
    isReady,
    loading,
    error,
    initError,
    analyze
  };
};