"use client"
import { useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import { Button } from "@/components/ui/button"
import { ZoomIn, ZoomOut, RotateCw } from "lucide-react"
import "react-pdf/dist/esm/Page/AnnotationLayer.css"
import "react-pdf/dist/esm/Page/TextLayer.css"
// Configure PDF.js worker
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
}

interface PDFViewerProps {
  file: File | string
  onSignsDetected?: (signs: any[]) => void // Stub for future sign detection
  selectedPage: number
  onPageChange: (page: number) => void
}

export function PDFViewer({ file, onSignsDetected, selectedPage, onPageChange }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [scale, setScale] = useState<number>(1.0)
  const [rotation, setRotation] = useState<number>(0)

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages)
    // Ensure selectedPage doesn't exceed numPages
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
        <div
          className="overflow-auto"
          style={{
            height: "70vh",
          }}
        >
          <div className="inline-block min-w-full p-4">
            <Document
              file={file}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">Loading PDF...</p>
                </div>
              }
              error={
                <div className="flex items-center justify-center h-full">
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
              />
            </Document>
          </div>
        </div>
      </div>
    </div>
  )
}
