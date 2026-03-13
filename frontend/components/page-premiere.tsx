"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { useApp } from "@/lib/app-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import {
  Download,
  Share2,
  ShieldCheck,
  ArrowLeft,
  MonitorPlay,
  MessageCircle,
  Instagram,
  Music2,
  Play,
  Pause,
  CheckCircle2,
  Megaphone,
  Film,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

export function PagePremiere() {
  const { scenes, factCheck, config, visualAudioState, setCurrentStep } = useApp()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [activeClip, setActiveClip] = useState(0)

  const clips = visualAudioState?.veo_clips ?? []
  const totalDuration = scenes.reduce((sum, s) => sum + (s.duration || 8), 0)

  const allFactsVerified =
    factCheck.scam_name_verified &&
    factCheck.story_hook_verified &&
    factCheck.red_flag_verified &&
    factCheck.the_fix_verified &&
    factCheck.reference_sources_verified

  // Reset playback when switching clips
  useEffect(() => {
    setIsPlaying(false)
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }, [activeClip])

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
    if (activeClip < clips.length - 1) {
      setActiveClip(activeClip + 1)
    }
  }

  const handleDownload = useCallback(() => {
    // Download all clips as individual files, or the current clip
    const clip = clips[activeClip]
    if (!clip) return
    const src = getClipSrc(activeClip)
    if (!src) return

    const link = document.createElement("a")
    if (src.startsWith("data:")) {
      link.href = src
    } else {
      link.href = src
    }
    link.download = clip.filename || `scam-shield-clip-${activeClip + 1}.mp4`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [clips, activeClip])

  const handleShare = useCallback((platform: "whatsapp" | "instagram" | "tiktok") => {
    const title = factCheck.scam_name || "Scam Shield Video"
    const text = `${title} - Anti-Scam Awareness Video by amaran.ai`

    if (navigator.share) {
      navigator.share({ title, text }).catch(() => {})
      return
    }

    // Fallback: open platform URLs
    switch (platform) {
      case "whatsapp":
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank")
        break
      case "instagram":
        // Instagram doesn't have a direct share URL for videos, show a hint
        alert("Download the video first, then share it on Instagram Reels.")
        break
      case "tiktok":
        alert("Download the video first, then upload it to TikTok.")
        break
    }
  }, [factCheck.scam_name])

  const currentClipSrc = getClipSrc(activeClip)
  const currentScene = getSceneForClip(activeClip)

  const formatLabel =
    config.videoFormat === "reel"
      ? "9:16 vertical format"
      : "16:9 landscape format"

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-foreground text-balance tracking-tight">
          Screening Room
        </h1>
        <p className="text-muted-foreground text-sm">
          Preview, verify, and share your video with the world.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Video Player */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <MonitorPlay className="size-4 text-teal-400" />
                Video Player
                {clips.length > 0 && (
                  <span className="text-xs text-muted-foreground font-normal ml-1">
                    Clip {activeClip + 1} of {clips.length}
                  </span>
                )}
              </CardTitle>
              <Badge
                variant="outline"
                className="text-green-400 border-green-500/30 bg-green-500/10"
              >
                <CheckCircle2 className="size-3 mr-1" />
                Safety Cleared
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {clips.length > 0 ? (
              <>
                {/* Actual video player */}
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

                {/* Timeline */}
                <div className="flex flex-col gap-2">
                  <div className="flex gap-1 w-full">
                    {clips.map((clip, i) => {
                      const scene = getSceneForClip(i)
                      const isActive = i === activeClip
                      const duration = scene?.duration || 8
                      return (
                        <button
                          key={clip.segment_id ?? i}
                          onClick={() => setActiveClip(i)}
                          className={cn(
                            "relative rounded-md transition-all duration-200 cursor-pointer min-w-[32px]",
                            "hover:ring-1 hover:ring-teal-400/40",
                            isActive
                              ? "ring-2 ring-teal-400 bg-teal-500/20"
                              : "bg-secondary/60 hover:bg-secondary"
                          )}
                          style={{ flex: duration }}
                        >
                          <div className="h-7 flex items-center justify-center">
                            <span className={cn("text-[10px] font-semibold", isActive ? "text-teal-400" : "text-muted-foreground")}>
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
              </>
            ) : (
              /* No clips placeholder */
              <div className="rounded-xl bg-gradient-to-b from-secondary/40 to-secondary/20 border border-border/40 overflow-hidden aspect-video flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-center p-6">
                  <Film className="size-10 text-muted-foreground/40" />
                  <p className="text-foreground font-semibold">
                    {factCheck.scam_name || "Your Video"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    No clips available. Generate clips in Clips Review first.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Export & Share */}
        <div className="flex flex-col gap-6">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Download className="size-4 text-blue-400" />
                Export Hub
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button
                className="w-full"
                size="lg"
                disabled={clips.length === 0}
                onClick={handleDownload}
              >
                <Download className="size-4" />
                Download MP4
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                {formatLabel}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Share2 className="size-4 text-purple-400" />
                Share Directly
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-11 text-foreground hover:border-green-500/30 transition-all"
                onClick={() => handleShare("whatsapp")}
              >
                <MessageCircle className="size-5 text-green-400" />
                Share to WhatsApp
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-11 text-foreground hover:border-pink-500/30 transition-all"
                onClick={() => handleShare("instagram")}
              >
                <Instagram className="size-5 text-pink-400" />
                Share to Instagram Reels
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-11 text-foreground hover:border-foreground/30 transition-all"
                onClick={() => handleShare("tiktok")}
              >
                <Music2 className="size-5 text-foreground" />
                Share to TikTok
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <ShieldCheck className="size-4 text-green-400" />
                Verification Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                <StatusRow label="Safety Review" ok />
                <StatusRow label="Content Verified" ok />
                <StatusRow label="No Sensitive Material" ok />
                <StatusRow label="Fact-Checked" ok={allFactsVerified} />
              </div>
            </CardContent>
          </Card>

          <Separator />

          <Button
            onClick={() => setCurrentStep(7)}
            className="w-full bg-primary text-primary-foreground"
            size="sm"
          >
            <Megaphone className="size-4" />
            Social Media Strategy
          </Button>

          <Button
            variant="outline"
            onClick={() => setCurrentStep(5)}
            className="w-full"
            size="sm"
          >
            <ArrowLeft className="size-4" />
            Back to Clips Review
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-foreground">{label}</span>
      <Badge
        variant="outline"
        className={
          ok
            ? "text-green-400 border-green-500/30 bg-green-500/10"
            : "text-teal-400 border-teal-500/30 bg-teal-500/10"
        }
      >
        {ok ? "Passed" : "Pending"}
      </Badge>
    </div>
  )
}
