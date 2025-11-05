// AI-Powered PadAnalyzer using TensorFlow.js for clot detection
import * as tf from '@tensorflow/tfjs';

class PadAnalyzer {
  constructor(options = {}) {
    this.options = {
      blurRadius: options.blurRadius ?? 1,
      minClotPixels: options.minClotPixels ?? 40,
      maxClotPixels: options.maxClotPixels ?? 1000,
      scalePxPerCm: options.scalePxPerCm ?? null,
      padDryWeightGrams: options.padDryWeightGrams ?? 5,
      modelConfidenceThreshold: options.modelConfidenceThreshold ?? 0.65,
      segmentationThreshold: options.segmentationThreshold ?? 0.5,
      ...options
    };
    this.initialized = false;
    this.segmentationModel = null;
    this.clotClassifier = null;
  }

  async initialize() {
    try {
      console.log('PadAnalyzer: Initializing AI models...');
      
      this.segmentationModel = await this._createSegmentationModel();
      
      this.clotClassifier = await this._createClotClassifier();
      
      this.initialized = true;
      console.log('PadAnalyzer: AI models loaded successfully');
      return true;
    } catch (error) {
      console.error('PadAnalyzer initialization failed:', error);
      throw new Error('Failed to initialize AI models: ' + error.message);
    }
  }

  async _createSegmentationModel() {
    const model = tf.sequential({
      layers: [
        tf.layers.conv2d({
          inputShape: [224, 224, 3],
          filters: 32,
          kernelSize: 3,
          activation: 'relu',
          padding: 'same'
        }),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        
        tf.layers.conv2d({
          filters: 64,
          kernelSize: 3,
          activation: 'relu',
          padding: 'same'
        }),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        
        tf.layers.conv2d({
          filters: 128,
          kernelSize: 3,
          activation: 'relu',
          padding: 'same'
        }),
        
        tf.layers.upSampling2d({ size: [2, 2] }),
        tf.layers.conv2d({
          filters: 64,
          kernelSize: 3,
          activation: 'relu',
          padding: 'same'
        }),
        
        tf.layers.upSampling2d({ size: [2, 2] }),
        tf.layers.conv2d({
          filters: 32,
          kernelSize: 3,
          activation: 'relu',
          padding: 'same'
        }),
        
        tf.layers.conv2d({
          filters: 3,
          kernelSize: 1,
          activation: 'softmax',
          padding: 'same'
        })
      ]
    });
    
    return model;
  }

  // Create clot classification model
  async _createClotClassifier() {
    const model = tf.sequential({
      layers: [
        // Input: 64x64x3 region patch
        tf.layers.conv2d({
          inputShape: [64, 64, 3],
          filters: 32,
          kernelSize: 3,
          activation: 'relu'
        }),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        
        tf.layers.conv2d({
          filters: 64,
          kernelSize: 3,
          activation: 'relu'
        }),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        
        tf.layers.conv2d({
          filters: 128,
          kernelSize: 3,
          activation: 'relu'
        }),
        tf.layers.globalAveragePooling2d(),
        
        tf.layers.dense({ units: 128, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.5 }),
        
        // Output: [not_clot, small_clot, large_clot, old_blood]
        tf.layers.dense({ units: 4, activation: 'softmax' })
      ]
    });
    
    return model;
  }

  calibrateScale(padWidthCm, imagePadWidthPx) {
    if (!padWidthCm || !imagePadWidthPx) return;
    this.options.scalePxPerCm = imagePadWidthPx / padWidthCm;
    console.log('PadAnalyzer: calibrated scale px/cm =', this.options.scalePxPerCm);
  }

  dispose() {
    if (this.segmentationModel) {
      this.segmentationModel.dispose();
      this.segmentationModel = null;
    }
    if (this.clotClassifier) {
      this.clotClassifier.dispose();
      this.clotClassifier = null;
    }
    this.initialized = false;
    console.log('PadAnalyzer: Models disposed');
  }

