"use client"

import type React from "react"
import { useEffect } from "react"
import { useState } from "react"
import { FileText, Clock, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface RecentFile {
  id: string
  fileName: string
  signCount: number
  processedAt: string
  fileData: string // base64 encoded file data
}

interface RecentFilesProps {
  onFileSelect: (fileData: string, fileName: string) => void
}

export function RecentFiles({ onFileSelect }: RecentFilesProps) {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([])

  // Load recent files from localStorage on mount
  useEffect(() => {
    console.log("[v0] RecentFiles component mounted")
    const stored = localStorage.getItem("mutcd-recent-files")
    console.log("[v0] Stored recent files:", stored)
    if (stored) {
      try {
        const files = JSON.parse(stored)
        console.log("[v0] Parsed recent files:", files)
        setRecentFiles(files)
      } catch (error) {
        console.error("Failed to load recent files:", error)
      }
    }
  }, [])

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = recentFiles.filter((file) => file.id !== id)
    setRecentFiles(updated)
    localStorage.setItem("mutcd-recent-files", JSON.stringify(updated))
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="w-full max-w-4xl space-y-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Clock className="h-5 w-5" />
        <h2 className="text-lg font-medium text-foreground">Recent Files</h2>
      </div>
      {recentFiles.length === 0 ? (
        <Card className="border border-dashed border-border bg-muted/20 p-8 text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">No recent files yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Upload a PDF and detect signs to see your recent files here
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recentFiles.map((file) => (
            <Card
              key={file.id}
              className="group relative cursor-pointer border border-border bg-card p-4 transition-all hover:border-primary hover:shadow-md"
              onClick={() => onFileSelect(file.fileData, file.fileName)}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-medium text-foreground">{file.fileName}</h3>
                  <p className="text-xs text-muted-foreground">
                    {file.signCount} sign{file.signCount !== 1 ? "s" : ""} detected
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(file.processedAt)}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-2 h-8 w-8 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={(e) => handleDelete(file.id, e)}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// Helper function to save a file to recent files (export for use in other components)
export function saveToRecentFiles(fileName: string, signCount: number, fileData: string) {
  const stored = localStorage.getItem("mutcd-recent-files")
  let recentFiles: RecentFile[] = []

  if (stored) {
    try {
      recentFiles = JSON.parse(stored)
    } catch (error) {
      console.error("Failed to parse recent files:", error)
    }
  }

  // Check if file already exists (by name)
  const existingIndex = recentFiles.findIndex((f) => f.fileName === fileName)

  const newFile: RecentFile = {
    id: Date.now().toString(),
    fileName,
    signCount,
    processedAt: new Date().toISOString(),
    fileData,
  }

  if (existingIndex >= 0) {
    // Update existing file
    recentFiles[existingIndex] = newFile
  } else {
    // Add new file to the beginning
    recentFiles.unshift(newFile)
  }

  // Keep only the 12 most recent files
  recentFiles = recentFiles.slice(0, 12)

  localStorage.setItem("mutcd-recent-files", JSON.stringify(recentFiles))
}
