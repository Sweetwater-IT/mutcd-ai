"use client"
import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { ZoomIn, ZoomOut, RotateCw, Crop as CropIcon } from "lucide-react"
import { toast } from "sonner"
import type { MUTCDSign } from "@/lib/types/mutcd" // Adjust if needed for signs type
import ReactCrop, { type Crop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/esm/Page/AnnotationLayer.css"
import "react-pdf/dist/esm/Page/TextLayer.css"
// Configure PDF.js worker
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
}

export interface PDFViewerProps {
  file: File | string
  onSignsDetected: (signs: MUTCDSign[]) => void // Made required
  selectedPage: number
  onPageChange: (page: number) => void
}

export function PDFViewer({ file, onSignsDetected, selectedPage, onPageChange }: PDFViewerProps) {
  const pageRef = useRef<HTMLDivElement>(null) // NEW: Ref for canvas query
  const [numPages, setNumPages] = useState<number>(0)
  const [scale, setScale] = useState<number>(1.0)
  const [rotation, setRotation] = useState<number>(0)
  // NEW: Crop state
  const [cropMode, setCropMode] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [crop, setCrop] = useState<Crop | undefined>(undefined)
  const showCropBox = cropMode && crop && crop.width > 0 && crop.height > 0

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages)
    if (selectedPage > numPages) {
      onPageChange(1)
    }
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

  // NEW: Crop handlers
  const handleEnterCropMode = () => {
    setCropMode(true)
    setCrop(undefined)
  }

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
    const canvas = pageDiv.querySelector('canvas') as HTMLCanvasElement
    if (!canvas) throw new Error('Canvas not found')

    // NEW: Get canvas rect for offset/scale adjustment
    const canvasRect = canvas.getBoundingClientRect()
    const divRect = pageDiv.getBoundingClientRect()
    const scrollOffsetX = pageDiv.scrollLeft
    const scrollOffsetY = pageDiv.scrollTop
    const relativeX = crop.x + scrollOffsetX - (divRect.left - canvasRect.left)
    const relativeY = crop.y + scrollOffsetY - (divRect.top - canvasRect.top)

    // Scale coords to canvas (react-pdf canvas is scaled)
    const adjustedX = relativeX * scale
    const adjustedY = relativeY * scale
    const adjustedWidth = crop.width * scale
    const adjustedHeight = crop.height * scale

    const area = { x: adjustedX, y: adjustedY, width: adjustedWidth, height: adjustedHeight }
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = adjustedWidth
    tempCanvas.height = adjustedHeight
    const tempCtx = tempCanvas.getContext('2d')
    if (tempCtx && canvas) {
      tempCtx.drawImage(canvas, adjustedX, adjustedY, adjustedWidth, adjustedHeight, 0, 0, adjustedWidth, adjustedHeight)
      const pngBlob = await new Promise<Blob | null>((resolve) => {
        tempCanvas.toBlob((blob) => resolve(blob), 'image/png')
      })
      if (!pngBlob) throw new Error('Failed to create PNG blob')
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

  const handleCancelCrop = () => {
    setCropMode(false)
    setCrop(undefined)
  }

  // NEW: Overlay style for dimming outside crop
  const pageDiv = pageRef.current
  const canvas = pageDiv?.querySelector('canvas') as HTMLCanvasElement
  const canvasWidth = canvas?.width || 0
  const canvasHeight = canvas?.height || 0
  const overlayStyle = showCropBox && crop
    ? {
        background: `
          linear-gradient(to right, rgba(0,0,0,0.5) 0px, rgba(0,0,0,0.5) ${crop.x}px, transparent ${crop.x}px, transparent ${crop.x + crop.width}px, rgba(0,0,0,0.5) ${crop.x + crop.width}px, rgba(0,0,0,0.5) ${canvasWidth}px),
          linear-gradient(to bottom, rgba(0,0,0,0.5) 0px, rgba(0,0,0,0.5) ${crop.y}px, transparent ${crop.y}px, transparent ${crop.y + crop.height}px, rgba(0,0,0,0.5) ${crop.y + crop.height}px, rgba(0,0,0,0.5) ${canvasHeight}px)
        `,
      }
    : { backgroundColor: 'rgba(0,0,0,0.1)' }

  return (
    <div className="space-y-4">
      {/* Controls */}
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
          {/* NEW: Crop button + conditional scan/cancel */}
          <Button variant="outline" size="sm" onClick={handleEnterCropMode} disabled={cropMode}>
            <CropIcon className="mr-1 h-4 w-4" />
            Draw Crop Box
          </Button>
          {cropMode && (
            <>
              <Button variant="default" size="sm" onClick={handleStartScan} className="ml-2" disabled={isProcessing || !crop || crop.width < 50 || crop.height < 50}>
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
      {/* PDF Viewport */}
      <div className="border border-border rounded-lg bg-muted overflow-hidden">
        <div className="overflow-auto" style={{ height: "70vh" }}>
          <div className="inline-block p-4 mx-auto relative" ref={pageRef}> {/* NEW: ref here */}
            {cropMode ? (
              <>
                {/* NEW: Dim overlay outside crop */}
                <div className="absolute inset-0 pointer-events-none" style={overlayStyle} />
                {/* NEW: React Crop Wrapper */}
                <ReactCrop
                  crop={crop}
                  onChange={onCropChange}
                  minWidth={50}
                  minHeight={50}
                  circularCrop={false}
                  aspect={undefined}
                  style={{ border: '2px solid #3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.2)' }}
                >
                  <Document
                    file={file}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={<div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Loading PDF...</p></div>}
                    error={<div className="flex items-center justify-center h-full"><p className="text-destructive">Failed to load PDF</p></div>}
                  >
                    <Page pageNumber={selectedPage} scale={scale} rotate={rotation} renderTextLayer={true} renderAnnotationLayer={true} />
                  </Document>
                </ReactCrop>
              </>
            ) : (
              <Document
                file={file}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={<div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Loading PDF...</p></div>}
                error={<div className="flex items-center justify-center h-full"><p className="text-destructive">Failed to load PDF</p></div>}
              >
                <Page pageNumber={selectedPage} scale={scale} rotate={rotation} renderTextLayer={true} renderAnnotationLayer={true} />
              </Document>
            )}
          </div>
        </div>
      </div>
      {/* NEW: Processing overlay */}
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
  )
}
