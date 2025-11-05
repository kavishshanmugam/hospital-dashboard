import React, { useState, useRef, useEffect } from 'react';
import { Upload, AlertCircle, CheckCircle, Brain, Activity, Droplet, Info, X } from 'lucide-react';

class PadAnalyzer {
  constructor(options = {}) {
    this.options = {
      blurRadius: options.blurRadius ?? 1,
      minClotPixels: options.minClotPixels ?? 40,
      maxClotPixels: options.maxClotPixels ?? 1000,
      hueTolerance: options.hueTolerance ?? 20,
      saturationMin: options.saturationMin ?? 0.25,
      valueMaxForClot: options.valueMaxForClot ?? 0.20, // Black regions for clots (increased slightly)
      valueMaxForDarkRegion: options.valueMaxForDarkRegion ?? 0.55, // Darker red regions
      valueMinForBlood: options.valueMinForBlood ?? 0.15,
      scalePxPerCm: options.scalePxPerCm ?? null,
      padDryWeightGrams: options.padDryWeightGrams ?? 5,
      ...options
    };
    this.initialized = true; 
  }

  async initialize() {
    console.log('PadAnalyzer: initialized (no model required).');
    return true;
  }

  calibrateScale(padWidthCm, imagePadWidthPx) {
    if (!padWidthCm || !imagePadWidthPx) return;
    this.options.scalePxPerCm = imagePadWidthPx / padWidthCm;
    console.log('PadAnalyzer: calibrated scale px/cm =', this.options.scalePxPerCm);
  }

  async analyzePadImage(imageSource, weightGrams = 0, opts = {}) {
    const mergedOptions = { ...this.options, ...opts };

    const img = await this._loadImage(imageSource);
    const maxDim = 800;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const canvasW = Math.round(img.width * scale);
    const canvasH = Math.round(img.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvasW, canvasH);

    if (mergedOptions.blurRadius > 0) {
      this._boxBlurCanvas(canvas, mergedOptions.blurRadius);
    }

    const imgData = ctx.getImageData(0, 0, canvasW, canvasH);
    const mask = this._buildBloodMask(imgData, mergedOptions);
    const components = this._connectedComponents(mask, imgData);

    // Separate clots (very dark/black) from dark regions (darker reds)
    const clots = [];
    const darkRegions = [];
    const avgBloodValue = this._estimateAvgBloodValue(imgData, mask) || 0.5;

    components.forEach((comp) => {
      if (comp.pixels < mergedOptions.minClotPixels) return;
      if (comp.pixels > mergedOptions.maxClotPixels) return;

      const meanValue = comp.sumValue / comp.pixels;
      const meanSaturation = comp.sumSaturation / comp.pixels; 
      const darkerThanBlood = (avgBloodValue - meanValue);

      const areaCm2 = this._pixelsToCm2(comp.pixels, mergedOptions.scalePxPerCm);

      // CLOTS: Only black regions (low Value AND low Saturation - not red)
      // Black has low saturation (grayscale), dark red has high saturation
      if (meanValue <= mergedOptions.valueMaxForClot && meanSaturation <= 0.30) {
        clots.push({
          pixels: comp.pixels,
          bbox: comp.bbox,
          meanValue: Math.round(meanValue * 100) / 100,
          meanSaturation: Math.round(meanSaturation * 100) / 100,
          darkerThanBlood: Math.round(darkerThanBlood * 100) / 100,
          estimatedCm2: areaCm2,
          confidence: Math.min(98, Math.round(50 + darkerThanBlood * 300)),
        });
      }
      // DARK REGIONS: Darker red areas (high saturation = colored, not grayscale)
      else if (meanValue > mergedOptions.valueMaxForClot && 
               meanValue <= mergedOptions.valueMaxForDarkRegion && 
               meanSaturation > 0.30 &&
               darkerThanBlood > 0.06) {
        darkRegions.push({
          pixels: comp.pixels,
          bbox: comp.bbox,
          meanValue: Math.round(meanValue * 100) / 100,
          meanSaturation: Math.round(meanSaturation * 100) / 100,
          darkerThanBlood: Math.round(darkerThanBlood * 100) / 100,
          estimatedCm2: areaCm2,
          confidence: Math.min(90, Math.round(40 + darkerThanBlood * 250)),
        });
      }
    });

    // Sort and limit
    clots.sort((a, b) => a.meanValue - b.meanValue);
    darkRegions.sort((a, b) => a.meanValue - b.meanValue);
    
    const topClots = clots.slice(0, 3);
    const topDarkRegions = darkRegions.slice(0, 3);

    const coverage = this._estimateCoverage(imgData, mask);
    const flow = this._estimateFlow(weightGrams, coverage, mergedOptions.padDryWeightGrams);

    // Risk scoring
    let riskLevel;
    const estimatedMl = flow.estimatedMl;
    const clotFound = topClots.length > 0;

    if (estimatedMl >= 250) {
      riskLevel = 'high';
    } else if (clotFound) {
      riskLevel = 'moderate';
    } else if (estimatedMl < 200 && !clotFound) {
      riskLevel = 'low';
    } else {
      riskLevel = 'moderate';
    }

    const findings = [
      `${flow.description} (Estimated blood loss: ${flow.estimatedMl} ml)`,
      `Visual Coverage: ${Math.round(coverage * 100)}% of non-background area is blood-colored.`,
      topClots.length ? `${topClots.length} blood clot(s) detected (black regions).` : '',
      topDarkRegions.length ? `${topDarkRegions.length} dark region(s) detected (concentrated darker red areas).` : '',
      ...(topClots.some(c => c.estimatedCm2 && c.estimatedCm2 >= 1.5) 
        ? ['One or more large blood clots (>= 1.5cm²) detected.'] 
        : []
      ),
      ...(flow.level === 'critical' 
        ? ['Flow volume is critically high (>250mL).'] 
        : (flow.level === 'heavy') 
        ? ['Heavy flow detected (15mL to 249.9mL).']
        : []
      )
    ].filter(Boolean);

    return {
      timestamp: new Date().toISOString(),
      findings: {
        bloodDetected: coverage > 0.02,
        coverage,
        clots: topClots.map(c => ({
          estimatedCm2: c.estimatedCm2,
          pixels: c.pixels,
          meanValue: c.meanValue,
          meanSaturation: c.meanSaturation,
          darkerThanBlood: c.darkerThanBlood,
          confidence: c.confidence,
        })),
        darkRegions: topDarkRegions.map(d => ({
          estimatedCm2: d.estimatedCm2,
          pixels: d.pixels,
          meanValue: d.meanValue,
          meanSaturation: d.meanSaturation,
          darkerThanBlood: d.darkerThanBlood,
          confidence: d.confidence,
        })),
        clotCount: topClots.length,
        darkRegionCount: topDarkRegions.length,
        flow,
        estimatedBloodLossMl: flow.estimatedMl
      },
      recommendations: this._buildRecommendations(riskLevel, flow, topClots),
      riskLevel,
      raw: {
        componentsFound: components.length,
        avgBloodValue,
        allFindings: findings
      }
    };
  }

