"use client"

import { useEffect, useRef } from "react"

export function Web3Background() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let particles: Array<{
      x: number
      y: number
      vx: number
      vy: number
      radius: number
      opacity: number
    }> = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    const createParticles = () => {
      particles = []
      const particleCount = Math.min(100, Math.floor((canvas.width * canvas.height) / 15000))
      
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          radius: Math.random() * 1.4 + 0.6,
          opacity: Math.random() * 0.5 + 0.2,
        })
      }
    }

    const drawGradientBackground = () => {
      // Deep navy ground with the landing's two corner glows: data-cyan bottom-left, catalyst top-right.
      const w = canvas.width
      const h = canvas.height
      ctx.fillStyle = "#05070d"
      ctx.fillRect(0, 0, w, h)
      const r = Math.max(w, h)
      const cool = ctx.createRadialGradient(0, h, 0, 0, h, r * 0.6)
      cool.addColorStop(0, "rgba(56, 225, 255, 0.13)")
      cool.addColorStop(1, "rgba(56, 225, 255, 0)")
      ctx.fillStyle = cool
      ctx.fillRect(0, 0, w, h)
      const warm = ctx.createRadialGradient(w, 0, 0, w, 0, r * 0.5)
      warm.addColorStop(0, "rgba(255, 106, 43, 0.08)")
      warm.addColorStop(1, "rgba(255, 106, 43, 0)")
      ctx.fillStyle = warm
      ctx.fillRect(0, 0, w, h)
    }

    const drawParticles = () => {
      particles.forEach((particle) => {
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(56, 225, 255, ${particle.opacity * 0.8})`
        ctx.fill()
      })
    }

    const drawConnections = () => {
      const maxDistance = 150
      
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const distance = Math.sqrt(dx * dx + dy * dy)
          
          if (distance < maxDistance) {
            const opacity = (1 - distance / maxDistance) * 0.12
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(91, 124, 255, ${opacity})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }
    }

    const updateParticles = () => {
      particles.forEach((particle) => {
        particle.x += particle.vx
        particle.y += particle.vy
        
        // Bounce off edges
        if (particle.x < 0 || particle.x > canvas.width) {
          particle.vx *= -1
        }
        if (particle.y < 0 || particle.y > canvas.height) {
          particle.vy *= -1
        }
        
        // Keep particles within bounds
        particle.x = Math.max(0, Math.min(canvas.width, particle.x))
        particle.y = Math.max(0, Math.min(canvas.height, particle.y))
      })
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const draw = () => {
      drawGradientBackground()
      drawConnections()
      drawParticles()
    }

    const animate = () => {
      if (document.visibilityState === "visible") {
        draw()
        updateParticles()
      }
      animationFrameId = requestAnimationFrame(animate)
    }

    resize()
    createParticles()
    // Reduced motion: one still frame instead of drifting particles.
    if (reduced) draw()
    else animate()

    const handleResize = () => {
      resize()
      createParticles()
      if (reduced) draw()
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10"
      style={{ background: '#05070d' }}
    />
  )
}
