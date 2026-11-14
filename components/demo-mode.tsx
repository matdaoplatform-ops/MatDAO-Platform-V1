"use client"

import { useState, useEffect } from "react"
import { Play, Pause, Settings, Sparkles } from "lucide-react"

interface DemoModeContext {
  isEnabled: boolean
  autoApprove: boolean
  instantInvestment: boolean
  toggleDemoMode: () => void
  toggleAutoApprove: () => void
  toggleInstantInvestment: () => void
}

export function useDemoMode(): DemoModeContext {
  const [isEnabled, setIsEnabled] = useState(false)
  const [autoApprove, setAutoApprove] = useState(true)
  const [instantInvestment, setInstantInvestment] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('demoMode')
    if (saved) {
      const settings = JSON.parse(saved)
      setIsEnabled(settings.enabled || false)
      setAutoApprove(settings.autoApprove !== false)
      setInstantInvestment(settings.instantInvestment !== false)
    }
  }, [])

  const toggleDemoMode = () => {
    const newState = !isEnabled
    setIsEnabled(newState)
    localStorage.setItem('demoMode', JSON.stringify({
      enabled: newState,
      autoApprove,
      instantInvestment
    }))
  }

  const toggleAutoApprove = () => {
    const newState = !autoApprove
    setAutoApprove(newState)
    localStorage.setItem('demoMode', JSON.stringify({
      enabled: isEnabled,
      autoApprove: newState,
      instantInvestment
    }))
  }

  const toggleInstantInvestment = () => {
    const newState = !instantInvestment
    setInstantInvestment(newState)
    localStorage.setItem('demoMode', JSON.stringify({
      enabled: isEnabled,
      autoApprove,
      instantInvestment: newState
    }))
  }

  return {
    isEnabled,
    autoApprove,
    instantInvestment,
    toggleDemoMode,
    toggleAutoApprove,
    toggleInstantInvestment
  }
}

export function DemoModeToggle() {
  const { isEnabled, autoApprove, instantInvestment, toggleDemoMode, toggleAutoApprove, toggleInstantInvestment } = useDemoMode()
  const [showSettings, setShowSettings] = useState(false)

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="flex flex-col items-end gap-2">
        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-2 rounded-2xl border border-white/10 bg-[#0b1020]/95 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl">
            <h4 className="app-mono mb-3 text-[11px] text-[#8a93a6]">Demo settings</h4>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoApprove}
                  onChange={toggleAutoApprove}
                  className="h-4 w-4 accent-[#38e1ff]"
                />
                <span className="text-xs text-[#edeff5]">Auto-approve submissions</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={instantInvestment}
                  onChange={toggleInstantInvestment}
                  className="h-4 w-4 accent-[#38e1ff]"
                />
                <span className="text-xs text-[#edeff5]">Instant investment (no wallet)</span>
              </label>
            </div>
          </div>
        )}

        {/* Main Toggle Button */}
        <button
          onClick={toggleDemoMode}
          className={`flex items-center gap-2 rounded-full border px-4 py-2 backdrop-blur-xl transition-all ${
            isEnabled
              ? 'border-[#38e1ff]/50 bg-[#38e1ff]/15 text-[#bff6ff] hover:bg-[#38e1ff]/25'
              : 'border-white/10 bg-[#0b1020]/80 text-[#c9cedb] hover:border-white/25 hover:text-white'
          }`}
        >
          {isEnabled ? (
            <>
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium">Demo Mode ON</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              <span className="text-sm font-medium">Demo Mode</span>
            </>
          )}
        </button>

        {/* Settings Toggle */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          aria-label="Demo settings"
          className={`rounded-full border p-2 backdrop-blur-xl transition-all ${
            showSettings
              ? 'border-[#38e1ff]/50 bg-[#38e1ff]/15 text-[#bff6ff]'
              : 'border-white/10 bg-[#0b1020]/80 text-[#c9cedb] hover:border-white/25 hover:text-white'
          }`}
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