  _loadImage(imageSource) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error('Image failed to load: ' + e));
      if (typeof imageSource === 'string') img.src = imageSource;
      else if (imageSource instanceof File) {
        const reader = new FileReader();
        reader.onload = e => img.src = e.target.result;
        reader.onerror = e => reject(e);
        reader.readAsDataURL(imageSource);
      } else {
        reject(new Error('Unsupported imageSource type'));
      }
    });
  }

  _pixelsToCm2(pixels, scalePxPerCm) {
    if (!scalePxPerCm || scalePxPerCm <= 0) return null;
    const cm2 = pixels / (scalePxPerCm * scalePxPerCm);
    return Math.round(cm2 * 10) / 10;
  }

  _buildBloodMask(imgData, opts) {
    const w = imgData.width, h = imgData.height;
    const data = imgData.data;
    const mask = new Uint8Array(w * h);

    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      const { h: hue, s: sat, v: val } = this._rgbToHsv(r, g, b);

      const hueDeg = hue * 360;
      const isRedHue = (hueDeg <= opts.hueTolerance) || (hueDeg >= 360 - opts.hueTolerance);
      const satOk = sat >= opts.saturationMin;
      const valOk = val >= opts.valueMinForBlood;
      
      // Include red/blood regions OR very dark/black regions (low saturation = grayscale/black)
      const isBlack = val <= 0.25 && sat <= 0.30; // Black: very dark AND low saturation (not red)
      
      if ((isRedHue && satOk && valOk) || isBlack) {
        mask[p] = 1;
      } else {
        mask[p] = 0;
      }
    }
    return { mask, width: w, height: h };
  }

  _estimateCoverage(imgData, maskObj) {
    const w = maskObj.width, h = maskObj.height;
    const data = imgData.data;
    const mask = maskObj.mask;
    let nonBg = 0, blood = 0;
    for (let p = 0, i = 0; p < w * h; p++, i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r > 230 && g > 230 && b > 230) continue;
      nonBg++;
      if (mask[p]) blood++;
    }
    return nonBg > 0 ? (blood / nonBg) : 0;
  }

  _estimateAvgBloodValue(imgData, maskObj) {
    const w = maskObj.width, h = maskObj.height;
    const data = imgData.data;
    const mask = maskObj.mask;
    let sum = 0, count = 0;
    for (let p = 0, i = 0; p < w * h; p++, i += 4) {
      if (!mask[p]) continue;
      const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
      const { v } = this._rgbToHsv(r, g, b);
      sum += v;
      count++;
    }
    return count ? (sum / count) : null;
  }

  _rgbToHsv(r, g, b) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0, s = (max === 0 ? 0 : d / max), v = max;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = ((b - r) / d) + 2;
      else h = ((r - g) / d) + 4;
      h = (h * 60) / 360;
      if (h < 0) h += 1;
    }
    return { h, s, v };
  }

  _boxBlurCanvas(canvas, radius = 1) {
    if (!radius) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const src = ctx.getImageData(0, 0, w, h);
    const dst = ctx.createImageData(w, h);
    const data = src.data, out = dst.data;
    const kernelSize = (2 * radius + 1) ** 2;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let ky = -radius; ky <= radius; ky++) {
          const py = Math.min(h - 1, Math.max(0, y + ky));
          for (let kx = -radius; kx <= radius; kx++) {
            const px = Math.min(w - 1, Math.max(0, x + kx));
            const i = (py * w + px) * 4;
            r += data[i]; g += data[i + 1]; b += data[i + 2]; a += data[i + 3];
          }
        }
        const o = (y * w + x) * 4;
        out[o] = Math.round(r / kernelSize);
        out[o + 1] = Math.round(g / kernelSize);
        out[o + 2] = Math.round(b / kernelSize);
        out[o + 3] = Math.round(a / kernelSize);
      }
    }
    ctx.putImageData(dst, 0, 0);
  }

  _connectedComponents(maskObj, imgData) {
    const w = maskObj.width, h = maskObj.height;
    const mask = maskObj.mask;
    const data = imgData.data;
    const visited = new Uint8Array(w * h);
    const comps = [];

    for (let p = 0; p < w * h; p++) {
      if (!mask[p] || visited[p]) continue;
      const stack = [p];
      visited[p] = 1;
      let pixels = 0;
      let minX = w, minY = h, maxX = 0, maxY = 0;
      let sumValue = 0;
      let sumSaturation = 0;

      while (stack.length) {
        const cur = stack.pop();
        const y = Math.floor(cur / w), x = cur % w;
        
        pixels++;
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);

        const i = (y * w + x) * 4;
        const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
        const { s, v } = this._rgbToHsv(r, g, b);
        sumValue += v;
        sumSaturation += s;

        const neighbors = [cur + 1, cur - 1, cur + w, cur - w];
        for (const n of neighbors) {
          if (n >= 0 && n < w * h && !visited[n] && mask[n]) {
            visited[n] = 1;
            stack.push(n);
          }
        }
      }

      comps.push({ pixels, bbox: { minX, minY, maxX, maxY }, sumValue, sumSaturation });
    }
    return comps;
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
    
    if (riskLevel === 'high' || flow.level === 'critical') {
      rec.push('🚨 **IMMEDIATE CLINICAL ASSESSMENT RECOMMENDED.** Estimated blood loss is 250mL or higher.');
      rec.push('High volume of loss and/or critical flow detected. Monitor vitals closely.');
    } else if (riskLevel === 'moderate') {
      rec.push('Monitor closely; re-check in 30-60 minutes. Presence of blood clots indicates a potential concern.');
    } else {
      rec.push('Routine monitoring recommended. Flow volume is low and no blood clots were detected.');
    }

    if (clots.some(c => c.estimatedCm2 && c.estimatedCm2 >= 1.5)) {
      rec.push('Document large blood clots (>= 1.5cm²) and consider clinical assessment.');
    }
    
    if (flow.level === 'heavy') {
      rec.push('Heavy flow detected: ensure adequate hydration and monitor for signs of excessive blood loss.');
    }
    return rec;
  }
}

