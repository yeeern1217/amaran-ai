"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { useApp } from "@/lib/app-context"
import { ensureCaptions, exportStitchedVideo, generateVideoAssets, getCaptions } from "@/lib/api"
import type { CaptionEntry } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
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
  Loader2,
  Subtitles,
  Video,
} from "lucide-react"

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "bm", label: "Bahasa Melayu" },
  { code: "zh", label: "Mandarin" },
  { code: "ta", label: "Tamil" },
]

export function PagePremiere() {
  const {
    sessionId,
    scenes,
    factCheck,
    config,
    visualAudioState,
    setVisualAudioState,
    setCurrentStep,
  } = useApp()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [activeClip, setActiveClip] = useState(0)

  // Caption & language state
  const langMap: Record<string, string> = {
    english: "en", malay: "bm", mandarin: "zh", chinese: "zh", tamil: "ta",
  }
  const defaultLangCode = langMap[config.language] || "en"
  const [captionLangs, setCaptionLangs] = useState<string[]>([])
  const [pendingCaptionLangs, setPendingCaptionLangs] = useState<string[]>([])
  const [clipLang, setClipLang] = useState<string>(defaultLangCode)
  const [pendingClipLang, setPendingClipLang] = useState<string>(defaultLangCode)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [regenError, setRegenError] = useState<string | null>(null)

  // Caption data from backend (per language, per segment)
  const [captionData, setCaptionData] = useState<Record<string, CaptionEntry[]>>({})

  // Export state
  const [isExporting, setIsExporting] = useState(false)

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

  const refreshCaptions = useCallback(async () => {
    if (!sessionId) return
    try {
      const res = await getCaptions(sessionId)
      setCaptionData(res.captions)
    } catch {
      // captions are optional
    }
  }, [sessionId])

  // Fetch caption data from backend
  useEffect(() => {
    refreshCaptions()
  }, [refreshCaptions])

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

  function extractQuotedDialogue(text: string): string[] {
    const lines: string[] = []
    const re = /"([^"]+)"|'([^']+)'/g
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const value = (m[1] || m[2] || "").trim()
      if (value) lines.push(value)
    }
    return lines
  }

  function extractSpeakerDialogue(text: string): string[] {
    const lines: string[] = []
    const re = /(?:^|[.;])\s*[^.\n]{0,80}\b(?:says?|asks?|replies?|whispers?|shouts?)\s*:\s*([^.;\n]+)/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const value = (m[1] || "").trim()
      if (value) lines.push(value)
    }
    return lines
  }

  function normalizeCaptionText(text: string): string[] {
    const quoted = extractQuotedDialogue(text)
    if (quoted.length > 0) return quoted
    const speaker = extractSpeakerDialogue(text)
    if (speaker.length > 0) return speaker
    return []
  }

  /** Build caption lines for the active clip based on selected caption languages. */
  function getCaptionTextForClip(clipIndex: number): string[] {
    if (captionLangs.length === 0) return []
    const clip = clips[clipIndex]
    if (!clip) return []
    const segId = clip.segment_index ?? clip.segment_id ?? clipIndex + 1
    const lines: string[] = []
    for (const lang of captionLangs) {
      const entries = captionData[lang]
      if (entries) {
        const entry = entries.find((e) => e.segment_id === segId)
        if (entry?.text) {
          lines.push(...normalizeCaptionText(entry.text))
          continue
        }
      }

      // Fallback for on-demand translated clips that are not in video_package
      if (visualAudioState?.veo_script && lang === clipLang) {
        const seg = visualAudioState.veo_script.segments.find((s) => s.segment_index === segId)
        if (seg?.veo_prompt) {
          lines.push(...normalizeCaptionText(seg.veo_prompt))
        }
      }
    }
    return lines
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

  function toggleCaption(code: string) {
    setPendingCaptionLangs((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    )
  }

  function areLanguageSetsEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false
    const sa = new Set(a)
    if (sa.size !== new Set(b).size) return false
    return b.every((x) => sa.has(x))
  }

  const hasPendingLanguageChange = pendingClipLang !== clipLang
  const hasPendingCaptionChange = !areLanguageSetsEqual(pendingCaptionLangs, captionLangs)
  const hasPendingChanges = hasPendingLanguageChange || hasPendingCaptionChange

  // Apply pending language changes.
  async function handleApplyPendingLanguages() {
    if (!sessionId || !hasPendingChanges) return
    setIsRegenerating(true)
    setRegenError(null)
    try {
      let resolvedClipLang = clipLang

      if (hasPendingLanguageChange) {
        const result = await generateVideoAssets(sessionId, pendingClipLang)
        if (result.visual_audio_state) {
          resolvedClipLang = result.language_code
          setClipLang(result.language_code)
          setPendingClipLang(result.language_code)
          setVisualAudioState(result.visual_audio_state)
          setActiveClip(0)
        }
        if (result.language_code !== pendingClipLang) {
          setRegenError(`Language '${pendingClipLang}' is not available in this package yet; showing '${result.language_code}'.`)
        }
      }

      const missingCaptionLangs = pendingCaptionLangs.filter((lang) => !captionData[lang])
      if (missingCaptionLangs.length > 0) {
        const ensured = await ensureCaptions({
          session_id: sessionId,
          language_codes: missingCaptionLangs,
          source_language_code: clipLang,
        })
        setCaptionData((prev) => ({ ...prev, ...ensured.captions }))
      }

      if (pendingCaptionLangs.length > 0 || missingCaptionLangs.length > 0 || hasPendingLanguageChange) {
        await refreshCaptions()
      }

      setCaptionLangs([...pendingCaptionLangs])
      if (!hasPendingLanguageChange) {
        setPendingClipLang(resolvedClipLang)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to regenerate clips"
      if (msg.toLowerCase().includes("not in package")) {
        setPendingClipLang(clipLang)
        setPendingCaptionLangs(captionLangs)
        setRegenError(
          "This language was not generated in the current video package. Go back to Configuration and regenerate for that language first."
        )
      } else {
        setRegenError(msg)
      }
    } finally {
      setIsRegenerating(false)
    }
  }

  // Download combined video
  const handleDownload = useCallback(async () => {
    if (!sessionId || clips.length === 0) return
    setIsExporting(true)
    try {
      const blob = await exportStitchedVideo(sessionId, captionLangs)
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${factCheck.scam_name || "scam-shield-video"}.mp4`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Export failed:", err)
      alert(err instanceof Error ? err.message : "Failed to export video")
    } finally {
      setIsExporting(false)
    }
  }, [sessionId, clips.length, captionLangs, factCheck.scam_name])

  const handleShare = useCallback((platform: "whatsapp" | "instagram" | "tiktok") => {
    const title = factCheck.scam_name || "Scam Shield Video"
    const text = `${title} - Anti-Scam Awareness Video by amaran.ai`

    if (navigator.share) {
      navigator.share({ title, text }).catch(() => {})
      return
    }

    switch (platform) {
      case "whatsapp":
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank")
        break
      case "instagram":
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
          Preview, verify, and export your video with captions and language options.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Left column */}
        <div className="flex flex-col gap-4">
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
                    {/* Caption overlay */}
                    {getCaptionTextForClip(activeClip).length > 0 && (
                      <div className="absolute bottom-4 left-4 right-4 pointer-events-none flex flex-col items-center gap-1">
                        {getCaptionTextForClip(activeClip).map((line, i) => (
                          <span
                            key={i}
                            className="inline-block bg-black/70 text-white text-sm px-3 py-1 rounded leading-snug text-center max-w-[90%]"
                          >
                            {line}
                          </span>
                        ))}
                      </div>
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

          {/* Caption & Video Clip Language Selection */}
          <Card className="border-border bg-card">
            <CardContent className="pt-5">
              <div className="grid grid-cols-2 gap-6">
                {/* Caption Language (checkbox — no Veo needed) */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Subtitles className="size-4 text-muted-foreground" />
                    Caption
                  </div>
                  <div className="flex flex-col gap-2">
                    {LANGUAGES.map((lang) => (
                      <label
                        key={lang.code}
                        className="flex items-center gap-2.5 cursor-pointer group"
                      >
                        <Checkbox
                          checked={pendingCaptionLangs.includes(lang.code)}
                          onCheckedChange={() => toggleCaption(lang.code)}
                        />
                        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                          {lang.label}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {pendingCaptionLangs.length === 0
                      ? "No captions selected"
                      : `${pendingCaptionLangs.length} caption${pendingCaptionLangs.length > 1 ? "s" : ""} selected`}
                  </p>
                </div>

                {/* Video Clip Language (requires Veo regeneration) */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Video className="size-4 text-muted-foreground" />
                    Video Clip
                  </div>
                  <div className="flex flex-col gap-2">
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        disabled={isRegenerating}
                        onClick={() => setPendingClipLang(lang.code)}
                        className={cn(
                          "text-left text-sm px-3 py-1.5 rounded-md border transition-all",
                          pendingClipLang === lang.code
                            ? "border-primary/40 bg-primary/10 text-primary font-medium"
                            : "border-border/40 text-muted-foreground hover:text-foreground hover:border-border/80"
                        )}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    className="mt-1"
                    disabled={isRegenerating || !sessionId || !hasPendingChanges}
                    onClick={handleApplyPendingLanguages}
                  >
                    {isRegenerating ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      "Generate Video"
                    )}
                  </Button>
                </div>
              </div>

              {regenError && (
                <div className="mt-3 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-400">
                  {regenError}
                </div>
              )}

              {!isRegenerating && hasPendingChanges && (
                <p className="mt-3 text-xs text-amber-300">
                  Pending changes detected. Click Generate Video to apply them.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column — Export & Share */}
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
                disabled={clips.length === 0 || isExporting}
                onClick={handleDownload}
              >
                {isExporting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="size-4" />
                    Download MP4
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                {formatLabel}
                {captionLangs.length > 0 && ` · ${captionLangs.length} caption${captionLangs.length > 1 ? "s" : ""}`}
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
