"use client" // Keep for client-only
import { createWorker } from 'tesseract.js';
import type { MUTCDSign } from '@/lib/types/mutcd'; // Updated to point to the shared types file

// Load Tesseract worker (lazy)
const loadTesseract = async () => {
  const worker = await createWorker('eng', 1, {
    logger: m => console.log(m), // Optional: Log progress
  });
  await worker.setParameters({
    tessedit_pageseg_mode: 4, // Changed '4' (string) to 4 (number)
  });
  return worker;
};

// Detect signs via OCR in cropped area
export const detectSigns = async (
  canvas: HTMLCanvasElement,
  cropArea: { x: number; y: number; width: number; height: number },
): Promise<MUTCDSign[]> => {
  // Get crop data
  const ctx = canvas.getContext('2d')!;
  const cropImageData = ctx.getImageData(cropArea.x, cropArea.y, cropArea.width, cropArea.height);

  // Preprocess: Grayscale + sharpen + threshold (port from Python, using Canvas)
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = cropArea.width;
  tempCanvas.height = cropArea.height;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.putImageData(cropImageData, 0, 0);

  // Grayscale
  const grayData = tempCtx.getImageData(0, 0, cropArea.width, cropArea.height);
  for (let i = 0; i < grayData.data.length; i += 4) {
    const avg = (grayData.data[i] + grayData.data[i + 1] + grayData.data[i + 2]) / 3;
    grayData.data[i] = grayData.data[i + 1] = grayData.data[i + 2] = avg;
    grayData.data[i + 3] = 255;
  }
  tempCtx.putImageData(grayData, 0, 0);

  // Sharpen (simple unsharp mask approx)
  const blurredData = tempCtx.getImageData(0, 0, cropArea.width, cropArea.height);
  // Gaussian blur approx (basic 3x3)
  for (let y = 1; y < cropArea.height - 1; y++) {
    for (let x = 1; x < cropArea.width - 1; x++) {
      const idx = (y * cropArea.width + x) * 4;
      const sum =
        blurredData.data[idx - 4] + blurredData.data[idx] + blurredData.data[idx + 4] +
        blurredData.data[idx - (cropArea.width * 4)] + 9 * blurredData.data[idx] + blurredData.data[idx + (cropArea.width * 4)] +
        blurredData.data[idx - 4 + (cropArea.width * 4)] + blurredData.data[idx + 4 + (cropArea.width * 4)] +
        blurredData.data[idx - 4 - (cropArea.width * 4)] + blurredData.data[idx + 4 - (cropArea.width * 4)];
      blurredData.data[idx] = blurredData.data[idx + 1] = blurredData.data[idx + 2] = sum / 16;
    }
  }
  tempCtx.putImageData(blurredData, 0, 0);
  const sharpenedData = tempCtx.getImageData(0, 0, cropArea.width, cropArea.height);
  for (let i = 0; i < sharpenedData.data.length; i += 4) {
    sharpenedData.data[i] = sharpenedData.data[i + 1] = sharpenedData.data[i + 2] =
      Math.min(255, 1.5 * sharpenedData.data[i] - 0.5 * blurredData.data[i]);
  }
  tempCtx.putImageData(sharpenedData, 0, 0);

  // Threshold (127 as in Python)
  const threshData = tempCtx.getImageData(0, 0, cropArea.width, cropArea.height);
  for (let i = 0; i < threshData.data.length; i += 4) {
    threshData.data[i] = threshData.data[i + 1] = threshData.data[i + 2] =
      threshData.data[i] > 127 ? 255 : 0;
  }
  tempCtx.putImageData(threshData, 0, 0);

  // OCR with Tesseract
  const worker = await loadTesseract();
  let text = '';
  try {
    const { data: { text: ocrText } } = await worker.recognize(tempCanvas);
    text = ocrText;
  } catch (err) {
    console.error('Tesseract OCR failed:', err);
    await worker.terminate();
    return []; // Return empty on error
  }

  // Parse like Python
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  const results: MUTCDSign[] = [];
  for (const line of lines) {
    // Skip headers
    if (['STD. NO.', 'SIZE', 'DESCRIPTION', 'QUANTITY', 'TABULATION', 'INCLUDED', 'CHANNEL', 'TYPE'].some(word => line.toUpperCase().includes(word))) {
      continue;
    }
    const words = line.split(/\s+/);
    if (words.length >= 4) {
      const code = words[0].trim();
      const size = words.slice(1, 4).join(' ').trim();
      const descWords = words.slice(4);
      let quantity = '';
      let description = descWords.join(' ').trim();
      if (descWords.length > 0 && /^\d+$/.test(descWords[descWords.length - 1])) {
        quantity = descWords.pop()!;
        description = descWords.join(' ').trim();
      }
      if (code && size && description) { // Only add if meaningful
        results.push({
          id: `sign-${Date.now()}-${results.length}`,
          code,
          size,
          description,
          quantity,
        });
      }
    }
  }

  // Cleanup
  await worker.terminate();
  return results;
};