const padAnalyzer = new PadAnalyzer();

const AITestPage = () => {
  const [image, setImage] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [modelReady, setModelReady] = useState(false);
  const [weightGrams, setWeightGrams] = useState(0);

  const fileInputRef = useRef(null);
  const imageRef = useRef(null);

  useEffect(() => {
    const initAnalyzer = async () => {
      try {
        await padAnalyzer.initialize();
        setModelReady(true);
        console.log('✅ PadAnalyzer initialized');
      } catch (err) {
        console.error('❌ PadAnalyzer initialization failed:', err);
        setError(err.message);
      }
    };
    initAnalyzer();
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target.result);
        setResults(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleRemoveImage = () => {
    setImage(null);
    setResults(null);
    setError(null);
    setWeightGrams(0);
    if(fileInputRef.current) fileInputRef.current.value = '';
  };

  const analyzeImage = async () => {
    if (!image || !imageRef.current || !modelReady) return;
    
    setAnalyzing(true);
    setError(null);
    setResults(null);
    
    try {
      const analysisResults = await padAnalyzer.analyzePadImage(image, weightGrams);
      console.log('✅ Analysis complete:', analysisResults);
      setResults(analysisResults);
    } catch (err) {
      console.error('❌ Analysis failed:', err);
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'high': return 'border-red-500 bg-red-50';
      case 'moderate': return 'border-yellow-500 bg-yellow-50';
      case 'low': return 'border-green-500 bg-green-50';
      default: return 'border-gray-500 bg-gray-50';
    }
  };

  const getRiskBadge = (level) => {
    switch (level) {
      case 'high': return 'text-red-800 bg-red-100';
      case 'moderate': return 'text-yellow-800 bg-yellow-100';
      case 'low': return 'text-green-800 bg-green-100';
      default: return 'text-gray-800 bg-gray-100';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Brain className="w-12 h-12 text-purple-600" />
            <div>
              <h1 className="text-4xl font-bold text-gray-800">AI Pad Analyzer Test</h1>
              <p className="text-gray-600 mt-1">Upload images to test the AI analysis system</p>
            </div>
          </div>
          
          <div className={`mt-4 p-4 rounded-lg border-2 ${modelReady ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
            <div className="flex items-center gap-3">
              {modelReady ? (
                <>
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-800">Analyzer Ready ✓</p>
                    <p className="text-sm text-green-700">Blood clot detection: black regions | Dark region detection: darker reds</p>
                  </div>
                </>
              ) : (
                <>
                  <Activity className="w-6 h-6 text-yellow-600 animate-pulse" />
                  <div>
                    <p className="font-semibold text-yellow-800">Initializing...</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
              <Upload className="w-6 h-6 mr-2 text-blue-600" />
              Upload Image
            </h2>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            {!image ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!modelReady}
                className="w-full py-16 border-2 border-dashed border-gray-300 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600 font-medium text-lg">Click to upload pad image</p>
                <p className="text-sm text-gray-400 mt-2">PNG, JPG up to 10MB</p>
              </button>
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-xl overflow-hidden border-2 border-gray-200">
                  <img
                    ref={imageRef}
                    src={image}
                    alt="Test"
                    className="w-full h-auto block"
                    crossOrigin="anonymous"
                  />
                </div>
                
                <div className="flex gap-3 items-center">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Weight (grams)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={weightGrams}
                      onChange={(e) => setWeightGrams(Number(e.target.value))}
                      placeholder="Enter total weight in grams"
                      className="border rounded px-3 py-2 w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">Dry pad weight assumed {padAnalyzer.options.padDryWeightGrams}g</p>
                  </div>
                  
                  <button
                    onClick={handleRemoveImage}
                    className="py-2 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium"
                  >
                    <X className='w-5 h-5'/>
                  </button>
                  
                  <button
                    onClick={analyzeImage}
                    disabled={analyzing || !modelReady}
                    className="py-2 px-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {analyzing ? (
                      <>
                        <Activity className="w-5 h-5 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Brain className="w-5 h-5" />
                        Analyze
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-red-800">{error}</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
              <Activity className="w-6 h-6 mr-2 text-green-600" />
              Analysis Results
            </h2>
            
            {!results ? (
              <div className="flex items-center justify-center h-96 bg-gray-50 rounded-xl">
                <div className="text-center">
                  <Brain className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">No analysis yet</p>
                  <p className="text-sm text-gray-400 mt-2">Upload and analyze an image to see results</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                <div className={`border-l-4 ${getRiskColor(results.riskLevel)} p-4 rounded-r-lg`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-lg">Overall Assessment</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getRiskBadge(results.riskLevel)}`}>
                      {results.riskLevel} RISK
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Flow: {results.findings.flow.description} | Estimated Loss: {results.findings.estimatedBloodLossMl} mL
                  </p>
                  <p className="text-sm text-gray-600 mt-1">Weight: {weightGrams}g (Dry Weight: {padAnalyzer.options.padDryWeightGrams}g)</p>
                </div>

                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center">
                    <Droplet className="w-5 h-5 mr-2 text-blue-600" />
                    Visual Findings
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm pt-1 border-t">
                      <span className="text-gray-600">Visual Coverage</span>
                      <span className="font-bold">{Math.round(results.findings.coverage * 100)}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Average Blood Brightness</span>
                      <span className="font-bold">{Math.round(results.raw.avgBloodValue * 100)} / 100</span>
                    </div>
                  </div>
                </div>

                {results.findings.clotCount > 0 && (
                  <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                    <h3 className="font-bold text-gray-800 mb-3">
                      🩸 Blood Clots Detected: {results.findings.clotCount}
                    </h3>
                    <p className="text-xs text-gray-600 mb-3">Black regions indicating potential blood clots</p>
                    <div className="space-y-2">
                      {results.findings.clots.map((clot, idx) => (
                        <div key={idx} className="bg-white p-3 rounded flex justify-between items-center text-sm">
                          <div>
                            <span className="font-medium text-red-700">Blood Clot {idx + 1}</span>
                            {clot.estimatedCm2 !== null && (
                              <span className="text-gray-500 text-xs ml-2">~{clot.estimatedCm2}cm²</span>
                            )}
                            <span className="text-red-600 text-xs ml-2">(V: {clot.meanValue}, S: {clot.meanSaturation})</span>
                          </div>
                          <span className="text-xs text-gray-500">{clot.confidence}% conf</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {results.findings.darkRegionCount > 0 && (
                  <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
                    <h3 className="font-bold text-gray-800 mb-3">
                      Dark Regions Detected: {results.findings.darkRegionCount}
                    </h3>
                    <p className="text-xs text-gray-600 mb-3">Concentrated darker red areas (not as dark as clots)</p>
                    <div className="space-y-2">
                      {results.findings.darkRegions.map((region, idx) => (
                        <div key={idx} className="bg-white p-3 rounded flex justify-between items-center text-sm">
                          <div>
                            <span className="font-medium">Dark Region {idx + 1}</span>
                            {region.estimatedCm2 !== null && (
                              <span className="text-gray-500 text-xs ml-2">~{region.estimatedCm2}cm²</span>
                            )}
                            <span className="text-orange-600 text-xs ml-2">(V: {region.meanValue}, S: {region.meanSaturation})</span>
                          </div>
                          <span className="text-xs text-gray-500">{region.confidence}% conf</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {results.findings.clotCount === 0 && results.findings.darkRegionCount === 0 && (
                  <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <h3 className="font-bold text-green-800">No Clots or Dark Regions Detected</h3>
                    </div>
                    <p className="text-sm text-green-700 mt-2">No blood clots (black regions) or significantly dark red regions were found.</p>
                  </div>
                )}
                
                <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                  <h3 className="font-bold text-gray-800 mb-3">Recommendations</h3>
                  <ul className="space-y-2">
                    {results.recommendations.map((item, idx) => (
                      <li key={idx} className={`text-sm flex items-start ${item.includes('IMMEDIATE') ? 'text-red-700 font-semibold' : 'text-gray-700'}`}>
                        <span className="text-blue-500 mr-2 font-bold">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <details className="bg-gray-100 border border-gray-300 p-4 rounded-lg">
                  <summary className="cursor-pointer font-semibold text-gray-700 hover:text-gray-900">
                    View Raw JSON Output
                  </summary>
                  <pre className="mt-3 text-xs overflow-x-auto bg-gray-900 text-green-400 p-3 rounded">
                    {JSON.stringify(results, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="font-bold text-blue-900 mb-3 flex items-center">
            <Info className="w-5 h-5 mr-2" />
            Detection Criteria
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-blue-800">
            <div>
              <p className="font-semibold mb-1">Blood Clots</p>
              <p className="text-xs">Black/grayscale regions only (V &lt; 0.25, S &lt; 0.30). Dark red is NOT a clot.</p>
            </div>
            <div>
              <p className="font-semibold mb-1">Dark Regions</p>
              <p className="text-xs">Darker red/colored areas (V: 0.25-0.55, S &gt; 0.30). Has color saturation.</p>
            </div>
            <div>
              <p className="font-semibold mb-1">Flow Estimation</p>
              <p className="text-xs">Based on pad weight: Light &lt;5mL, Moderate &lt;15mL, Heavy &lt;250mL, Critical ≥250mL.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AITestPage;