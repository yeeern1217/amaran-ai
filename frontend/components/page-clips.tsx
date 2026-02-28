"use client"

import { useState, useRef, useEffect } from "react"
import { useApp } from "@/lib/app-context"
import { generateVideoAssets } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
  Film,
  Play,
  Pause,
  ArrowLeft,
  ArrowRight,
  MonitorPlay,
  ChevronLeft,
  ChevronRight,
  Volume2,
  Loader2,
  Video,
} from "lucide-react"

export function PageClips() {
  const {
    sessionId,
    scenes,
    config,
    visualAudioState,
    setVisualAudioState,
    setCurrentStep,
  } = useApp()
  const [activeClip, setActiveClip] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Video generation loading state
  const [isGenerating, setIsGenerating] = useState(false)
  const hasAutoStarted = useRef(false)

  const effectiveState = visualAudioState
  const clips = effectiveState?.veo_clips ?? []
  const totalDuration = scenes.reduce((sum, s) => sum + (s.duration || 8), 0)

  // Auto-start generation when entering the page
  useEffect(() => {
    if (!sessionId || hasAutoStarted.current || visualAudioState) return
    hasAutoStarted.current = true

    async function runGeneration() {
      setIsGenerating(true)

      // Determine language code
      const langMap: Record<string, string> = {
        english: "en",
        malay: "bm",
        chinese: "zh",
        tamil: "ta",
      }
      const languageCode = langMap[config.language] || "en"

      try {
        const result = await generateVideoAssets(sessionId!, languageCode)
        if (result.visual_audio_state) {
          setVisualAudioState(result.visual_audio_state)
        }
      } catch (err) {
        console.error("Video generation error:", err)
      } finally {
        setIsGenerating(false)
      }
    }

    runGeneration()
  }, [sessionId, visualAudioState, config.language, setVisualAudioState])

  // When switching clips, reset playback state
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
    // Auto-advance to next clip
    if (activeClip < clips.length - 1) {
      setActiveClip(activeClip + 1)
    }
  }

  // Get clip video source
  function getClipSrc(clipIndex: number): string | null {
    const clip = clips[clipIndex]
    if (!clip) return null
    if (clip.video_path?.startsWith("/")) return clip.video_path
    return null
  }

  // Map clip to scene description (clips are 1-indexed via segment_id, scenes are 0-indexed)
  function getSceneForClip(clipIndex: number) {
    const clip = clips[clipIndex]
    if (!clip) return scenes[clipIndex] ?? null
    // Match by segment_id to scene_id
    const matched = scenes.find((s) => s.id === clip.segment_id)
    return matched ?? scenes[clipIndex] ?? null
  }

  const currentScene = getSceneForClip(activeClip)
  const currentClipSrc = getClipSrc(activeClip)

  // Render generation loading screen
  if (isGenerating) {
    return (
      <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="size-20 rounded-full flex items-center justify-center bg-teal-500/20 animate-pulse">
              <Video className="size-10 text-teal-400" />
            </div>
            <div className="absolute inset-0 rounded-full pulse-ring" />
          </div>
          <h2 className="text-xl font-semibold text-foreground tracking-tight">
            Generating Video...
          </h2>
          <p className="text-muted-foreground text-sm text-center max-w-md">
            AI is generating video clips from your scenes. This may take a moment.
          </p>
        </div>
      </div>
    )
  }

  // If no clips available, show placeholder
  if (clips.length === 0) {
    return (
      <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Film className="size-10 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground">No Video Clips Available</h2>
          <p className="text-muted-foreground text-sm text-center max-w-md">
            Video clips have not been generated yet. Complete the Production step first.
          </p>
          <Button variant="outline" onClick={() => setCurrentStep(4)} size="sm">
            <ArrowLeft className="size-4" />
            Back to Preview
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-foreground text-balance tracking-tight">
          Clips Review
        </h1>
        <p className="text-muted-foreground text-sm">
          Review each generated video clip before the final stitched video. Click on a segment to preview it.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Video Player + Segmented Bar */}
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

                {/* Play/Pause overlay */}
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePlayPause}
                    className="gap-2"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="size-4" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="size-4" />
                        Play
                      </>
                    )}
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
                          <span
                            className={cn(
                              "text-[10px] font-semibold truncate px-1",
                              isActive ? "text-teal-400" : "text-muted-foreground"
                            )}
                          >
                            {i + 1}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Time markers */}
                <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
                  <span>0:00</span>
                  <span>{Math.floor(totalDuration / 60)}:{(totalDuration % 60).toString().padStart(2, "0")}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Scene List Panel — scrollable */}
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
                        {isActive && (
                          <Volume2 className="size-3 text-teal-400 ml-auto animate-pulse" />
                        )}
                      </div>
                      <p
                        className={cn(
                          "text-xs leading-relaxed",
                          isActive ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {scene?.description || "No description available"}
                      </p>
                    </button>
                  )
                })}
              </div>
          </div>
        </Card>
      </div>

      {/* Navigation */}
      <div className="flex gap-2 justify-between">
        <Button variant="outline" onClick={() => setCurrentStep(4)} size="sm">
          <ArrowLeft className="size-4" />
          Back to Preview
        </Button>
        <Button onClick={() => setCurrentStep(6)} size="sm">
          Proceed to Screening Room
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
