"use client"

import type React from "react"
import { useEffect } from "react"
import { useState } from "react"
import { FileText, Clock, MoreVertical, Pencil, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface RecentFile {
  id: string
  fileName: string
  signCount: number
  processedAt: string
  fileData: string // base64 encoded file data
  uploadedToBidX?: boolean
  detectionStatus: "not-started" | "successful" | "unsuccessful"
}

interface RecentFilesProps {
  onFileSelect: (fileData: string, fileName: string) => void
}

const MOCK_DATA: RecentFile[] = [
  {
    id: "1",
    fileName: "Main_Street_Traffic_Plan_2024.pdf",
    signCount: 12,
    processedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 mins ago
    fileData: "",
    uploadedToBidX: true,
    detectionStatus: "successful",
  },
  {
    id: "2",
    fileName: "Highway_101_Intersection_Signs.pdf",
    signCount: 8,
    processedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    fileData: "",
    uploadedToBidX: false,
    detectionStatus: "successful",
  },
  {
    id: "3",
    fileName: "Downtown_Parking_Signage.pdf",
    signCount: 0,
    processedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
    fileData: "",
    uploadedToBidX: false,
    detectionStatus: "not-started",
  },
  {
    id: "4",
    fileName: "School_Zone_Traffic_Control.pdf",
    signCount: 0,
    processedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    fileData: "",
    uploadedToBidX: false,
    detectionStatus: "unsuccessful",
  },
  {
    id: "5",
    fileName: "Bridge_Detour_Signs_Phase2.pdf",
    signCount: 15,
    processedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
    fileData: "",
    uploadedToBidX: true,
    detectionStatus: "successful",
  },
  {
    id: "6",
    fileName: "Bike_Lane_Signage_Project.pdf",
    signCount: 6,
    processedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3 days ago
    fileData: "",
    uploadedToBidX: false,
    detectionStatus: "successful",
  },
]

export function RecentFiles({ onFileSelect }: RecentFilesProps) {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([])
  const [editingFile, setEditingFile] = useState<RecentFile | null>(null)
  const [editedFileName, setEditedFileName] = useState("")
  const [uploadingFileId, setUploadingFileId] = useState<string | null>(null)

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
    } else {
      console.log("[v0] No stored files, loading mock data")
      setRecentFiles(MOCK_DATA)
    }
  }, [])

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = recentFiles.filter((file) => file.id !== id)
    setRecentFiles(updated)
    localStorage.setItem("mutcd-recent-files", JSON.stringify(updated))
  }

  const handleEdit = (file: RecentFile, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingFile(file)
    setEditedFileName(file.fileName)
  }

  const handleSaveEdit = () => {
    if (!editingFile || !editedFileName.trim()) return

    const updated = recentFiles.map((file) =>
      file.id === editingFile.id ? { ...file, fileName: editedFileName.trim() } : file,
    )
    setRecentFiles(updated)
    localStorage.setItem("mutcd-recent-files", JSON.stringify(updated))
    setEditingFile(null)
    setEditedFileName("")
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

  const getDetectionBadge = (file: RecentFile) => {
    if (file.detectionStatus === "not-started") {
      return (
        <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
          Detection not started
        </Badge>
      )
    }
    if (file.detectionStatus === "unsuccessful") {
      return (
        <Badge variant="outline" className="border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
          Detection unsuccessful
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400">
        {file.signCount} sign{file.signCount !== 1 ? "s" : ""} detected
      </Badge>
    )
  }

  const handleUploadToBidX = async (file: RecentFile, e: React.MouseEvent) => {
    e.stopPropagation()
    setUploadingFileId(file.id)

    try {
      const response = await fetch("/api/upload-to-bidx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdfFileName: file.fileName,
          signs: [], // In real implementation, this would contain the actual sign data
        }),
      })

      if (response.ok) {
        // Update the file's uploadedToBidX status
        const updated = recentFiles.map((f) => (f.id === file.id ? { ...f, uploadedToBidX: true } : f))
        setRecentFiles(updated)
        localStorage.setItem("mutcd-recent-files", JSON.stringify(updated))
      } else {
        console.error("Failed to upload to BidX")
      }
    } catch (error) {
      console.error("Error uploading to BidX:", error)
    } finally {
      setUploadingFileId(null)
    }
  }

  return (
    <div className="w-full max-w-5xl space-y-3">
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
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">File Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Detection Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">BidX Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Processed</th>
                  <th className="w-10 px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentFiles.map((file) => (
                  <tr
                    key={file.id}
                    className="group cursor-pointer transition-colors hover:bg-muted/50"
                    onClick={() => onFileSelect(file.fileData, file.fileName)}
                  >
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-primary" />
                        <span className="truncate text-sm font-medium text-foreground">{file.fileName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex">{getDetectionBadge(file)}</div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex">
                        {file.uploadedToBidX ? (
                          <Badge
                            variant="outline"
                            className="border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400"
                          >
                            Uploaded to BidX
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
                            Not uploaded
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs text-muted-foreground">{formatDate(file.processedAt)}</span>
                    </td>
                    <td className="px-4 py-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => handleEdit(file, e)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          {file.detectionStatus === "successful" && !file.uploadedToBidX && (
                            <DropdownMenuItem
                              onClick={(e) => handleUploadToBidX(file, e)}
                              disabled={uploadingFileId === file.id}
                            >
                              <Upload className="mr-2 h-4 w-4" />
                              {uploadingFileId === file.id ? "Uploading..." : "Upload to BidX"}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={(e) => handleDelete(file.id, e)} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={!!editingFile} onOpenChange={(open) => !open && setEditingFile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit File Name</DialogTitle>
            <DialogDescription>Update the name for this traffic plan file.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fileName">File Name</Label>
              <Input
                id="fileName"
                value={editedFileName}
                onChange={(e) => setEditedFileName(e.target.value)}
                placeholder="Enter file name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFile(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function saveToRecentFiles(fileName: string, signCount: number, fileData: string, uploadedToBidX = false) {
  const stored = localStorage.getItem("mutcd-recent-files")
  let recentFiles: RecentFile[] = []

  if (stored) {
    try {
      recentFiles = JSON.parse(stored)
    } catch (error) {
      console.error("Failed to parse recent files:", error)
    }
  }

  const existingIndex = recentFiles.findIndex((f) => f.fileName === fileName)

  const newFile: RecentFile = {
    id: Date.now().toString(),
    fileName,
    signCount,
    processedAt: new Date().toISOString(),
    fileData,
    uploadedToBidX,
    detectionStatus: signCount > 0 ? "successful" : "unsuccessful",
  }

  if (existingIndex >= 0) {
    recentFiles[existingIndex] = newFile
  } else {
    recentFiles.unshift(newFile)
  }

  recentFiles = recentFiles.slice(0, 12)

  localStorage.setItem("mutcd-recent-files", JSON.stringify(recentFiles))
}
