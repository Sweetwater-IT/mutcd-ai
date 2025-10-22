"use client"

import { useState } from "react"
import { PDFUploader } from "@/components/pdf-uploader"
import dynamic from "next/dynamic"
import { SignList } from "@/components/sign-list"
import { RecentFiles, saveToRecentFiles } from "@/components/recent-files"
import { FileText, Upload, ChevronDown } from "lucide-react"
import type { DetectedSign } from "@/lib/opencv-detector"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface PDFWithSigns {
  file: File
  signs: DetectedSign[]
  selectedPage: number
}

const PDFViewer = dynamic(() => import("@/components/pdf-viewer").then((mod) => (mod as any).PDFViewer), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100vh-12rem)] items-center justify-center rounded-lg border border-border bg-card">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading PDF viewer...</p>
      </div>
    </div>
  ),
})

export default function Home() {
  const [pdfFiles, setPdfFiles] = useState<PDFWithSigns[]>([])
  const [selectedPdfIndex, setSelectedPdfIndex] = useState<number>(0)

  const handleFileUpload = (files: File[]) => {
    const newPdfs = files.map((file) => ({
      file,
      signs: [],
      selectedPage: 1,
    }))
    setPdfFiles((prev) => [...prev, ...newPdfs])
    // Select the first newly uploaded file
    if (pdfFiles.length === 0) {
      setSelectedPdfIndex(0)
    }
  }

  const handleSignsDetected = (detectedSigns: DetectedSign[]) => {
    setPdfFiles((prev) =>
      prev.map((pdf, index) => {
        if (index === selectedPdfIndex) {
          const updatedSigns = [...pdf.signs, ...detectedSigns]
          if (updatedSigns.length > 0) {
            // Convert file to base64 for storage
            const reader = new FileReader()
            reader.onload = () => {
              const base64 = reader.result as string
              saveToRecentFiles(pdf.file.name, updatedSigns.length, base64)
            }
            reader.readAsDataURL(pdf.file)
          }
          return { ...pdf, signs: updatedSigns }
        }
        return pdf
      }),
    )
  }

  const handleSignUpdate = (updatedSigns: DetectedSign[]) => {
    setPdfFiles((prev) =>
      prev.map((pdf, index) => (index === selectedPdfIndex ? { ...pdf, signs: updatedSigns } : pdf)),
    )
  }

  const handlePageChange = (page: number) => {
    setPdfFiles((prev) => prev.map((pdf, index) => (index === selectedPdfIndex ? { ...pdf, selectedPage: page } : pdf)))
  }

  const currentPdf = pdfFiles[selectedPdfIndex]

  const handleRecentFileSelect = async (fileData: string, fileName: string) => {
    try {
      // Convert base64 back to File object
      const response = await fetch(fileData)
      const blob = await response.blob()
      const file = new File([blob], fileName, { type: "application/pdf" })
      handleFileUpload([file])
    } catch (error) {
      console.error("Failed to load recent file:", error)
    }
  }

  const handleDone = () => {
    setPdfFiles([])
    setSelectedPdfIndex(0)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <FileText className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">MUTCD Sign Detector</h1>
                <p className="text-sm text-muted-foreground">Traffic Plan Analysis Tool</p>
              </div>
            </div>
            {pdfFiles.length > 0 && (
              <div className="flex items-center gap-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2 hover:bg-muted/50"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{currentPdf.file.name}</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[300px]">
                    {pdfFiles.map((pdf, index) => (
                      <DropdownMenuItem
                        key={index}
                        onClick={() => setSelectedPdfIndex(index)}
                        className={`flex items-center gap-2 ${index === selectedPdfIndex ? "bg-muted" : ""}`}
                      >
                        <FileText className="h-4 w-4" />
                        <span className="truncate">{pdf.file.name}</span>
                        {index === selectedPdfIndex && <span className="ml-auto text-xs text-primary">Active</span>}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" size="sm" onClick={() => document.getElementById("pdf-upload")?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Add More
                </Button>
                <Button variant="default" size="sm" onClick={handleDone}>
                  Done
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>
      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {pdfFiles.length === 0 ? (
          <div className="space-y-8">
            <div className="flex justify-center pt-8">
              <PDFUploader onFileUpload={handleFileUpload} />
            </div>
            <RecentFiles onFileSelect={handleRecentFileSelect} />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
            {/* PDF Viewer with Crop Box */}
            <div className="space-y-4">
              <PDFViewer
                file={currentPdf.file}
                onSignsDetected={handleSignsDetected}
                selectedPage={currentPdf.selectedPage}
                onPageChange={handlePageChange}
              />
            </div>
            {/* Sign List Sidebar */}
            <div className="space-y-4">
              <SignList signs={currentPdf.signs} onSignsUpdate={handleSignUpdate} pdfFileName={currentPdf.file.name} />
            </div>
          </div>
        )}
      </main>
      <input
        id="pdf-upload"
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || [])
          if (files.length > 0) {
            handleFileUpload(files)
          }
          e.target.value = "" // Reset input
        }}
      />
    </div>
  )
}
