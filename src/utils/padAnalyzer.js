// ===== padAnalyzer.js =====
// Place this file in: src/utils/padAnalyzer.js

import * as tf from '@tensorflow/tfjs';

class PadAnalyzer {
  constructor() {
    this.model = null;
    this.isInitialized = false;
  }

  /**
   * Initialize TensorFlow.js and load the model
   * Call this once when your app starts
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('Initializing TensorFlow.js...');
      await tf.ready();
      console.log('TensorFlow.js initialized successfully');
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize TensorFlow.js:', error);
      throw error;
    }
  }

  /**
   * Load an image from URL and convert to tensor
   */
  async loadImageAsTensor(imageUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          // Convert image to tensor
          const tensor = tf.browser.fromPixels(img)
            .resizeNearestNeighbor([224, 224]) // Resize to standard size
            .toFloat()
            .div(tf.scalar(255.0)) // Normalize to 0-1
            .expandDims();
          
          resolve({ tensor, img });
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = imageUrl;
    });
  }

  /**
   * Analyze color distribution in the image
   */
  async analyzeColors(imageTensor) {
    return tf.tidy(() => {
      // Split into RGB channels
      const [red, green, blue] = tf.split(imageTensor.squeeze(), 3, 2);
      
      // Calculate mean values for each channel
      const redMean = red.mean().dataSync()[0];
      const greenMean = green.mean().dataSync()[0];
      const blueMean = blue.mean().dataSync()[0];
      
      // Calculate color intensities
      // Red blood: High red, low green/blue
      const redIntensity = redMean * (1 - greenMean) * (1 - blueMean);
      
      // Brown/oxidized blood: Moderate red, some green, low blue
      const brownIntensity = redMean * greenMean * (1 - blueMean) * 0.8;
      
      // Pink: High red and green and blue (lighter colors)
      const pinkIntensity = (redMean * greenMean * blueMean) * 1.2;
      
      // Calculate standard deviation for texture analysis
      const redStd = tf.moments(red.flatten()).variance.sqrt().dataSync()[0];
      const greenStd = tf.moments(green.flatten()).variance.sqrt().dataSync()[0];
      const blueStd = tf.moments(blue.flatten()).variance.sqrt().dataSync()[0];
      
      const textureComplexity = (redStd + greenStd + blueStd) / 3;
      
      return {
        redMean,
        greenMean,
        blueMean,
        redIntensity,
        brownIntensity,
        pinkIntensity,
        textureComplexity
      };
    });
  }

  /**
   * Detect potential clots using edge detection and clustering
   */
  async detectClots(imageTensor) {
    return tf.tidy(() => {
      // Convert to grayscale
      const grayscale = imageTensor.squeeze()
        .mean(2)
        .expandDims(2);
      
      // Apply Sobel edge detection (simplified)
      const kernel = tf.tensor2d([
        [-1, 0, 1],
        [-2, 0, 2],
        [-1, 0, 1]
      ]).expandDims(2).expandDims(3);
      
      const edges = tf.conv2d(
        grayscale.expandDims(0),
        kernel,
        1,
        'same'
      );
      
      // Count edge pixels (potential clots have high edge density)
      const edgeThreshold = 0.3;
      const edgePixels = tf.greater(tf.abs(edges), edgeThreshold);
      const edgeDensity = edgePixels.sum().dataSync()[0] / (224 * 224);
      
      // Analyze variance (clots create texture variation)
      const variance = tf.moments(grayscale.flatten()).variance.dataSync()[0];
      
      // Clot likelihood based on edge density and variance
      const clotLikelihood = (edgeDensity * 0.6 + variance * 0.4);
      
      return {
        edgeDensity,
        variance,
        clotLikelihood,
        hasClots: clotLikelihood > 0.15
      };
    });
  }

  /**
   * Analyze color regions for abnormalities
   */
  async analyzeRegions(imageTensor) {
    return tf.tidy(() => {
      const [red, green, blue] = tf.split(imageTensor.squeeze(), 3, 2);
      
      // Detect dark red regions (potential concern)
      const darkRedMask = tf.logicalAnd(
        tf.greater(red, 0.5),
        tf.less(green, 0.3)
      );
      const darkRedArea = darkRedMask.sum().dataSync()[0] / (224 * 224);
      
      // Detect brown regions
      const brownMask = tf.logicalAnd(
        tf.logicalAnd(
          tf.greater(red, 0.4),
          tf.greater(green, 0.2)
        ),
        tf.less(blue, 0.3)
      );
      const brownArea = brownMask.sum().dataSync()[0] / (224 * 224);
      
      // Detect very bright regions (might be problematic)
      const brightMask = tf.greater(
        tf.add(tf.add(red, green), blue).div(3),
        0.85
      );
      const brightArea = brightMask.sum().dataSync()[0] / (224 * 224);
      
      return {
        darkRedArea,
        brownArea,
        brightArea,
        hasConcerningRegions: darkRedArea > 0.15 || brownArea > 0.20
      };
    });
  }

  /**
   * Main analysis function
   */
  async analyzePadImage(imageUrl) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log('Starting pad image analysis...');
      
      // Load image as tensor
      const { tensor, img } = await this.loadImageAsTensor(imageUrl);
      
      // Run all analyses
      const [colorAnalysis, clotAnalysis, regionAnalysis] = await Promise.all([
        this.analyzeColors(tensor),
        this.detectClots(tensor),
        this.analyzeRegions(tensor)
      ]);
      
      // Clean up tensor
      tensor.dispose();
      
      // Combine results and generate findings
      const results = this.generateReport(colorAnalysis, clotAnalysis, regionAnalysis);
      
      console.log('Analysis complete:', results);
      return results;
      
    } catch (error) {
      console.error('Analysis failed:', error);
      throw error;
    }
  }

  /**
   * Generate comprehensive analysis report
   */
  generateReport(colorAnalysis, clotAnalysis, regionAnalysis) {
    const abnormalities = [];
    let bloodDetected = false;
    let clotPresence = false;
    let riskLevel = 'low';
    
    // Analyze color findings
    if (colorAnalysis.redIntensity > 0.15) {
      bloodDetected = true;
      abnormalities.push('Fresh blood detected in sample');
    }
    
    if (colorAnalysis.brownIntensity > 0.12) {
      abnormalities.push('Oxidized blood or brown discharge present');
    }
    
    // Analyze clot findings
    if (clotAnalysis.hasClots || clotAnalysis.clotLikelihood > 0.15) {
      clotPresence = true;
      abnormalities.push('Potential clot formations or tissue fragments detected');
    }
    
    // Analyze regional findings
    if (regionAnalysis.hasConcerningRegions) {
      abnormalities.push('Irregular color distribution detected');
    }
    
    if (regionAnalysis.darkRedArea > 0.20) {
      abnormalities.push('High concentration of dark blood observed');
    }
    
    // Texture analysis
    if (colorAnalysis.textureComplexity > 0.25) {
      abnormalities.push('Complex texture pattern - may indicate tissue presence');
    }
    
    // Determine risk level
    const riskScore = 
      (colorAnalysis.redIntensity * 30) +
      (colorAnalysis.brownIntensity * 25) +
      (clotAnalysis.clotLikelihood * 35) +
      (regionAnalysis.darkRedArea * 10);
    
    if (riskScore > 15 || (bloodDetected && clotPresence)) {
      riskLevel = 'high';
    } else if (riskScore > 8 || bloodDetected || clotPresence) {
      riskLevel = 'moderate';
    }
    
    // Calculate confidence (based on image quality indicators)
    const confidence = Math.min(95, 75 + (colorAnalysis.textureComplexity * 50));
    
    // Convert color values to percentages
    const normalizeToPercent = (value, max = 1) => {
      return Math.min(100, Math.max(0, Math.round((value / max) * 100)));
    };
    
    return {
      timestamp: new Date().toISOString(),
      findings: {
        bloodDetected,
        clotPresence,
        colorAnalysis: {
          red: normalizeToPercent(colorAnalysis.redIntensity * 2),
          brown: normalizeToPercent(colorAnalysis.brownIntensity * 2.5),
          pink: normalizeToPercent(colorAnalysis.pinkIntensity * 1.5)
        },
        abnormalities: abnormalities.length > 0 
          ? abnormalities 
          : ['No significant abnormalities detected'],
        textureComplexity: colorAnalysis.textureComplexity.toFixed(3),
        clotLikelihood: clotAnalysis.clotLikelihood.toFixed(3)
      },
      confidence: confidence.toFixed(1),
      riskLevel,
      technicalDetails: {
        edgeDensity: clotAnalysis.edgeDensity.toFixed(3),
        variance: clotAnalysis.variance.toFixed(3),
        darkRedArea: (regionAnalysis.darkRedArea * 100).toFixed(1) + '%',
        brownArea: (regionAnalysis.brownArea * 100).toFixed(1) + '%'
      }
    };
  }

  /**
   * Dispose of resources
   */
  dispose() {
    if (this.model) {
      this.model.dispose();
    }
  }
}

// Export singleton instance
export const padAnalyzer = new PadAnalyzer();

// Export class for testing/custom instances
export default PadAnalyzer;