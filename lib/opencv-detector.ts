export interface DetectedSign {
  id: string
  type: string
  confidence: number
  boundingBox: {
    x: number
    y: number
    width: number
    height: number
  }
  imageData: string
}

// Load OpenCV.js
export const loadOpenCV = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && (window as any).cv) {
      resolve()
      return
    }

    const script = document.createElement("script")
    script.src = "https://docs.opencv.org/4.8.0/opencv.js"
    script.async = true
    script.onload = () => {
      // Wait for cv to be ready
      const checkCV = setInterval(() => {
        if ((window as any).cv && (window as any).cv.Mat) {
          clearInterval(checkCV)
          resolve()
        }
      }, 100)
    }
    script.onerror = reject
    document.head.appendChild(script)
  })
}

// Detect signs in cropped area using OpenCV
export const detectSigns = async (
  canvas: HTMLCanvasElement,
  cropArea: { x: number; y: number; width: number; height: number },
): Promise<DetectedSign[]> => {
  await loadOpenCV()
  const cv = (window as any).cv

  // Get image data from canvas
  const ctx = canvas.getContext("2d")!
  const imageData = ctx.getImageData(cropArea.x, cropArea.y, cropArea.width, cropArea.height)

  // Convert to OpenCV Mat
  const src = cv.matFromImageData(imageData)
  const gray = new cv.Mat()
  const blurred = new cv.Mat()
  const edges = new cv.Mat()
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()

  try {
    // Convert to grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)

    // Apply Gaussian blur to reduce noise
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0)

    // Detect edges using Canny
    cv.Canny(blurred, edges, 50, 150)

    // Find contours
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

    const detectedSigns: DetectedSign[] = []

    // Analyze contours to find potential signs
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i)
      const area = cv.contourArea(contour)

      // Filter by area (signs should be reasonably sized)
      if (area > 500 && area < cropArea.width * cropArea.height * 0.8) {
        const rect = cv.boundingRect(contour)

        // Calculate aspect ratio
        const aspectRatio = rect.width / rect.height

        // Signs are typically square-ish or rectangular
        if (aspectRatio > 0.5 && aspectRatio < 2.5) {
          // Extract sign image
          const signCanvas = document.createElement("canvas")
          signCanvas.width = rect.width
          signCanvas.height = rect.height
          const signCtx = signCanvas.getContext("2d")!

          signCtx.drawImage(
            canvas,
            cropArea.x + rect.x,
            cropArea.y + rect.y,
            rect.width,
            rect.height,
            0,
            0,
            rect.width,
            rect.height,
          )

          const signType = classifySign(rect, aspectRatio, area)

          detectedSigns.push({
            id: `sign-${Date.now()}-${i}`,
            type: signType,
            confidence: calculateConfidence(area, aspectRatio),
            boundingBox: {
              x: cropArea.x + rect.x,
              y: cropArea.y + rect.y,
              width: rect.width,
              height: rect.height,
            },
            imageData: signCanvas.toDataURL(),
          })
        }
      }

      contour.delete()
    }

    return detectedSigns
  } finally {
    // Clean up
    src.delete()
    gray.delete()
    blurred.delete()
    edges.delete()
    contours.delete()
    hierarchy.delete()
  }
}

// Classify sign based on shape characteristics
function classifySign(rect: { width: number; height: number }, aspectRatio: number, area: number): string {
  // Simple heuristic-based classification
  // In a real application, this would use ML models

  if (aspectRatio > 0.9 && aspectRatio < 1.1) {
    // Square-ish signs
    if (area > 5000) {
      return "W1-1 (Turn Warning)"
    }
    return "R1-1 (Stop Sign)"
  } else if (aspectRatio > 1.2 && aspectRatio < 1.8) {
    // Rectangular signs
    if (rect.width > rect.height) {
      return "W16-7 (Advisory Speed)"
    }
    return "R2-1 (Speed Limit)"
  } else if (aspectRatio < 0.8) {
    // Tall signs
    return "W2-1 (Cross Road)"
  }

  return "Unknown Sign"
}

// Calculate confidence score
function calculateConfidence(area: number, aspectRatio: number): number {
  let confidence = 0.5

  // Larger signs get higher confidence
  if (area > 2000) confidence += 0.2
  if (area > 5000) confidence += 0.1

  // Standard aspect ratios get higher confidence
  if ((aspectRatio > 0.9 && aspectRatio < 1.1) || (aspectRatio > 1.3 && aspectRatio < 1.7)) {
    confidence += 0.2
  }

  return Math.min(confidence, 0.95)
}