  async analyzePadImage(imageSource, weightGrams = 0, opts = {}) {
    if (!this.initialized) {
      throw new Error('Analyzer not initialized. Call initialize() first.');
    }
    
    const mergedOptions = { ...this.options, ...opts };
    
    try {
      const img = await this._loadImage(imageSource);
      const preprocessed = await this._preprocessImage(img, mergedOptions);
      
      const segmentationResult = await this._runSegmentation(preprocessed);
      
      const regions = await this._extractRegions(
        img, 
        segmentationResult, 
        mergedOptions
      );
      
      const classifiedClots = await this._classifyRegions(regions, mergedOptions);
      
      const coverage = this._calculateCoverage(segmentationResult);
      const flow = this._estimateFlow(weightGrams, coverage, mergedOptions.padDryWeightGrams);
      
      const riskLevel = this._assessRisk(classifiedClots, flow);
      
      const findings = this._generateFindings(classifiedClots, flow, coverage);
      
      preprocessed.dispose();
      segmentationResult.dispose();
      
      return {
        timestamp: new Date().toISOString(),
        findings: {
          bloodDetected: coverage > 0.02,
          coverage,
          clots: classifiedClots.filter(c => c.isClot).map(c => ({
            estimatedCm2: c.estimatedCm2,
            pixels: c.pixels,
            type: c.clotType,
            confidence: c.confidence,
            bbox: c.bbox
          })),
          darkRegions: classifiedClots.filter(c => !c.isClot && c.clotType === 'concentrated_blood').map(d => ({
            estimatedCm2: d.estimatedCm2,
            pixels: d.pixels,
            confidence: d.confidence,
            bbox: d.bbox
          })),
          clotCount: classifiedClots.filter(c => c.isClot).length,
          darkRegionCount: classifiedClots.filter(c => !c.isClot && c.clotType === 'concentrated_blood').length,
          flow,
          estimatedBloodLossMl: flow.estimatedMl
        },
        recommendations: this._buildRecommendations(riskLevel, flow, classifiedClots),
        riskLevel,
        modelVersion: '1.0.0-ai',
        raw: {
          totalRegionsAnalyzed: regions.length,
          allFindings: findings
        }
      };
    } catch (error) {
      console.error('Analysis failed:', error);
      throw new Error('Pad analysis failed: ' + error.message);
    }
  }

  async _preprocessImage(img, opts) {
    return tf.tidy(() => {
      let tensor = tf.browser.fromPixels(img);
      
      tensor = tf.image.resizeBilinear(tensor, [224, 224]);
      
      tensor = tensor.div(255.0);
      
      tensor = this._normalizeColors(tensor);
      
      tensor = tensor.expandDims(0);
      
      return tensor;
    });
  }

  _normalizeColors(tensor) {
    return tf.tidy(() => {
      // Simple white balance: scale each channel independently
      const mean = tensor.mean([0, 1], true);
      const std = tf.moments(tensor, [0, 1]).variance.sqrt();
      
      // Normalize to mean=0.5, std=0.2
      return tensor.sub(mean).div(std.add(1e-7)).mul(0.2).add(0.5).clipByValue(0, 1);
    });
  }

  async _runSegmentation(preprocessedTensor) {
    return tf.tidy(() => {
      // Run segmentation model
      const prediction = this.segmentationModel.predict(preprocessedTensor);
      
      // Get class with highest probability for each pixel
      // Output shape: [1, 224, 224, 3] -> [224, 224]
      const classMask = prediction.argMax(-1).squeeze();
      
      return classMask;
    });
  }

  async _extractRegions(originalImg, segmentationMask, opts) {
    const maskData = await segmentationMask.data();
    const maskArray = Array.from(maskData);
    
    const canvas = document.createElement('canvas');
    canvas.width = 224;
    canvas.height = 224;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(originalImg, 0, 0, 224, 224);
    const imgData = ctx.getImageData(0, 0, 224, 224);
    
    const regions = this._findConnectedComponents(maskArray, imgData, 224, 224, opts);
    
    return regions;
  }

