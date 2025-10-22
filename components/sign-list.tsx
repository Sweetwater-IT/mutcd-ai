"use client"
import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Trash2, Edit2, Check, X, Download, Upload, Loader2 } from "lucide-react"
import type { DetectedSign } from "@/lib/opencv-detector"
import { toast } from "sonner"  // Change to this (remove use-toast import)

interface SignListProps {
  signs: DetectedSign[]
  onSignsUpdate: (signs: DetectedSign[]) => void
  pdfFileName?: string
}
export function SignList({ signs, onSignsUpdate, pdfFileName }: SignListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  // Remove: const { toast } = useToast()

  const handleEdit = (sign: DetectedSign) => {
    setEditingId(sign.id)
    setEditValue(sign.type)
  }
  const handleSaveEdit = (id: string) => {
    const updatedSigns = signs.map((sign) => (sign.id === id ? { ...sign, type: editValue } : sign))
    onSignsUpdate(updatedSigns)
    setEditingId(null)
    setEditValue("")
  }
  const handleCancelEdit = () => {
    setEditingId(null)
    setEditValue("")
  }
  const handleDelete = (id: string) => {
    const updatedSigns = signs.filter((sign) => sign.id !== id)
    onSignsUpdate(updatedSigns)
  }
  const handleExport = () => {
    const exportData = signs.map((sign) => ({
      type: sign.type,
      confidence: `${Math.round(sign.confidence * 100)}%`,
      location: `(${sign.boundingBox.x}, ${sign.boundingBox.y})`,
      size: `${sign.boundingBox.width}x${sign.boundingBox.height}`,
    }))
    const csv = [
      ["Sign Type", "Confidence", "Location", "Size"],
      ...exportData.map((row) => [row.type, row.confidence, row.location, row.size]),
    ]
      .map((row) => row.join(","))
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `mutcd-signs-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  const handleUploadToBidX = async () => {
    setIsUploading(true)
    try {
      const payload = {
        pdfFileName: pdfFileName || "Unknown PDF",
        uploadDate: new Date().toISOString(),
        signs: signs.map((sign) => ({
          mutcdCode: sign.type,
          dimensions: `${Math.round(sign.boundingBox.width)}x${Math.round(sign.boundingBox.height)}`,
          count: 1,
          confidence: Math.round(sign.confidence * 100),
          isPrimary: true, // Can be enhanced to detect primary/secondary
          location: {
            x: Math.round(sign.boundingBox.x),
            y: Math.round(sign.boundingBox.y),
          },
        })),
        totalSigns: signs.length,
      }
      const response = await fetch("/api/upload-to-bidx", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        throw new Error("Failed to upload to BidX")
      }
      const result = await response.json()
      toast.success("Upload Successful", {  // Change to this
        description: `Successfully uploaded ${signs.length} signs to BidX`,
      })
    } catch (error) {
      console.error("[v0] BidX upload error:", error)
      toast.error("Upload Failed", {  // Change to this
        description: error instanceof Error ? error.message : "Failed to upload to BidX. Please try again.",
      })
    } finally {
      setIsUploading(false)
    }
  }
  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Detected Signs</h2>
          <p className="text-sm text-muted-foreground">{signs.length} signs found</p>
        </div>
        {signs.length > 0 && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button size="sm" onClick={handleUploadToBidX} disabled={isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload to BidX
                </>
              )}
            </Button>
          </div>
        )}
      </div>
      <ScrollArea className="flex-1">
        {signs.length === 0 ? (
          <div className="flex h-full min-h-[300px] items-center justify-center p-8">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="mb-2 text-sm font-medium text-foreground">No signs detected yet</h3>
              <p className="text-sm text-muted-foreground">Draw a crop box on the PDF to detect signs</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 p-4">
            {signs.map((sign) => (
              <Card key={sign.id} className="overflow-hidden">
                <div className="flex gap-3 p-3">
                  {/* Sign Thumbnail */}
                  <div className="flex-shrink-0">
                    <img
                      src={sign.imageData || "/placeholder.svg"}
                      alt={sign.type}
                      className="h-16 w-16 rounded border border-border object-cover"
                    />
                  </div>
                  {/* Sign Details */}
                  <div className="flex-1 space-y-2">
                    {editingId === sign.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="h-8 text-sm"
                          placeholder="Sign type"
                        />
                        <Button size="sm" variant="ghost" onClick={() => handleSaveEdit(sign.id)}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-sm font-medium text-foreground">{sign.type}</h3>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {Math.round(sign.confidence * 100)}% confidence
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(sign)}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(sign.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Position: ({Math.round(sign.boundingBox.x)}, {Math.round(sign.boundingBox.y)}) • Size:{" "}
                      {Math.round(sign.boundingBox.width)}×{Math.round(sign.boundingBox.height)}px
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </Card>
  )
}
