"use client"
import type React from "react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Check, X } from "lucide-react"

// Update interface to allow null for ref.current
interface KonvaCropBoxProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  onCropComplete: (area: { x: number; y: number; width: number; height: number }) => void
  onCancel: () => void
}

export function KonvaCropBox({ canvasRef, onCropComplete, onCancel }: KonvaCropBoxProps) {
  const stageContainerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<any>(null)
  const isInitializedRef = useRef(false)
  const [cropRect, setCropRect] = useState({ x: 100, y: 100, width: 200, height: 200 })
  const [konvaLoaded, setKonvaLoaded] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    import("konva").then((KonvaModule) => {
      setKonvaLoaded(true)
      if (isInitializedRef.current || !canvasRef.current || !stageContainerRef.current) return

      const Konva = KonvaModule.default
      const canvas = canvasRef.current
      const width = canvas.offsetWidth
      const height = canvas.offsetHeight
      console.log("[v0] Initializing Konva crop box:", { width, height })

      isInitializedRef.current = true
      const stage = new Konva.Stage({
        container: stageContainerRef.current,
        width: width,
        height: height,
      })
      const layer = new Konva.Layer()
      stage.add(layer)

      const overlay = new Konva.Rect({
        x: 0,
        y: 0,
        width: width,
        height: height,
        fill: "rgba(0, 0, 0, 0.5)",
        listening: false,
      })
      layer.add(overlay)

      const rect = new Konva.Rect({
        x: Math.min(100, width - 250),
        y: Math.min(100, height - 250),
        width: 200,
        height: 200,
        fill: "rgba(59, 130, 246, 0.2)",
        stroke: "#3b82f6",
        strokeWidth: 3,
        draggable: true,
        shadowColor: "#3b82f6",
        shadowBlur: 10,
        shadowOpacity: 0.6,
      })

      const transformer = new Konva.Transformer({
        nodes: [rect],
        keepRatio: false,
        enabledAnchors: ["top-left", "top-right", "bottom-left", "bottom-right"],
        rotateEnabled: false,
        borderStroke: "#3b82f6",
        borderStrokeWidth: 2,
        anchorFill: "#3b82f6",
        anchorStroke: "#ffffff",
        anchorSize: 12,
        anchorCornerRadius: 6,
        boundBoxFunc: (oldBox, newBox) => {
          if (newBox.width < 50 || newBox.height < 50) {
            return oldBox
          }
          if (newBox.x < 0 || newBox.y < 0 || newBox.x + newBox.width > width || newBox.y + newBox.height > height) {
            return oldBox
          }
          return newBox
        },
      })

      layer.add(rect)
      layer.add(transformer)

      rect.on("dragend transformend", () => {
        const newRect = {
          x: rect.x(),
          y: rect.y(),
          width: rect.width() * rect.scaleX(),
          height: rect.height() * rect.scaleY(),
        }
        setCropRect(newRect)
        rect.scaleX(1)
        rect.scaleY(1)
        console.log("[v0] Crop rect updated:", newRect)
      })

      layer.draw()
      stageRef.current = stage
    })

    return () => {
      console.log("[v0] Cleaning up Konva stage")
      if (stageRef.current) {
        stageRef.current.destroy()
        stageRef.current = null
      }
      isInitializedRef.current = false
    }
  }, [canvasRef])

  const handleConfirm = () => {
    const canvas = canvasRef.current
    if (!canvas) {
      console.warn("[v0] Canvas not available for crop confirmation")
      return
    }
    const scaleX = canvas.width / canvas.offsetWidth
    const scaleY = canvas.height / canvas.offsetHeight
    const area = {
      x: Math.round(cropRect.x * scaleX),
      y: Math.round(cropRect.y * scaleY),
      width: Math.round(cropRect.width * scaleX),
      height: Math.round(cropRect.height * scaleY),
    }
    console.log("[v0] Crop area confirmed:", area)
    if (area.width > 10 && area.height > 10) {
      onCropComplete(area)
    }
  }

  return (
    <>
      <div ref={stageContainerRef} className="absolute inset-0 z-10" style={{ cursor: "crosshair" }} />
      <div className="absolute right-4 top-4 z-20 flex gap-2">
        <Button size="sm" variant="default" onClick={handleConfirm} className="shadow-lg">
          <Check className="mr-2 h-4 w-4" />
          Detect Signs
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} className="bg-background shadow-lg">
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
      </div>
    </>
  )
}
