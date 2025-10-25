"use client"
import { useEffect, useRef, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Crop } from "lucide-react"
import { detectSigns } from "@/lib/opencv-detector"
import type { DetectedSign } from "@/lib/opencv-detector"
import * as pdfjsLib from "pdfjs-dist"

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
  const [numPages, setNumPages] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [cropMode, setCropMode] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Crop state
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 200, height: 200 })  // Initial 200x200
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null>(null)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [startArea, setStartArea] = useState({ x: 0, y: 0, width: 0, height: 0 })

  const showCropBox = cropMode && cropArea.width > 0 && cropArea.height > 0;  // Added: For overlay visibility

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
        // Center initial crop on new page
        if (cropMode) {
          const canvasRect = canvas.getBoundingClientRect()
          const centerX = (canvas.width / 2) - 100
          const centerY = (canvas.height / 2) - 100
          setCropArea({ x: centerX, y: centerY, width: 200, height: 200 })
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
    // Center 200x200 box on current canvas
    if (canvasRef.current) {
      const canvas = canvasRef.current
      const centerX = (canvas.width / 2) - 100
      const centerY = (canvas.height / 2) - 100
      setCropArea({ x: centerX, y: centerY, width: 200, height: 200 })
    }
  }

  // Drag the whole box
  const handleMouseDownBox = (e: React.MouseEvent) => {
    e.preventDefault()
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = e.clientX - rect.left - cropArea.x
    const y = e.clientY - rect.top - cropArea.y
    setStartPos({ x, y })
    setStartArea(cropArea)
    setIsResizing(false)  // Drag mode is false
  }

  const handleMouseMoveBox = (e: React.MouseEvent) => {
    if (!isResizing && resizeHandle === null) return
    e.preventDefault()
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    if (resizeHandle === null) {
      // Drag
      const deltaX = x - startPos.x - startArea.x
      const deltaY = y - startPos.y - startArea.y
      setCropArea({
        x: Math.max(0, startArea.x + deltaX),
        y: Math.max(0, startArea.y + deltaY),
        width: startArea.width,
        height: startArea.height,
      })
    } else {
      // Resize (example for top-left; extend for others)
      if (resizeHandle === 'top-left') {
        const newWidth = Math.max(50, startArea.width - (x - startArea.x))
        const newHeight = Math.max(50, startArea.height - (y - startArea.y))
        setCropArea({
          x: startArea.x + (startArea.width - newWidth),
          y: startArea.y + (startArea.height - newHeight),
          width: newWidth,
          height: newHeight,
        })
      }
      // Add cases for other handles
    }
  }

  const handleMouseUpBox = () => {
    setIsResizing(false)
    setResizeHandle(null)
  }

  // Resize handles
  const handleMouseDownHandle = (handle: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => (e: React.MouseEvent) => {
    e.stopPropagation()
    setResizeHandle(handle)
    setStartPos({ x: e.clientX, y: e.clientY })
    setStartArea(cropArea)
    setIsResizing(true)
  }

  const handleStartScan = async () => {
    if (cropArea.width < 50 || cropArea.height < 50) return
    setCropMode(false)
    setIsProcessing(true)
    try {
      if (canvasRef.current) {
        const area = cropArea
        const signs = await detectSigns(canvasRef.current, area)
        onSignsDetected(signs)

        // Export crop as PNG
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
    }
  }

  const handleCancelCrop = () => {
    setCropMode(false)
    setCropArea({ x: 0, y: 0, width: 200, height: 200 })
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleEnterCropMode}
            disabled={cropMode}
          >
            <Crop className="mr-1 h-4 w-4" />
            Draw Crop Box
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
      >
        <div className="flex h-full items-center justify-center p-8">
          <div ref={canvasWrapperRef} className="relative">
            <canvas 
              ref={canvasRef} 
              className="shadow-lg"
              onMouseDown={handleMouseDownBox}
              onMouseMove={handleMouseMoveBox}
              onMouseUp={handleMouseUpBox}
              style={{ cursor: cropMode ? 'move' : 'default' }}
            />
            {cropMode && (
              <>
                {/* Dim overlay outside crop */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: showCropBox
                      ? `
                        linear-gradient(to right, rgba(0,0,0,0.3) ${cropArea.x}px, transparent ${cropArea.x}px, transparent ${cropArea.x + cropArea.width}px, rgba(0,0,0,0.3) ${cropArea.x + cropArea.width}px),
                        linear-gradient(to bottom, rgba(0,0,0,0.3) ${cropArea.y}px, transparent ${cropArea.y}px, transparent ${cropArea.y + cropArea.height}px, rgba(0,0,0,0.3) ${cropArea.y + cropArea.height}px)
                      `
                      : "rgba(0,0,0,0.1)",
                  }}
                />
                {/* Blue Crop Box */}
                <div
                  className="absolute border-2 border-blue-500 shadow-lg bg-blue-500 bg-opacity-20"
                  style={{
                    left: `${cropArea.x}px`,
                    top: `${cropArea.y}px`,
                    width: `${cropArea.width}px`,
                    height: `${cropArea.height}px`,
                  }}
                  onMouseDown={handleMouseDownBox}
                >
                  {/* Resize Handles */}
                  <div 
                    className="absolute -right-1 -top-1 h-3 w-3 bg-blue-500 rounded-full cursor-nwse-resize"
                    onMouseDown={handleMouseDownHandle('top-left')}
                  />
                  <div 
                    className="absolute -bottom-1 -right-1 h-3 w-3 bg-blue-500 rounded-full cursor-nesw-resize"
                    onMouseDown={handleMouseDownHandle('bottom-right')}
                  />
                  <div 
                    className="absolute -bottom-1 -left-1 h-3 w-3 bg-blue-500 rounded-full cursor-nwse-resize"
                    onMouseDown={handleMouseDownHandle('bottom-left')}
                  />
                  <div 
                    className="absolute -left-1 -top-1 h-3 w-3 bg-blue-500 rounded-full cursor-nesw-resize"
                    onMouseDown={handleMouseDownHandle('top-left')}
                  />
                </div>
              </>
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
