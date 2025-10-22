"use client"
import type React from "react"
import { useEffect, useState } from "react"
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
import { supabase } from "@/lib/supabase"

interface RecentFile {
  id: string
  file_name: string
  sign_count: number
  processed_at: string
  uploaded_to_bidx?: boolean
  detection_status: "not-started" | "successful" | "unsuccessful"
  file_url: string  // Computed public URL
}

interface RecentFilesProps {
  onFileSelect: (fileUrl: string, fileName: string) => void
}

export function RecentFiles({ onFileSelect }: RecentFilesProps) {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([])
  const [editingFile, setEditingFile] = useState<RecentFile | null>(null)
  const [editedFileName, setEditedFileName] = useState("")
  const [uploadingFileId, setUploadingFileId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRecentFiles()

    const channel = supabase
      .channel('recent_files')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recent_files' }, () => {
        fetchRecentFiles()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchRecentFiles = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('recent_files')
        .select('*')
        .order('processed_at', { ascending: false })
        .limit(12)

      if (error) throw error

      const filesWithUrls: RecentFile[] = data?.map((file: any) => ({
        id: file.id,
        file_name: file.file_name,
        sign_count: file.sign_count,
        processed_at: file.processed_at,
        uploaded_to_bidx: file.uploaded_to_bidx,
        detection_status: file.detection_status,
        file_url: supabase.storage.from('pdfs').getPublicUrl(file.file_path).data.publicUrl,
      })) || []

      setRecentFiles(filesWithUrls)
    } catch (err) {
      console.error("Failed to fetch recent files:", err)
      setError("Failed to load recent files. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this file? This will also remove it from storage.')) return

    try {
      const { data: file } = await supabase.from('recent_files').select('file_path').eq('id', id).single()
      if (file?.file_path) {
        await supabase.storage.from('pdfs').remove([file.file_path])
      }
      await supabase.from('recent_files').delete().eq('id', id)
    } catch (err) {
      console.error("Failed to delete file:", err)
    }
  }

  const handleEdit = (file: RecentFile, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingFile(file)
    setEditedFileName(file.file_name)
  }

  const handleSaveEdit = async () => {
    if (!editingFile || !editedFileName.trim()) return
    try {
      await supabase
        .from('recent_files')
        .update({ file_name: editedFileName.trim() })
        .eq('id', editingFile.id)
      setEditingFile(null)
      setEditedFileName("")
    } catch (err) {
      console.error("Failed to save edit:", err)
    }
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
    if (file.detection_status === "not-started") {
      return (
        <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
          Detection not started
        </Badge>
      )
    }
    if (file.detection_status === "unsuccessful") {
      return (
        <Badge variant="outline" className="border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
          Detection unsuccessful
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400">
        {file.sign_count} sign{file.sign_count !== 1 ? "s" : ""} detected
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
          pdfFileName: file.file_name,
          signs: [], // In real implementation, this would contain the actual sign data
        }),
      })
      if (response.ok) {
        await supabase
          .from('recent_files')
          .update({ uploaded_to_bidx: true })
          .eq('id', file.id)
      } else {
        console.error("Failed to upload to BidX")
      }
    } catch (error) {
      console.error("Error uploading to BidX:", error)
    } finally {
      setUploadingFileId(null)
    }
  }

  if (loading) {
    return <div className="text-center text-sm text-muted-foreground">Loading recent files...</div>
  }

  if (error) {
    return <div className="text-center text-sm text-destructive">{error}</div>
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
                    onClick={() => onFileSelect(file.file_url, file.file_name)}
                  >
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-primary" />
                        <span className="truncate text-sm font-medium text-foreground">{file.file_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex">{getDetectionBadge(file)}</div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex">
                        {file.uploaded_to_bidx ? (
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
                      <span className="text-xs text-muted-foreground">{formatDate(file.processed_at)}</span>
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
                          {file.detection_status === "successful" && !file.uploaded_to_bidx && (
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

// Uploads file to Supabase storage and creates/updates DB entry
export async function uploadToSupabase(file: File, signCount: number = 0, detectionStatus: "not-started" | "successful" | "unsuccessful" = "not-started") {
  try {
    // Unique path
    const filePath = `${Date.now()}-${file.name}`

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('pdfs')
      .upload(filePath, file, { upsert: true })

    if (uploadError) throw uploadError

    // Check if exists by file_name
    const { data: existing } = await supabase
      .from('recent_files')
      .select('id')
      .eq('file_name', file.name)
      .single()

    if (existing) {
      // Update
      await supabase
        .from('recent_files')
        .update({
          sign_count: signCount,
          processed_at: new Date().toISOString(),
          detection_status: detectionStatus,
          file_path: filePath,
        })
        .eq('id', existing.id)
    } else {
      // Insert
      const { data, error } = await supabase.from('recent_files').insert({
        file_name: file.name,
        sign_count: signCount,
        processed_at: new Date().toISOString(),
        detection_status: detectionStatus,
        file_path: filePath,
      }).select().single()

      if (error) throw error
      return data.id  // Return ID for later updates
    }
  } catch (error) {
    console.error("Failed to upload to Supabase:", error)
  }
}

// Updates existing file in DB with new sign count/status
export async function updateRecentFile(fileName: string, signCount: number) {
  try {
    const detectionStatus = signCount > 0 ? "successful" : "unsuccessful"
    await supabase
      .from('recent_files')
      .update({
        sign_count: signCount,
        processed_at: new Date().toISOString(),
        detection_status: detectionStatus,
      })
      .eq('file_name', fileName)
  } catch (error) {
    console.error("Failed to update recent file:", error)
  }
}
