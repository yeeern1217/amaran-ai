"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useApp } from "@/lib/app-context"
import { generateVideoAssets } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Clapperboard,
  Film,
  Loader2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Play,
  Pause,
  MonitorPlay,
  ChevronLeft,
  ChevronRight,
  Volume2,
} from "lucide-react"

export function PageProduction() {
  const {
    sessionId,
    scenes,
    config,
    visualAudioState,
    setVisualAudioState,
    visualAudioStatus,
    setVisualAudioStatus,
    setCurrentStep,
  } = useApp()

  const [error, setError] = useState<string | null>(null)
  const [activeClip, setActiveClip] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hasAutoStarted = useRef(false)

  const clips = visualAudioState?.veo_clips ?? []
  const totalDuration = scenes.reduce((sum, s) => sum + (s.duration || 8), 0)

  const langMap: Record<string, string> = {
    english: "en",
    malay: "bm",
    mandarin: "zh",
    chinese: "zh",
    tamil: "ta",
  }
  const languageCode = langMap[config.language] || "en"

  const runFullPipeline = useCallback(async () => {
    if (!sessionId) return
    setVisualAudioStatus("running")
    setError(null)
    try {
      const result = await generateVideoAssets(sessionId, languageCode)
      if (result.visual_audio_state) {
        setVisualAudioState(result.visual_audio_state)
        const generatedClips = result.visual_audio_state.veo_clips ?? []
        if (generatedClips.length > 0) {
          setVisualAudioStatus("completed")
        } else {
          setError("Veo video clip generation returned no clips. You can retry or proceed.")
          setVisualAudioStatus("error")
        }
      } else {
        setError("No pipeline state returned from backend.")
        setVisualAudioStatus("error")
      }
    } catch (err) {
      console.error("Video assets generation error:", err)
      setError(err instanceof Error ? err.message : "Failed to generate video assets")
      setVisualAudioStatus("error")
    }
  }, [sessionId, languageCode, setVisualAudioState, setVisualAudioStatus])

  useEffect(() => {
    if (sessionId && visualAudioStatus === "idle" && !hasAutoStarted.current) {
      hasAutoStarted.current = true
      runFullPipeline()
    }
  }, [sessionId, visualAudioStatus, runFullPipeline])

  // Reset playback when switching clips
  useEffect(() => {
    setIsPlaying(false)
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }, [activeClip])

  function handlePlayPause() {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  function handleClipEnd() {
    setIsPlaying(false)
    if (activeClip < clips.length - 1) setActiveClip(activeClip + 1)
  }

  function getClipSrc(clipIndex: number): string | null {
    const clip = clips[clipIndex]
    if (!clip) return null
    if (clip.video_base64) return clip.video_base64
    if (clip.video_uri) return clip.video_uri
    if (clip.video_path?.startsWith("/")) return clip.video_path
    return null
  }

  function getSceneForClip(clipIndex: number) {
    const clip = clips[clipIndex]
    if (!clip) return scenes[clipIndex] ?? null
    const segIdx = clip.segment_index ?? clip.segment_id
    const matched = scenes.find((s) => s.id === segIdx)
    return matched ?? scenes[clipIndex] ?? null
  }

  const isRunning = visualAudioStatus === "running"
  const isCompleted = visualAudioStatus === "completed"
  const isError = visualAudioStatus === "error"

  const currentScene = getSceneForClip(activeClip)
  const currentClipSrc = getClipSrc(activeClip)

  // No session
  if (!sessionId) {
    return (
      <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full items-center">
        <div className="flex flex-col gap-2 text-center mt-8">
          <Clapperboard className="size-12 text-teal-400 mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">No Session Available</h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Complete the earlier steps first to generate video assets.
          </p>
          <Button onClick={() => setCurrentStep(0)} className="mt-4 mx-auto" size="lg">
            <ArrowLeft className="size-4" />
            Back to Briefing
          </Button>
        </div>
      </div>
    )
  }

  // Loading / generating state (no clips yet)
  if (isRunning && clips.length === 0) {
    return (
      <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="size-20 rounded-full flex items-center justify-center bg-purple-500/20 animate-pulse">
            <Loader2 className="size-10 text-purple-500 animate-spin" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Generating Video Clips...</h2>
          <p className="text-muted-foreground text-sm text-center max-w-md">
            Building visual assets and rendering Veo clips from your approved script. This may take a few minutes.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-foreground text-balance tracking-tight">The Production</h1>
        <p className="text-muted-foreground text-sm">
          Review each generated video clip. Proceed to Clips Review when you&apos;re ready.
        </p>
      </div>

      {/* Clips viewer — only shown when clips exist */}
      {clips.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Video Player */}
          <div className="flex flex-col gap-4">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                    <MonitorPlay className="size-4 text-teal-400" />
                    Clip {activeClip + 1} of {clips.length}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-muted-foreground border-border text-xs">
                      {currentScene?.duration || 8}s
                    </Badge>
                    <Badge variant="outline" className="text-teal-400 border-teal-500/30 bg-teal-500/10 text-xs">
                      Total: {totalDuration}s
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {/* Video */}
                <div className="relative rounded-xl border border-border/40 overflow-hidden aspect-video bg-black w-full group">
                  {currentClipSrc ? (
                    <video
                      ref={videoRef}
                      key={currentClipSrc}
                      src={currentClipSrc}
                      className="w-full h-full object-contain"
                      preload="auto"
                      onEnded={handleClipEnd}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="flex flex-col items-center gap-3 text-center p-6">
                        <Film className="size-10 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">
                          Clip saved to disk — not available for browser playback
                        </p>
                      </div>
                    </div>
                  )}
                  {currentClipSrc && (
                    <button
                      onClick={handlePlayPause}
                      className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors group"
                    >
                      {!isPlaying && (
                        <div className="size-16 rounded-full bg-teal-500/20 backdrop-blur-sm flex items-center justify-center shadow-[0_0_20px_oklch(0.87_0.17_175/0.15)] opacity-80 group-hover:opacity-100 transition-opacity">
                          <Play className="size-8 text-teal-400 ml-1" />
                        </div>
                      )}
                    </button>
                  )}
                </div>

                {/* Playback controls */}
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={activeClip === 0}
                    onClick={() => setActiveClip(activeClip - 1)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ChevronLeft className="size-4" />
                    Previous
                  </Button>
                  {currentClipSrc && (
                    <Button variant="outline" size="sm" onClick={handlePlayPause} className="gap-2">
                      {isPlaying ? <><Pause className="size-4" />Pause</> : <><Play className="size-4" />Play</>}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={activeClip >= clips.length - 1}
                    onClick={() => setActiveClip(activeClip + 1)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Next
                    <ChevronRight className="size-4" />
                  </Button>
                </div>

                {/* Segmented Timeline Bar */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Film className="size-3" />
                    <span className="font-medium">Scene Timeline</span>
                  </div>
                  <div className="flex gap-1 w-full">
                    {clips.map((clip, i) => {
                      const scene = getSceneForClip(i)
                      const isActive = i === activeClip
                      const duration = scene?.duration || 8
                      return (
                        <button
                          key={clip.segment_id}
                          onClick={() => setActiveClip(i)}
                          className={cn(
                            "relative group/seg rounded-md transition-all duration-200 cursor-pointer min-w-[32px]",
                            "hover:ring-1 hover:ring-teal-400/40",
                            isActive
                              ? "ring-2 ring-teal-400 bg-teal-500/20"
                              : "bg-secondary/60 hover:bg-secondary"
                          )}
                          style={{ flex: duration }}
                          title={scene?.description ? `Scene ${i + 1}: ${scene.description.slice(0, 100)}...` : `Scene ${i + 1}`}
                        >
                          <div className="h-8 flex items-center justify-center">
                            <span className={cn("text-[10px] font-semibold truncate px-1", isActive ? "text-teal-400" : "text-muted-foreground")}>
                              {i + 1}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
                    <span>0:00</span>
                    <span>{Math.floor(totalDuration / 60)}:{(totalDuration % 60).toString().padStart(2, "0")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Scene List Panel */}
          <Card className="border-border bg-card lg:sticky lg:top-20 lg:self-start" style={{ maxHeight: "calc(100vh - 120px)" }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Film className="size-4 text-teal-400" />
                All Scenes
                <Badge variant="outline" className="text-muted-foreground border-border text-xs ml-auto">
                  {clips.length} clips
                </Badge>
              </CardTitle>
            </CardHeader>
            <div className="overflow-y-auto flex-1 px-6 pb-6" style={{ maxHeight: "calc(100vh - 220px)" }}>
              <div className="flex flex-col gap-3">
                {clips.map((clip, i) => {
                  const scene = getSceneForClip(i)
                  const isActive = i === activeClip
                  return (
                    <button
                      key={clip.segment_id}
                      onClick={() => setActiveClip(i)}
                      className={cn(
                        "w-full text-left rounded-lg border p-3 transition-all duration-200",
                        isActive
                          ? "border-teal-500/40 bg-teal-500/10 shadow-[0_0_12px_oklch(0.87_0.17_175/0.08)]"
                          : "border-border/40 bg-secondary/10 hover:bg-secondary/30 hover:border-border/60"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            isActive
                              ? "text-teal-400 border-teal-500/30 bg-teal-500/10"
                              : "text-muted-foreground border-border"
                          )}
                        >
                          {i + 1}
                        </Badge>
                        <Badge variant="outline" className="text-muted-foreground border-border text-xs">
                          {scene?.duration || 8}s
                        </Badge>
                        {isActive && <Volume2 className="size-3 text-teal-400 ml-auto animate-pulse" />}
                      </div>
                      <p className={cn("text-xs leading-relaxed", isActive ? "text-foreground" : "text-muted-foreground")}>
                        {scene?.description || "No description available"}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Error Message */}
      {isError && error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <XCircle className="size-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-foreground font-medium">Pipeline Error</p>
                <p className="text-xs text-muted-foreground mt-1">{error}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => { hasAutoStarted.current = false; setVisualAudioStatus("idle") }}>
                <RotateCcw className="size-3" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex gap-2 justify-between">
        <Button variant="outline" onClick={() => setCurrentStep(4)} size="sm">
          <ArrowLeft className="size-4" />
          Back to Preview
        </Button>
        <div className="flex gap-2">
          {(isCompleted || isError) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                hasAutoStarted.current = false
                setVisualAudioState(null)
                setVisualAudioStatus("idle")
              }}
            >
              <RotateCcw className="size-4" />
              Re-generate
            </Button>
          )}
          <Button
            onClick={() => setCurrentStep(6)}
            size="sm"
            disabled={!isCompleted}
          >
            Proceed to Clips Review
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
