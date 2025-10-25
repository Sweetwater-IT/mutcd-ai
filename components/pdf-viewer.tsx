"use client"
import { useEffect, useRef, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react"  // Removed Crop (no button)
import dynamic from "next/dynamic"
import { detectSigns } from "@/lib/opencv-detector"
import type { DetectedSign } from "@/lib/opencv-detector"
import * as pdfjsLib from "pdfjs-dist"

const KonvaCropBox = dynamic(() => import("@/components/konva-crop-box").then((mod) => mod.KonvaCropBox), {
  ssr: false,
})

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
}

export interface PDFViewerProps {
  file: File
  onSignsDetected: (signs: DetectedSign[]) => void
  selectedPage: number
  onPageChange: (page: number) => void
}

export function PDFViewer({ file, onSignsDetected, selectedPage, onPageChange }: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasWrapperRef = useRef<HTMLDivElement>(null)
  const cropBoxRef = useRef<{ getCropArea: () => { x: number; y: number; width: number; height: number } | null }>(null)
  const [numPages, setNumPages] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [cropMode, setCropMode] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadPDF = async () => {
      try {
        setIsLoading(true)
        setError(null)
        console.log("[v0] Loading PDF:", file.name)
        const fileUrl = URL.createObjectURL(file)
        const loadingTask = pdfjsLib.getDocument(fileUrl)
        const pdf = await loadingTask.promise
        console.log("[v0] PDF loaded successfully, pages:", pdf.numPages)
        setPdfDoc(pdf)
        setNumPages(pdf.numPages)
        setIsLoading(false)
      } catch (err) {
        console.error("[v0] Error loading PDF:", err)
        setError("Failed to load PDF. Please try again.")
        setIsLoading(false)
      }
    }
    loadPDF()
  }, [file])

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return
    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(selectedPage)
        const canvas = canvasRef.current!
        const context = canvas.getContext("2d")!
        const baseScale = 1.0 // Larger base scale for better visibility
        const viewport = page.getViewport({ scale: baseScale * zoom })
        canvas.height = viewport.height
        canvas.width = viewport.width
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        }
        await page.render(renderContext).promise
        console.log("[v0] Page rendered:", selectedPage)
      } catch (err) {
        console.error("[v0] Error rendering page:", err)
      }
    }
    renderPage()
  }, [pdfDoc, selectedPage, zoom])

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3))
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5))

  const handleStartScan = async () => {
    const area = cropBoxRef.current?.getCropArea()
    if (area && area.width > 10 && area.height > 10) {
      setCropMode(false)
      setIsProcessing(true)
      try {
        if (canvasRef.current) {
          const signs = await detectSigns(canvasRef.current, area)
          console.log("[v0] Detected signs:", signs)
          onSignsDetected(signs)
        }
      } catch (error) {
        console.error("[v0] Error detecting signs:", error)
      } finally {
        setIsProcessing(false)
      }
    }
  }

  const handleCancelCrop = () => {
    setCropMode(false)
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
          {cropMode && (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={handleStartScan}
                className="ml-2"
                disabled={isProcessing}
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
        onClick={() => setCropMode(true)}  // Click to start crop mode
      >
        <div className="flex h-full items-center justify-center p-8">
          <div ref={canvasWrapperRef} className="relative">
            <canvas ref={canvasRef} className="shadow-lg" />
            {cropMode && canvasRef.current && (
              <KonvaCropBox
                ref={cropBoxRef}
                canvasRef={canvasRef}
                onCropComplete={handleStartScan}
                onCancel={handleCancelCrop}
              />
            )}
          </div>
        </div>
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50">
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
