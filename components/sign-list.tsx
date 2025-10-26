"use client"
import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Download, Upload, Loader2, MoreVertical, Pencil } from "lucide-react"
import { toast } from "sonner"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import type { MUTCDSign } from "@/lib/types/mutcd"  // Added /lib to match file location

interface SignListProps {
  signs: MUTCDSign[]
  onSignsUpdate: (signs: MUTCDSign[]) => void
  pdfFileName?: string
}

export function SignList({ signs, onSignsUpdate, pdfFileName }: SignListProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [editingSign, setEditingSign] = useState<MUTCDSign | null>(null)
  const [editForm, setEditForm] = useState({ code: "", size: "", description: "", quantity: "" })

  const handleOpenEdit = (sign: MUTCDSign) => {
    setEditingSign(sign)
    setEditForm({
      code: sign.code,
      size: sign.size,
      description: sign.description,
      quantity: sign.quantity,
    })
  }

  const handleSaveEdit = () => {
    if (!editingSign || !onSignsUpdate) return
    const updatedSigns = signs.map((sign) =>
      sign.id === editingSign.id
        ? {
            ...sign,
            code: editForm.code,
            size: editForm.size,
            description: editForm.description,
            quantity: editForm.quantity,
          }
        : sign,
    )
    onSignsUpdate(updatedSigns)
    setEditingSign(null)
    toast.success("Sign Updated", {
      description: "The sign entry has been updated successfully.",
    })
  }

  const handleExport = () => {
    const csv = [
      ["MUTCD Code", "Description", "Dimensions", "Quantity"],
      ...signs.map((sign) => [sign.code, sign.description, sign.size, sign.quantity || "0"]),
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
          mutcdCode: sign.code,
          dimensions: sign.size,
          count: Number.parseInt(sign.quantity) || 0,
          description: sign.description,
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
      toast.success("Upload Successful", {
        description: `Successfully uploaded ${signs.length} signs to BidX`,
      })
    } catch (error) {
      console.error("BidX upload error:", error)
      toast.error("Upload Failed", {
        description: error instanceof Error ? error.message : "Failed to upload to BidX. Please try again.",
      })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <>
      <Card className="flex h-full flex-col">
        <div className="border-b border-border px-4 py-3">
          <div className="mb-3">
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
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <h3 className="mb-2 text-sm font-medium text-foreground">No signs detected yet</h3>
                <p className="text-sm text-muted-foreground">Draw a crop box on the PDF to detect signs</p>
              </div>
            </div>
          ) : (
            <div className="p-4">
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Sign</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Dimensions</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Count</th>
                      <th className="w-12 px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-background">
                    {signs.map((sign) => (
                      <tr key={sign.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-semibold text-foreground">{sign.code}</span>
                            <span className="text-sm text-muted-foreground">{sign.description}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm text-muted-foreground">{sign.size}</td>
                        <td className="px-3 py-2 text-sm text-foreground">{sign.quantity || "-"}</td>
                        <td className="px-3 py-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenEdit(sign)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
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
        </ScrollArea>
      </Card>
      <Dialog open={!!editingSign} onOpenChange={(open) => !open && setEditingSign(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sign Entry</DialogTitle>
            <DialogDescription>Update the sign information if the OCR scan was incorrect.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">MUTCD Code</Label>
              <Input
                id="code"
                value={editForm.code}
                onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                placeholder="e.g., M3-1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="e.g., NORTH"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="size">Dimensions</Label>
              <Input
                id="size"
                value={editForm.size}
                onChange={(e) => setEditForm({ ...editForm, size: e.target.value })}
                placeholder='e.g., 24" X 12"'
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                value={editForm.quantity}
                onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                placeholder="e.g., 19"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSign(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
