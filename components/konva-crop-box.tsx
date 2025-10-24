"use client"
import React, { useEffect, useRef, useState, useImperativeHandle } from "react"  // Added useImperativeHandle here
import { Button } from "@/components/ui/button"
import { Check, X } from "lucide-react"

interface KonvaCropBoxProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  onCropComplete: (area: { x: number; y: number; width: number; height: number }) => void
  onCancel: () => void
}

const KonvaCropBox = React.forwardRef<{ getCropArea: () => { x: number; y: number; width: number; height: number } | null }, KonvaCropBoxProps>(({ canvasRef, onCropComplete, onCancel }, ref) => {
  const stageContainerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<any>(null)
  const rectRef = useRef<any>(null)
  const trRef = useRef<any>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [startX, setStartX] = useState(0)
  const [startY, setStartY] = useState(0)
  const [konvaLoaded, setKonvaLoaded] = useState(false)

  useImperativeHandle(ref, () => ({
    getCropArea: () => {
      if (rectRef.current) {
        return {
          x: rectRef.current.x(),
          y: rectRef.current.y(),
          width: rectRef.current.width(),
          height: rectRef.current.height(),
        }
      }
      return null
    },
  }))

  useEffect(() => {
    if (typeof window === "undefined") return
    import("konva").then((KonvaModule) => {
      setKonvaLoaded(true)
      const Konva = KonvaModule.default
      const canvas = canvasRef.current
      if (!canvas || !stageContainerRef.current) return
      const width = canvas.offsetWidth
      const height = canvas.offsetHeight
      const stage = new Konva.Stage({
        container: stageContainerRef.current,
        width,
        height,
      })
      const layer = new Konva.Layer()
      stage.add(layer)
      const transformer = new Konva.Transformer({
        keepRatio: false,
        enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
        rotateEnabled: false,
        borderStroke: '#3b82f6',
        borderStrokeWidth: 2,
        anchorFill: '#3b82f6',
        anchorStroke: '#ffffff',
        anchorSize: 12,
        anchorCornerRadius: 6,
        boundBoxFunc: (oldBox, newBox) => {
          if (newBox.width < 50 || newBox.height < 50) return oldBox
          if (newBox.x < 0 || newBox.y < 0 || newBox.x + newBox.width > width || newBox.y + newBox.height > height) return oldBox
          return newBox
        },
      })
      layer.add(transformer)
      trRef.current = transformer
      stage.on('mousedown', (e) => {
        if (rectRef.current) return  // Already drawing
        const pos = stage.getPointerPosition()
        setStartX(pos.x)
        setStartY(pos.y)
        const rect = new Konva.Rect({
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
          fill: 'rgba(59, 130, 246, 0.2)',
          stroke: '#3b82f6',
          strokeWidth: 3,
          draggable: true,
          shadowColor: '#3b82f6',
          shadowBlur: 10,
          shadowOpacity: 0.6,
        })
        layer.add(rect)
        rectRef.current = rect
        setIsDrawing(true)
        layer.draw()
      })
      stage.on('mousemove', () => {
        if (!isDrawing || !rectRef.current) return
        const pos = stage.getPointerPosition()
        rectRef.current.width(Math.max(0, pos.x - startX))
        rectRef.current.height(Math.max(0, pos.y - startY))
        layer.draw()
      })
      stage.on('mouseup', () => {
        if (!isDrawing) return
        setIsDrawing(false)
        if (rectRef.current.width() < 50 || rectRef.current.height() < 50) {
          rectRef.current.destroy()
          rectRef.current = null
        } else {
          trRef.current.nodes([rectRef.current])
        }
        layer.draw()
      })
      rectRef.current?.on('transformend dragend', () => {
        layer.draw()
      })
      stageRef.current = stage
    })
    return () => {
      if (stageRef.current) {
        stageRef.current.destroy()
      }
    }
  }, [canvasRef])

  return (
    <>
      <div ref={stageContainerRef} className="absolute inset-0 z-10" style={{ cursor: rectRef.current ? 'move' : 'crosshair' }} />
    </>
  )
})

KonvaCropBox.displayName = "KonvaCropBox"

export { KonvaCropBox }
