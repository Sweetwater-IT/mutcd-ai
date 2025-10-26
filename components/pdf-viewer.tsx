"use client"
import { useEffect, useRef, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Crop as CropIcon, RotateCw } from "lucide-react"
import { toast } from "sonner"
import type { MUTCDSign } from "@/lib/types/mutcd"
import ReactCrop, { type Crop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/esm/Page/AnnotationLayer.css"
import "react-pdf/dist/esm/Page/TextLayer.css"
import axios from 'axios'
import { analyzeWithGrok } from "@/lib/grok-analyzer"

// Configure PDF.js worker for react-pdf
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
}

export interface PDFViewerProps {
  file: File
  onSignsDetected: (signs: MUTCDSign[]) => void
  selectedPage: number
  onPageChange: (page: number) => void
}

export function PDFViewer({ file, onSignsDetected, selectedPage, onPageChange }: PDFViewerProps) {
  const pageRef = useRef<HTMLDivElement>(null) // Ref for <Page> wrapper to extract canvas
  const [numPages, setNumPages] = useState<number>(0)
  const [scale, setScale] = useState<number>(1.0)
  const [rotation, setRotation] = useState<number>(0)
  const [cropMode, setCropMode] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  // Crop state - using px for consistency
  const [crop, setCrop] = useState<Crop | undefined>(undefined)
  const [isAnalyzingGrok, setIsAnalyzingGrok] = useState(false)
  const showCropBox = cropMode && crop && crop.width > 0 && crop.height > 0

  useEffect(() => {
    const loadPDF = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const url = URL.createObjectURL(file)
        setFileUrl(url)
        setIsLoading(false)
        // Cleanup on unmount
        return () => URL.revokeObjectURL(url)
      } catch (err) {
        setError("Failed to load PDF. Please try again.")
        setIsLoading(false)
      }
    }
    loadPDF()
  }, [file])

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages)
    if (selectedPage > numPages) onPageChange(1)
  }

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3.0))
  }

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5))
  }

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360)
  }

  const goToPrevPage = () => {
    onPageChange(Math.max(1, selectedPage - 1))
  }

  const goToNextPage = () => {
    onPageChange(Math.min(numPages, selectedPage + 1))
  }

  const handleEnterCropMode = () => {
    setCropMode(true)
    setCrop(undefined) // Reset to trigger re-center
  }

  // Crop change handler (live updates during drag/resize)
  const onCropChange = (newCrop: Crop) => {
    setCrop(newCrop)
  }

  const handleStartScan = async () => {
    if (!crop || crop.width < 50 || crop.height < 50) return
    setCropMode(false)
    setIsProcessing(true)
    toast.info("Scanning crop...")
    try {
      const pageDiv = pageRef.current
      if (!pageDiv || !crop) return
      const canvas = pageDiv.querySelector('canvas') as HTMLCanvasElement // react-pdf renders to <canvas> inside <div>
      if (!canvas) throw new Error('Canvas not found')
      const area = { x: crop.x, y: crop.y, width: crop.width, height: crop.height }
      // Extract cropped area as PNG blob
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = area.width
      tempCanvas.height = area.height
      const tempCtx = tempCanvas.getContext('2d')
      if (tempCtx && canvas) {
        tempCtx.drawImage(canvas, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height)
        const pngBlob = await new Promise<Blob | null>((resolve) => {
          tempCanvas.toBlob((blob) => resolve(blob), 'image/png')
        })
        if (!pngBlob) throw new Error('Failed to create PNG blob')
        // Send to backend
        const formData = new FormData()
        formData.append('file', pngBlob, 'crop.png')
        const startTime = Date.now()
        toast.info("Analyzing with Grok...")
        setIsAnalyzingGrok(true)
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/process-image`, {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) throw new Error(`Backend error: ${res.status}`)
        const signs = await res.json()
        const elapsed = Date.now() - startTime
        if (elapsed < 1500) {
          await new Promise(resolve => setTimeout(resolve, 1500 - elapsed))
        }
        console.log('Backend analysis complete:', signs)
        toast.info("Analysis complete!")
        onSignsDetected(signs)
        // Optional: Download PNG
        const url = URL.createObjectURL(pngBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = `crop-${Date.now()}.png`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error("Backend processing failed:", error)
      toast.error("Scan failed—try again!")
    } finally {
      setIsProcessing(false)
      setIsAnalyzingGrok(false)
      toast.success("Scan complete!")
    }
  }

  // NEW: Function to analyze OCR JSON with Grok 4 (unchanged)
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
      })
      const correctedJson = response.data.choices[0].message.content
      return JSON.parse(correctedJson)
    } catch (err) {
      console.error('Grok API failed:', err)
      return ocrSigns
    }
  }

  const handleCancelCrop = () => {
    setCropMode(false)
    setCrop(undefined)
  }

  if (isLoading || !fileUrl) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading PDF...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-sm text-destructive">{error}</p>
          <Button onClick={() => window.location.reload()}>Reload Page</Button>
        </div>
      </div>
    )
  }

  // Dynamically get canvas size for overlay
  const pageDiv = pageRef.current
  const canvas = pageDiv?.querySelector('canvas') as HTMLCanvasElement
  const canvasWidth = canvas?.width || 0
  const canvasHeight = canvas?.height || 0

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
      <div className="space-y-4 p-4">
        {/* Controls - Matched to v0 layout */}
        <div className="flex items-center justify-between bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handleZoomOut} disabled={scale <= 0.5}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-card-foreground min-w-16 text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button variant="outline" size="icon" onClick={handleZoomIn} disabled={scale >= 3.0}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleRotate}>
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleEnterCropMode}
              disabled={cropMode}
            >
              <CropIcon className="h-4 w-4" />
            </Button>
            {cropMode && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleStartScan}
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
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={goToPrevPage} disabled={selectedPage <= 1}>
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {selectedPage} of {numPages}
            </span>
            <Button variant="outline" onClick={goToNextPage} disabled={selectedPage >= numPages}>
              Next
            </Button>
          </div>
        </div>
        {/* PDF Viewport - Matched to v0, with fixed height and clipping */}
        <div className="border border-border rounded-lg bg-muted overflow-hidden">
          <div
            className="flex h-[70vh] items-center justify-center p-4"
            style={{ overflow: "hidden" }}
          >
            <div className="relative inline-block max-w-full max-h-full">
              {cropMode ? (
                <>
                  {/* Dim overlay outside crop */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={overlayStyle}
                  />
                  {/* React Crop Wrapper around Page */}
                  <ReactCrop
                    crop={crop}
                    onChange={onCropChange}
                    minWidth={50}
                    minHeight={50}
                    circularCrop={false}
                    aspect={undefined}
                    style={{
                      border: '2px solid #3b82f6',
                      backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    }}
                  >
                    <div ref={pageRef}>
                      <Document
                        file={fileUrl}
                        onLoadSuccess={onDocumentLoadSuccess}
                        loading={
                          <div className="flex items-center justify-center h-full w-full">
                            <p className="text-muted-foreground">Loading PDF...</p>
                          </div>
                        }
                        error={
                          <div className="flex items-center justify-center h-full w-full">
                            <p className="text-destructive">Failed to load PDF</p>
                          </div>
                        }
                      >
                        <Page
                          pageNumber={selectedPage}
                          scale={scale}
                          rotate={rotation}
                          renderTextLayer={true}
                          renderAnnotationLayer={true}
                          className="shadow-lg"
                        />
                      </Document>
                    </div>
                  </ReactCrop>
                </>
              ) : (
                <div ref={pageRef}>
                  <Document
                    file={fileUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={
                      <div className="flex items-center justify-center h-full w-full">
                        <p className="text-muted-foreground">Loading PDF...</p>
                      </div>
                    }
                    error={
                      <div className="flex items-center justify-center h-full w-full">
                        <p className="text-destructive">Failed to load PDF</p>
                      </div>
                    }
                  >
                    <Page
                      pageNumber={selectedPage}
                      scale={scale}
                      rotate={rotation}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      className="shadow-lg"
                    />
                  </Document>
                </div>
              )}
            </div>
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
