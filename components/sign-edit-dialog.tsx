"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Sign {
  id: string
  mutcdCode: string
  dimensions: string
  count: number
  type: "primary" | "secondary"
  parentId?: string
}

interface SignEditDialogProps {
  sign: Sign
  isOpen: boolean
  onClose: () => void
  onSave: (sign: Sign) => void
  isNew?: boolean
}

export function SignEditDialog({ sign, isOpen, onClose, onSave, isNew = false }: SignEditDialogProps) {
  const [editedSign, setEditedSign] = useState<Sign>(sign)

  const handleSave = () => {
    onSave(editedSign)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isNew ? "Add New Sign" : "Edit Sign"}</DialogTitle>
          <DialogDescription>
            {isNew ? "Add a new sign to the list" : "Make changes to the sign details"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="mutcdCode">MUTCD Code</Label>
            <Input
              id="mutcdCode"
              value={editedSign.mutcdCode}
              onChange={(e) => setEditedSign({ ...editedSign, mutcdCode: e.target.value })}
              placeholder="e.g., R1-1"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dimensions">Dimensions</Label>
            <Input
              id="dimensions"
              value={editedSign.dimensions}
              onChange={(e) => setEditedSign({ ...editedSign, dimensions: e.target.value })}
              placeholder="e.g., 30x30"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="count">Count</Label>
            <Input
              id="count"
              type="number"
              min="1"
              value={editedSign.count}
              onChange={(e) => setEditedSign({ ...editedSign, count: Number.parseInt(e.target.value) || 1 })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="type">Sign Type</Label>
            <Select
              value={editedSign.type}
              onValueChange={(value: "primary" | "secondary") => setEditedSign({ ...editedSign, type: value })}
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="primary">Primary</SelectItem>
                <SelectItem value="secondary">Secondary</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>{isNew ? "Add Sign" : "Save Changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
