"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Check, X } from "lucide-react"

interface CropBoxProps {
  containerRef: React.RefObject<HTMLDivElement>
  canvasRef: React.RefObject<HTMLCanvasElement>
  onCropComplete: (area: { x: number; y: number; width: number; height: number }) => void
  onCancel: () => void
}

export function CropBox({ containerRef, canvasRef, onCropComplete, onCancel }: CropBoxProps) {
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 })
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      setStartPos({ x, y })
      setCurrentPos({ x, y })
      setIsDrawing(true)
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDrawing) return
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      setCurrentPos({ x, y })
    }

    const handleMouseUp = () => {
      if (isDrawing) {
        setIsDrawing(false)
      }
    }

    canvas.addEventListener("mousedown", handleMouseDown)
    canvas.addEventListener("mousemove", handleMouseMove)
    canvas.addEventListener("mouseup", handleMouseUp)

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown)
      canvas.removeEventListener("mousemove", handleMouseMove)
      canvas.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDrawing, canvasRef])

  const getCropArea = () => {
    const x = Math.min(startPos.x, currentPos.x)
    const y = Math.min(startPos.y, currentPos.y)
    const width = Math.abs(currentPos.x - startPos.x)
    const height = Math.abs(currentPos.y - startPos.y)
    return { x, y, width, height }
  }

  const handleConfirm = () => {
    const area = getCropArea()
    if (area.width > 10 && area.height > 10) {
      onCropComplete(area)
    }
  }

  const cropArea = getCropArea()
  const showCropBox = cropArea.width > 0 && cropArea.height > 0

  return (
    <>
      {/* Overlay */}
      <div
        ref={overlayRef}
        className="pointer-events-none absolute inset-0"
        style={{
          background: showCropBox
            ? `
              linear-gradient(to right, rgba(0,0,0,0.3) ${cropArea.x}px, transparent ${cropArea.x}px, transparent ${cropArea.x + cropArea.width}px, rgba(0,0,0,0.3) ${cropArea.x + cropArea.width}px),
              linear-gradient(to bottom, rgba(0,0,0,0.3) ${cropArea.y}px, transparent ${cropArea.y}px, transparent ${cropArea.y + cropArea.height}px, rgba(0,0,0,0.3) ${cropArea.y + cropArea.height}px)
            `
            : "rgba(0,0,0,0.1)",
        }}
      />

      {/* Crop Box */}
      {showCropBox && (
        <div
          className="pointer-events-none absolute border-2 border-secondary shadow-lg"
          style={{
            left: `${cropArea.x}px`,
            top: `${cropArea.y}px`,
            width: `${cropArea.width}px`,
            height: `${cropArea.height}px`,
          }}
        >
          <div className="absolute -right-px -top-px h-2 w-2 border-2 border-secondary bg-secondary-foreground" />
          <div className="absolute -bottom-px -right-px h-2 w-2 border-2 border-secondary bg-secondary-foreground" />
          <div className="absolute -bottom-px -left-px h-2 w-2 border-2 border-secondary bg-secondary-foreground" />
          <div className="absolute -left-px -top-px h-2 w-2 border-2 border-secondary bg-secondary-foreground" />
        </div>
      )}

      {/* Action Buttons */}
      {showCropBox && !isDrawing && (
        <div className="pointer-events-auto absolute right-4 top-4 flex gap-2">
          <Button size="sm" variant="default" onClick={handleConfirm} className="shadow-lg">
            <Check className="mr-2 h-4 w-4" />
            Detect Signs
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel} className="shadow-lg bg-transparent">
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        </div>
      )}
    </>
  )
}
