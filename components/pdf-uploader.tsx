"use client"

import { useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Card } from "@/components/ui/card"
import { Upload, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"

interface PDFUploaderProps {
  onFileUpload: (files: File[]) => void
}

export function PDFUploader({ onFileUpload }: PDFUploaderProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileUpload(acceptedFiles)
      }
    },
    [onFileUpload],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
    },
    multiple: true,
  })

  return (
    <Card className="w-full max-w-xl p-6">
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50"
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="rounded-full bg-primary/10 p-3">
            {isDragActive ? <Upload className="h-8 w-8 text-primary" /> : <FileText className="h-8 w-8 text-primary" />}
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-foreground">
              {isDragActive ? "Drop your PDFs here" : "Upload Traffic Plan PDFs"}
            </h3>
            <p className="text-xs text-muted-foreground">Drag and drop or click to browse</p>
          </div>
          <Button variant="outline" size="sm" className="mt-1 bg-transparent">
            Select Files
          </Button>
        </div>
      </div>
      <div className="mt-4 space-y-1 text-center text-xs text-muted-foreground">
        <p>Supported format: PDF (multiple files allowed)</p>
      </div>
    </Card>
  )
}
