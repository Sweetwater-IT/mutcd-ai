"use client"
import { useEffect, useRef, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Crop as CropIcon } from "lucide-react" // Aliased Crop to CropIcon
import { toast } from "sonner"
import { detectSigns } from "@/lib/tesseract-detector"
import type { MUTCDSign } from "@/lib/types/mutcd"  
import * as pdfjsLib from "pdfjs-dist"
import ReactCrop, { type Crop } from 'react-image-crop' 
import 'react-image-crop/dist/ReactCrop.css' 
import axios from 'axios'
import { analyzeWithGrok } from "@/lib/grok-analyzer"

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
}

export interface PDFViewerProps {
  file: File
  onSignsDetected: (signs: MUTCDSign[]) => void
  selectedPage: number
  onPageChange: (page: number) => void
}

export function PDFViewer({ file, onSignsDetected, selectedPage, onPageChange }: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasWrapperRef = useRef<HTMLDivElement>(null)
  const [numPages, setNumPages] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [cropMode, setCropMode] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
 
  // Crop state - using px for consistency
  const [crop, setCrop] = useState<Crop | undefined>(undefined)
  const showCropBox = cropMode && crop && crop.width > 0 && crop.height > 0
  useEffect(() => {
    const loadPDF = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const fileUrl = URL.createObjectURL(file)
        const loadingTask = pdfjsLib.getDocument(fileUrl)
        const pdf = await loadingTask.promise
        setPdfDoc(pdf)
        setNumPages(pdf.numPages)
        setIsLoading(false)
      } catch (err) {
        setError("Failed to load PDF. Please try again.")
        setIsLoading(false)
      }
    }
    loadPDF()
  }, [file])
  const [isAnalyzingGrok, setIsAnalyzingGrok] = useState(false)
  
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return
    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(selectedPage)
        const canvas = canvasRef.current!
        const context = canvas.getContext("2d")!
        const baseScale = 1.4
        const viewport = page.getViewport({ scale: baseScale * zoom })
        canvas.height = viewport.height
        canvas.width = viewport.width
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        }
        await page.render(renderContext).promise
       
        // Re-center crop on new page/zoom (using px)
        if (cropMode && canvasRef.current) {
          const canvasW = canvas.width
          const canvasH = canvas.height
          const centerX = Math.max(0, (canvasW / 2) - 100)
          const centerY = Math.max(0, (canvasH / 2) - 100)
          const initialWidth = Math.min(200, canvasW - centerX)
          const initialHeight = Math.min(200, canvasH - centerY)
          setCrop({
            unit: 'px',
            x: centerX,
            y: centerY,
            width: initialWidth,
            height: initialHeight,
          })
        }
      } catch (err) {
        console.error("Error rendering page:", err)
      }
    }
    renderPage()
  }, [pdfDoc, selectedPage, zoom, cropMode])
  
  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3))
  
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5))
  
  const handleEnterCropMode = () => {
    setCropMode(true)
    setCrop(undefined) // Reset to trigger re-center in effect
    // Initial crop will be set on render
  }
  
  // Crop change handler (live updates during drag/resize)
  const onCropChange = (newCrop: Crop) => {
    setCrop(newCrop)
  }
  
  // No need for onComplete - use live crop for everything
  const handleStartScan = async () => {
    if (!crop || crop.width < 50 || crop.height < 50) return
    setCropMode(false)
    setIsProcessing(true)
    try {
      if (canvasRef.current && crop) {
        const area = {
          x: crop.x,
          y: crop.y,
          width: crop.width,
          height: crop.height,
        }
        let signs = await detectSigns(canvasRef.current, area)
        
        // Analyze with Grok 4
        console.log('Calling Grok analyzer...') // NEW: Console log for verification
        toast.info("Analyzing with Grok...") // NEW: UI feedback
        setIsAnalyzingGrok(true) // NEW: Loading state
        signs = await analyzeWithGrok(signs) // Correct and refine MUTCD JSON with Grok 4 reasoning 
        console.log('Grok analysis complete:', signs) // NEW: Log output
              
        onSignsDetected(signs)
        
        // Export crop as PNG (same as before)
        const canvas = canvasRef.current
        
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = area.width
        tempCanvas.height = area.height
        
        const tempCtx = tempCanvas.getContext('2d')
        if (tempCtx) {
          tempCtx.drawImage(canvas, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height)
          tempCanvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `crop-${Date.now()}.png`
              a.click()
              URL.revokeObjectURL(url)
            }
          }, 'image/png')
        }
      }
    } catch (error) {
      console.error("Error detecting signs:", error)
    } finally {
      setIsProcessing(false)
      setIsAnalyzingGrok(false) // NEW: End loading
      toast.success("Scan complete!") // NEW: Success toast      
    }
  }

  // NEW: Function to analyze OCR JSON with Grok 4
  const analyzeWithGrok = async (ocrSigns: MUTCDSign[]): Promise<MUTCDSign[]> => {
    try {
      const response = await axios.post('https://api.x.ai/v1/chat/completions', {
        model: 'grok-beta',
        messages: [
          {
            role: 'system',
            content: 'You are a MUTCD sign expert. Analyze and correct this OCR-extracted JSON for accuracy: Fix codes (e.g., "Ma-8" to "M4-8"), remove artifacts (e.g., "|"), add full descriptions from MUTCD standards, infer quantities if possible. Return only corrected JSON array.'
          },
          {
            role: 'user',
            content: JSON.stringify(ocrSigns)
          }
        ],
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      const correctedJson = response.data.choices[0].message.content;
      return JSON.parse(correctedJson); // Assume Grok returns clean JSON
    } catch (err) {
      console.error('Grok API failed:', err);
      return ocrSigns; // Fallback to raw OCR if API fails
    }
  };
  
  const handleCancelCrop = () => {
    setCropMode(false)
    setCrop(undefined)
  }
  
  if (isLoading) {
    return (
      <Card className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading PDF...</p>
        </div>
      </Card>
    )
  }
  
  if (error) {
    return (
      <Card className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-sm text-destructive">{error}</p>
          <Button onClick={() => window.location.reload()}>Reload Page</Button>
        </div>
      </Card>
    )
  }
  
  const canvasWidth = canvasRef.current?.width || 0
  
  const canvasHeight = canvasRef.current?.height || 0
  
  const overlayStyle = showCropBox && crop
    ? {
        background: `
          linear-gradient(to right,
            rgba(0,0,0,0.5) 0px,
            rgba(0,0,0,0.5) ${crop.x}px,
            transparent ${crop.x}px,
            transparent ${crop.x + crop.width}px,
            rgba(0,0,0,0.5) ${crop.x + crop.width}px,
            rgba(0,0,0,0.5) ${canvasWidth}px
          ),
          linear-gradient(to bottom,
            rgba(0,0,0,0.5) 0px,
            rgba(0,0,0,0.5) ${crop.y}px,
            transparent ${crop.y}px,
            transparent ${crop.y + crop.height}px,
            rgba(0,0,0,0.5) ${crop.y + crop.height}px,
            rgba(0,0,0,0.5) ${canvasHeight}px
          )
        `,
      }
    : { backgroundColor: 'rgba(0,0,0,0.1)' }
  
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(1, selectedPage - 1))}
            disabled={selectedPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-foreground">
            Page {selectedPage} of {numPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(numPages, selectedPage + 1))}
            disabled={selectedPage === numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-foreground">{Math.round(zoom * 100)}%</span>
          <Button variant="outline" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleEnterCropMode}
            disabled={cropMode}
          >
            <CropIcon className="mr-1 h-4 w-4" />
            Draw Crop Box
          </Button>
          {cropMode && (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={handleStartScan}
                className="ml-2"
                disabled={isProcessing || !crop || crop.width < 50 || crop.height < 50}
              >
                {isProcessing ? "Processing..." : "Start Scan"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleCancelCrop}>
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>
      <div
        ref={containerRef}
        className="relative flex-1 overflow-auto bg-muted/10"
      >
        <div className="flex h-full items-center justify-center p-8">
          <div ref={canvasWrapperRef} className="relative">
            {cropMode ? (
              <>
                {/* Dim overlay outside crop */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={overlayStyle}
                />
                {/* React Crop Wrapper */}
                <ReactCrop
                  crop={crop}
                  onChange={onCropChange}
                  minWidth={50}
                  minHeight={50}
                  circularCrop={false}
                  aspect={undefined} // Freeform; set to number for fixed ratio
                  style={{ // Optional: Style the cropper
                    border: '2px solid #3b82f6', // Blue border
                    backgroundColor: 'rgba(59, 130, 246, 0.2)', // Translucent blue fill
                  }}
                >
                  <canvas ref={canvasRef} className="shadow-lg" />
                </ReactCrop>
              </>
            ) : (
              <canvas
                ref={canvasRef}
                className="shadow-lg"
              />
            )}
          </div>
        </div>
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-50">
            <div className="rounded-lg bg-card p-6 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm font-medium text-foreground">Detecting signs...</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
