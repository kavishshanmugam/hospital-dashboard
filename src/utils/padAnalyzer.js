// src/utils/padAnalyzer.js
// Production PadAnalyzer - no Teachable Machine, saturation-based clot detection
class PadAnalyzer {
  constructor(options = {}) {
    this.options = {
      blurRadius: options.blurRadius ?? 1,
      minClotPixels: options.minClotPixels ?? 40,
      maxClotPixels: options.maxClotPixels ?? 1000,
      hueTolerance: options.hueTolerance ?? 20,
      saturationMin: options.saturationMin ?? 0.25,
      valueMaxForClot: options.valueMaxForClot ?? 0.25,
      valueMaxForDarkRegion: options.valueMaxForDarkRegion ?? 0.55,
      valueMinForBlood: options.valueMinForBlood ?? 0.15,
      clotSaturationMax: options.clotSaturationMax ?? 0.30, // Black has low saturation
      darkRegionSaturationMin: options.darkRegionSaturationMin ?? 0.30, // Dark red has high saturation
      scalePxPerCm: options.scalePxPerCm ?? null,
      padDryWeightGrams: options.padDryWeightGrams ?? 5,
      ...options
    };
    this.initialized = true;
  }

  async initialize() {
    console.log('PadAnalyzer: initialized (no external model required).');
    return true;
  }

  calibrateScale(padWidthCm, imagePadWidthPx) {
    if (!padWidthCm || !imagePadWidthPx) return;
    this.options.scalePxPerCm = imagePadWidthPx / padWidthCm;
    console.log('PadAnalyzer: calibrated scale px/cm =', this.options.scalePxPerCm);
  }

  dispose() {
    this.initialized = false;
  }

  async analyzePadImage(imageSource, weightGrams = 0, opts = {}) {
    if (!this.initialized) {
      throw new Error('Analyzer not initialized. Call initialize() first.');
    }
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

      // CLOTS: Only black regions (low Value AND low Saturation)
      if (meanValue <= mergedOptions.valueMaxForClot && meanSaturation <= mergedOptions.clotSaturationMax) {
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
      // DARK REGIONS: Darker red areas (high saturation = colored)
      else if (meanValue > mergedOptions.valueMaxForClot && 
               meanValue <= mergedOptions.valueMaxForDarkRegion && 
               meanSaturation > mergedOptions.darkRegionSaturationMin &&
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

    clots.sort((a, b) => a.meanValue - b.meanValue);
    darkRegions.sort((a, b) => a.meanValue - b.meanValue);
    
    const topClots = clots.slice(0, 3);
    const topDarkRegions = darkRegions.slice(0, 3);

    const coverage = this._estimateCoverage(imgData, mask);
    const flow = this._estimateFlow(weightGrams, coverage, mergedOptions.padDryWeightGrams);

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
      
      // Include red/blood regions OR black regions (low saturation = grayscale)
      const isBlack = val <= 0.25 && sat <= 0.30;
      
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

export const padAnalyzer = new PadAnalyzer();