  _findConnectedComponents(mask, imgData, width, height, opts) {
    const visited = new Uint8Array(width * height);
    const regions = [];
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const maskValue = mask[idx];
        
        if ((maskValue === 1 || maskValue === 2) && !visited[idx]) {
          const region = this._floodFill(x, y, width, height, mask, visited, imgData);
          
          if (region.pixels >= opts.minClotPixels && region.pixels <= opts.maxClotPixels) {
            regions.push(region);
          }
        }
      }
    }
    
    return regions;
  }

  _floodFill(startX, startY, width, height, mask, visited, imgData) {
    const stack = [[startX, startY]];
    const region = {
      pixels: 0,
      bbox: { minX: startX, minY: startY, maxX: startX, maxY: startY },
      pixelCoords: [],
      imageData: null
    };
    
    while (stack.length > 0) {
      const [x, y] = stack.pop();
      const idx = y * width + x;
      
      if (x < 0 || x >= width || y < 0 || y >= height || visited[idx]) {
        continue;
      }
      
      const maskValue = mask[idx];
      if (maskValue !== 1 && maskValue !== 2) continue;
      
      visited[idx] = 1;
      region.pixels++;
      region.pixelCoords.push([x, y]);
      
      region.bbox.minX = Math.min(region.bbox.minX, x);
      region.bbox.minY = Math.min(region.bbox.minY, y);
      region.bbox.maxX = Math.max(region.bbox.maxX, x);
      region.bbox.maxY = Math.max(region.bbox.maxY, y);
      
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    
    region.imageData = this._extractRegionImage(region.bbox, imgData, width, height);
    
    return region;
  }

  _extractRegionImage(bbox, imgData, width, height) {
    const regionWidth = bbox.maxX - bbox.minX + 1;
    const regionHeight = bbox.maxY - bbox.minY + 1;
    
    const canvas = document.createElement('canvas');
    canvas.width = regionWidth;
    canvas.height = regionHeight;
    const ctx = canvas.getContext('2d');
    
    const regionData = ctx.createImageData(regionWidth, regionHeight);
    
    for (let y = 0; y < regionHeight; y++) {
      for (let x = 0; x < regionWidth; x++) {
        const srcIdx = ((bbox.minY + y) * width + (bbox.minX + x)) * 4;
        const dstIdx = (y * regionWidth + x) * 4;
        
        regionData.data[dstIdx] = imgData.data[srcIdx];
        regionData.data[dstIdx + 1] = imgData.data[srcIdx + 1];
        regionData.data[dstIdx + 2] = imgData.data[srcIdx + 2];
        regionData.data[dstIdx + 3] = imgData.data[srcIdx + 3];
      }
    }
    
    ctx.putImageData(regionData, 0, 0);
    return canvas;
  }

  async _classifyRegions(regions, opts) {
    const results = [];
    
    for (const region of regions) {
      try {
        // Resize region to 64x64 for classifier
        const regionTensor = tf.tidy(() => {
          let tensor = tf.browser.fromPixels(region.imageData);
          tensor = tf.image.resizeBilinear(tensor, [64, 64]);
          tensor = tensor.div(255.0);
          tensor = tensor.expandDims(0);
          return tensor;
        });
        
        const prediction = await this.clotClassifier.predict(regionTensor);
        const probabilities = await prediction.data();
        regionTensor.dispose();
        prediction.dispose();
        
        // Classes: [not_clot, small_clot, large_clot, old_blood]
        const maxIdx = probabilities.indexOf(Math.max(...probabilities));
        const confidence = Math.round(probabilities[maxIdx] * 100);
        
        const clotTypes = ['not_clot', 'small_clot', 'large_clot', 'concentrated_blood'];
        const clotType = clotTypes[maxIdx];
        const isClot = maxIdx === 1 || maxIdx === 2;
        
        if (confidence >= opts.modelConfidenceThreshold * 100) {
          const areaCm2 = this._pixelsToCm2(region.pixels, opts.scalePxPerCm);
          
          results.push({
            pixels: region.pixels,
            bbox: region.bbox,
            isClot,
            clotType,
            confidence,
            estimatedCm2: areaCm2,
            aiPrediction: {
              probabilities: {
                notClot: Math.round(probabilities[0] * 100),
                smallClot: Math.round(probabilities[1] * 100),
                largeClot: Math.round(probabilities[2] * 100),
                concentratedBlood: Math.round(probabilities[3] * 100)
              }
            }
          });
        }
      } catch (error) {
        console.warn('Failed to classify region:', error);
      }
    }
    
    return results.sort((a, b) => b.confidence - a.confidence);
  }

  _calculateCoverage(segmentationMask) {
    return tf.tidy(() => {
      // Count pixels: 0=background, 1=blood, 2=clot
      const total = segmentationMask.size;
      const bloodAndClot = segmentationMask.greater(0).sum().dataSync()[0];
      
      return bloodAndClot / total;
    });
  }

  _assessRisk(clots, flow) {
    const estimatedMl = flow.estimatedMl;
    const hasLargeClots = clots.some(c => c.isClot && c.clotType === 'large_clot');
    const hasMultipleClots = clots.filter(c => c.isClot).length >= 2;
    
    if (estimatedMl >= 250) {
      return 'high';
    } else if (hasLargeClots || (hasMultipleClots && estimatedMl > 80)) {
      return 'moderate';
    } else if (estimatedMl < 200 && !hasLargeClots) {
      return 'low';
    } else {
      return 'moderate';
    }
  }

  _generateFindings(clots, flow, coverage) {
    const findings = [];
    
    findings.push(`${flow.description} (Estimated blood loss: ${flow.estimatedMl} ml)`);
    findings.push(`Visual Coverage: ${Math.round(coverage * 100)}% of pad area shows blood.`);
    
    const actualClots = clots.filter(c => c.isClot);
    if (actualClots.length > 0) {
      findings.push(`${actualClots.length} blood clot(s) detected by AI model.`);
    }
    
    const darkRegions = clots.filter(c => !c.isClot && c.clotType === 'concentrated_blood');
    if (darkRegions.length > 0) {
      findings.push(`${darkRegions.length} concentrated blood region(s) detected.`);
    }
    
    const largeClots = actualClots.filter(c => c.estimatedCm2 && c.estimatedCm2 >= 1.5);
    if (largeClots.length > 0) {
      findings.push(`${largeClots.length} large blood clot(s) (>= 1.5cm²) detected - clinical assessment recommended.`);
    }
    
    if (flow.level === 'critical') {
      findings.push('⚠️ CRITICAL: Flow volume exceeds 250mL - immediate medical attention needed.');
    } else if (flow.level === 'heavy') {
      findings.push('Heavy flow detected (15-249mL) - close monitoring recommended.');
    }
    
    return findings.filter(Boolean);
  }

  _estimateFlow(weightGrams, visualCoverage, padDryWeightGrams = 5) {
    const estimatedMl = Math.max(0, (weightGrams - padDryWeightGrams));
    const level = estimatedMl < 5 ? 'light' : 
                  (estimatedMl < 15 ? 'moderate' : 
                  (estimatedMl < 250 ? 'heavy' : 'critical'));
    const description = level === 'light' ? 'Light Flow' : 
                        level === 'moderate' ? 'Moderate Flow' : 
                        level === 'heavy' ? 'Heavy Flow' : 'Critically High Flow';
    
    return {
      level,
      description,
      estimatedMl: Math.round(estimatedMl * 10) / 10,
      visualCoveragePercent: Math.round(visualCoverage * 100)
    };
  }

  _buildRecommendations(riskLevel, flow, clots) {
    const rec = [];
    const actualClots = clots.filter(c => c.isClot);
    const largeClots = actualClots.filter(c => c.estimatedCm2 && c.estimatedCm2 >= 1.5);
    
    if (riskLevel === 'high' || flow.level === 'critical') {
      rec.push('🚨 **IMMEDIATE CLINICAL ASSESSMENT RECOMMENDED.** Estimated blood loss is 250mL or higher.');
      rec.push('High volume blood loss detected by AI analysis. Monitor vitals and seek medical attention.');
    } else if (riskLevel === 'moderate') {
      rec.push('⚠️ Monitor closely and re-check in 30-60 minutes. AI detected concerning patterns.');
      if (actualClots.length > 0) {
        rec.push(`AI detected ${actualClots.length} blood clot(s). Document and consider clinical assessment.`);
      }
    } else {
      rec.push('✓ Routine monitoring recommended. AI analysis shows normal flow patterns with no significant clots.');
    }
    
    if (largeClots.length > 0) {
      rec.push(`⚠️ ${largeClots.length} large blood clot(s) (>= 1.5cm²) detected by AI. Clinical documentation recommended.`);
    }
    
    if (flow.level === 'heavy') {
      rec.push('Heavy flow detected: Ensure adequate hydration and iron intake. Monitor for signs of anemia.');
    }
    
    const avgConfidence = actualClots.reduce((sum, c) => sum + c.confidence, 0) / actualClots.length;
    if (actualClots.length > 0 && avgConfidence < 75) {
      rec.push('ℹ️ Note: AI confidence is moderate. Consider repeat scan or clinical confirmation.');
    }
    
    return rec;
  }

  _pixelsToCm2(pixels, scalePxPerCm) {
    if (!scalePxPerCm || scalePxPerCm <= 0) return null;
    const scaleFactor = 224 / 800; 
    const adjustedScale = scalePxPerCm * scaleFactor;
    const cm2 = pixels / (adjustedScale * adjustedScale);
    return Math.round(cm2 * 10) / 10;
  }

  _loadImage(imageSource) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error('Image failed to load: ' + e));
      if (typeof imageSource === 'string') {
        img.src = imageSource;
      } else if (imageSource instanceof File) {
        const reader = new FileReader();
        reader.onload = e => img.src = e.target.result;
        reader.onerror = e => reject(e);
        reader.readAsDataURL(imageSource);
      } else {
        reject(new Error('Unsupported imageSource type'));
      }
    });
  }
}

export const padAnalyzer = new PadAnalyzer();

export default PadAnalyzer;