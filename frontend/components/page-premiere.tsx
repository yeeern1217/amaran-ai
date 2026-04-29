"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { useApp } from "@/lib/app-context"
import { exportStitchedVideo, generateVideoAssets, getCaptions, ensureCaptions, publishToYouTube, publishToInstagram } from "@/lib/api"
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
  CheckCircle2,
  Megaphone,
  Film,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Subtitles,
  Video,
  Youtube,
  ExternalLink,
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
    instagramPublishStatus,
    setInstagramPublishStatus,
    instagramPublishUrl,
    setInstagramPublishUrl,
    instagramPublishError,
    setInstagramPublishError,
    setCurrentStep,
  } = useApp()
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [activeClip, setActiveClip] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const autoPlayNextRef = useRef(false)
  const [isLoadingStitched, setIsLoadingStitched] = useState(false)
  const [stitchedPreviewSrc, setStitchedPreviewSrc] = useState<string | null>(null)
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false)

  // Caption & language state
  const langMap: Record<string, string> = {
    english: "en", malay: "bm", mandarin: "zh", chinese: "zh", tamil: "ta",
  }
  const defaultLangCode = langMap[config.language] || "en"
  const [captionLangs, setCaptionLangs] = useState<string[]>([])
  const [clipLang, setClipLang] = useState<string>(defaultLangCode)
  const [pendingClipLang, setPendingClipLang] = useState<string>(defaultLangCode)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [regenError, setRegenError] = useState<string | null>(null)

  // Caption data from backend (per language, per segment)
  const [captionData, setCaptionData] = useState<Record<string, CaptionEntry[]>>({})
  const [captionTrackSrc, setCaptionTrackSrc] = useState<string | null>(null)

  // Export state
  const [isExporting, setIsExporting] = useState(false)
  const [shareStatus, setShareStatus] = useState<string | null>(null)

  // YouTube publish state
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)

  // Instagram publish state (persisted in app context)
  const isPublishingIG = instagramPublishStatus === "uploading"
  const publishedIGUrl = instagramPublishUrl
  const publishIGError = instagramPublishError

  const clips = visualAudioState?.veo_clips ?? []
  const totalDuration = scenes.reduce((sum, s) => sum + (s.duration || 8), 0)
  // Prefer stitched full-length playback for a stable fullscreen demo.
  const hasContinuousVideo = Boolean(stitchedPreviewSrc)

  const allFactsVerified =
    factCheck.scam_name_verified &&
    factCheck.story_hook_verified &&
    factCheck.red_flag_verified &&
    factCheck.the_fix_verified &&
    factCheck.reference_sources_verified

  // Keep playback rate in sync.
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed
    }
  }, [playbackSpeed])

  // Track fullscreen state so caption overlay can scale up for readability.
  useEffect(() => {
    const onFullscreenChange = () => {
      const fullscreenEl = document.fullscreenElement
      setIsPreviewFullscreen(
        fullscreenEl === previewContainerRef.current || fullscreenEl === videoRef.current
      )
    }

    onFullscreenChange()
    document.addEventListener("fullscreenchange", onFullscreenChange)
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange)
    }
  }, [])

  // In fallback clip-by-clip mode, switching clips resets playback.
  useEffect(() => {
    if (hasContinuousVideo) return
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
      videoRef.current.playbackRate = playbackSpeed
      if (autoPlayNextRef.current) {
        autoPlayNextRef.current = false
        videoRef.current.play().catch(() => {})
      } else {
        setIsPlaying(false)
      }
    } else {
      setIsPlaying(false)
    }
  }, [activeClip, playbackSpeed, hasContinuousVideo])

  // Load stitched full-length video for Screening Room preview.
  // Fallback to per-clip playback if stitched export is unavailable.
  useEffect(() => {
    if (!sessionId || clips.length === 0) {
      setStitchedPreviewSrc(null)
      return
    }

    let cancelled = false
    let objectUrl: string | null = null

    setIsLoadingStitched(true)
    exportStitchedVideo(sessionId)
      .then((blob) => {
        if (cancelled) return
        if (!blob || blob.size === 0) {
          setStitchedPreviewSrc(null)
          return
        }

        objectUrl = URL.createObjectURL(blob)
        setStitchedPreviewSrc(objectUrl)
        setActiveClip(0)
        setIsPlaying(false)
      })
      .catch((err) => {
        console.warn("[Premiere] stitched preview unavailable, falling back to clips", err)
        if (!cancelled) {
          setStitchedPreviewSrc(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingStitched(false)
        }
      })

    return () => {
      cancelled = true
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [sessionId, clips.length, clipLang])

  // Fetch caption data from backend
  useEffect(() => {
    if (!sessionId) return
    getCaptions(sessionId)
      .then((res) => {
        console.log("[Premiere] Captions loaded:", Object.keys(res.captions))
        setCaptionData(res.captions)
      })
      .catch((err) => {
        console.warn("[Premiere] getCaptions failed, using local fallback:", err)
        // Fallback: build captions from scenes (for the default language at minimum)
        if (scenes.length > 0) {
          const fallback: Record<string, Array<{ segment_id: number; text: string }>> = {}
          fallback[defaultLangCode] = scenes.map((s, i) => ({
            segment_id: s.id ?? i + 1,
            text: s.dialogue || s.description || "",
          }))
          setCaptionData(fallback)
        }
      })
  }, [sessionId, scenes, defaultLangCode])

  // Build a WebVTT track for native fullscreen captions.
  useEffect(() => {
    if (captionLangs.length === 0 || clips.length === 0) {
      setCaptionTrackSrc(null)
      return
    }

    const cues: string[] = []
    let cueNumber = 1
    let startSeconds = 0

    for (let i = 0; i < clips.length; i++) {
      const lines = getCaptionTextForClip(i)
      const duration = getClipDurationSeconds(i)
      if (lines.length > 0) {
        const endSeconds = startSeconds + duration
        cues.push(`${cueNumber}`)
        cues.push(`${formatVttTimestamp(startSeconds)} --> ${formatVttTimestamp(endSeconds)}`)
        cues.push(lines.join("\n"))
        cues.push("")
        cueNumber += 1
      }
      startSeconds += duration
    }

    if (cues.length === 0) {
      setCaptionTrackSrc(null)
      return
    }

    const trackBlob = new Blob([`WEBVTT\n\n${cues.join("\n")}`], { type: "text/vtt" })
    const trackUrl = URL.createObjectURL(trackBlob)
    setCaptionTrackSrc(trackUrl)

    return () => {
      URL.revokeObjectURL(trackUrl)
    }
  }, [captionLangs, captionData, clips, scenes, visualAudioState])

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

  function normalizeCaptionText(text: string): string[] {
    const quoted = extractQuotedDialogue(text)
    if (quoted.length > 0) return quoted
    const trimmed = (text || "").trim()
    return trimmed ? [trimmed] : []
  }

  function formatVttTimestamp(totalSeconds: number): string {
    const safe = Math.max(0, totalSeconds)
    const hours = Math.floor(safe / 3600)
    const minutes = Math.floor((safe % 3600) / 60)
    const seconds = Math.floor(safe % 60)
    const milliseconds = Math.floor((safe - Math.floor(safe)) * 1000)
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`
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

      // Fallback: extract dialogue from veo_script prompts
      if (visualAudioState?.veo_script) {
        const seg = visualAudioState.veo_script.segments.find((s) => s.segment_id === segId)
        if (seg?.veo_prompt) {
          const quoted = extractQuotedDialogue(seg.veo_prompt)
          if (quoted.length > 0) {
            lines.push(...quoted)
            continue
          }
        }
      }

      // Fallback: extract from scene dialogue/description
      const scene = scenes[clipIndex]
      if (scene) {
        const text = scene.dialogue || scene.description || ""
        if (text) {
          const quoted = extractQuotedDialogue(text)
          if (quoted.length > 0) {
            lines.push(...quoted)
          }
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
      videoRef.current.playbackRate = playbackSpeed
      videoRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  function handleClipEnd() {
    if (hasContinuousVideo) {
      setIsPlaying(false)
      return
    }
    if (activeClip < clips.length - 1) {
      autoPlayNextRef.current = true
      setActiveClip(activeClip + 1)
    } else {
      setIsPlaying(false)
    }
  }

  function handleSpeedChange(speed: number) {
    setPlaybackSpeed(speed)
    if (videoRef.current) {
      videoRef.current.playbackRate = speed
    }
  }

  function toggleCaption(code: string) {
    const isRemoving = captionLangs.includes(code)
    setCaptionLangs((prev) =>
      isRemoving ? prev.filter((c) => c !== code) : [...prev, code]
    )

    // If toggling on and captions not yet available, translate on-demand
    if (!isRemoving && !captionData[code] && sessionId) {
      ensureCaptions({ session_id: sessionId, language_codes: [code] })
        .then((res) => {
          setCaptionData((prev) => ({ ...prev, ...res.captions }))
        })
        .catch((err) => {
          console.warn("[Premiere] ensureCaptions failed for", code, err)
        })
    }
  }

  function getClipDurationSeconds(clipIndex: number): number {
    return getSceneForClip(clipIndex)?.duration || 8
  }

  function getClipStartTime(clipIndex: number): number {
    let acc = 0
    for (let i = 0; i < clipIndex; i++) {
      acc += getClipDurationSeconds(i)
    }
    return acc
  }

  function getClipIndexAtTime(seconds: number): number {
    if (clips.length === 0) return 0
    let acc = 0
    for (let i = 0; i < clips.length; i++) {
      const end = acc + getClipDurationSeconds(i)
      if (seconds < end || i === clips.length - 1) return i
      acc = end
    }
    return 0
  }

  function handleTimelineJump(targetClip: number) {
    if (hasContinuousVideo && videoRef.current) {
      videoRef.current.currentTime = getClipStartTime(targetClip)
      setActiveClip(targetClip)
      return
    }
    setActiveClip(targetClip)
  }

  function handleVideoTimeUpdate() {
    if (!hasContinuousVideo || !videoRef.current) return
    const idx = getClipIndexAtTime(videoRef.current.currentTime)
    if (idx !== activeClip) {
      setActiveClip(idx)
    }
  }

  const hasPendingLanguageChange = pendingClipLang !== clipLang

  // Apply pending language change. Requires Veo regeneration.
  async function handleRegenerateClipLanguage() {
    if (!sessionId || !hasPendingLanguageChange) return
    setIsRegenerating(true)
    setRegenError(null)
    try {
      const result = await generateVideoAssets(sessionId, pendingClipLang)
      if (result.visual_audio_state) {
        setClipLang(result.language_code)
        setPendingClipLang(result.language_code)
        setVisualAudioState(result.visual_audio_state)
        setActiveClip(0)
      }
      if (result.language_code !== pendingClipLang) {
        setRegenError(`Language '${pendingClipLang}' is not available in this package yet; showing '${result.language_code}'.`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to regenerate clips"
      if (msg.toLowerCase().includes("not in package")) {
        setPendingClipLang(clipLang)
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

  const handleShare = useCallback(async (platform: "whatsapp" | "instagram" | "tiktok") => {
    const title = factCheck.scam_name || "Scam Shield Video"
    const text = `${title} - Anti-Scam Awareness Video by amaran.ai`

    // Copy share text to clipboard
    navigator.clipboard.writeText(text).catch(() => {})

    // Auto-download the video so the user can attach/upload it
    if (sessionId && clips.length > 0) {
      try {
        const blob = await exportStitchedVideo(sessionId, captionLangs)
        if (blob.size > 0) {
          const url = URL.createObjectURL(blob)
          const link = document.createElement("a")
          link.href = url
          link.download = `${title.replace(/[^a-zA-Z0-9 ]/g, "")}.mp4`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
        }
      } catch { /* continue to open platform even if download fails */ }
    }

    // Open the platform
    const platformLabel = { whatsapp: "WhatsApp", instagram: "Instagram", tiktok: "TikTok" }[platform]
    switch (platform) {
      case "whatsapp":
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank")
        break
      case "instagram":
        window.open("https://www.instagram.com/reels/", "_blank")
        break
      case "tiktok":
        window.open("https://www.tiktok.com/upload", "_blank")
        break
    }

    setShareStatus(`Video downloaded — attach it in ${platformLabel} to share`)
    setTimeout(() => setShareStatus(null), 6000)
  }, [factCheck.scam_name, sessionId, clips.length, captionLangs])

  // Publish directly to YouTube
  const handlePublishYouTube = useCallback(async () => {
    if (!sessionId || clips.length === 0) return
    setIsPublishing(true)
    setPublishError(null)
    setPublishedUrl(null)
    try {
      const title = factCheck.scam_name || "Scam Shield - Anti-Scam Awareness"
      const description = [
        `${title} - Anti-Scam Awareness Video`,
        "",
        "Generated by amaran.ai — AI-powered scam awareness video platform for PDRM/MCMC Malaysia.",
        "",
        "🔗 Powered by Google Gemini, Veo, and Nano Banana",
        "",
        "#ScamAlert #AntiScam #Malaysia #PDRM #ScamShield #AmaranAI",
      ].join("\n")
      const tags = ["scam alert", "anti scam", "malaysia", "PDRM", "scam awareness", "amaran.ai"]

      const result = await publishToYouTube({
        session_id: sessionId,
        title,
        description,
        tags,
        privacy: "unlisted",
        caption_languages: captionLangs,
      })
      if (result.video_url) {
        setPublishedUrl(result.video_url)
      } else {
        setPublishError(result.message || "Upload completed but no URL returned")
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to publish to YouTube"
      setPublishError(msg)
    } finally {
      setIsPublishing(false)
    }
  }, [sessionId, clips.length, factCheck.scam_name, captionLangs])

  // Publish directly to Instagram Reels
  const handlePublishInstagram = useCallback(async () => {
    if (!sessionId || clips.length === 0) return
    setInstagramPublishStatus("uploading")
    setInstagramPublishError(null)
    setInstagramPublishUrl(null)
    try {
      const title = factCheck.scam_name || "Scam Shield"
      const caption = [
        `⚠️ ${title} - Anti-Scam Awareness`,
        "",
        "Generated by amaran.ai \u2014 AI-powered scam awareness video platform.",
        "",
        "#ScamAlert #AntiScam #Malaysia #PDRM #ScamShield #AmaranAI #Reels",
      ].join("\n")

      const result = await publishToInstagram({
        session_id: sessionId,
        caption,
        caption_languages: captionLangs,
      })
      if (result.permalink) {
        setInstagramPublishUrl(result.permalink)
        setInstagramPublishStatus("success")
      } else {
        setInstagramPublishError(result.message || "Published but no permalink returned")
        setInstagramPublishStatus("error")
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to publish to Instagram"
      setInstagramPublishError(msg)
      setInstagramPublishStatus("error")
    }
  }, [
    sessionId,
    clips.length,
    factCheck.scam_name,
    captionLangs,
    setInstagramPublishStatus,
    setInstagramPublishError,
    setInstagramPublishUrl,
  ])

  const currentClipSrc = getClipSrc(activeClip)
  const activeVideoSrc = stitchedPreviewSrc ?? currentClipSrc
  const currentScene = getSceneForClip(activeClip)

  const formatLabel =
    config.videoFormat === "reel"
      ? "9:16 vertical format"
      : "16:9 landscape format"

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      <style jsx global>{`
        video::cue {
          background: rgba(0, 0, 0, 0.72);
          color: #fff;
          font-size: 1rem;
          line-height: 1.35;
        }

        video:fullscreen::cue {
          font-size: 3vh;
          line-height: 1.45;
        }
      `}</style>
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
                      {hasContinuousVideo ? "Continuous playback" : `Clip ${activeClip + 1} of ${clips.length}`}
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
                  <div
                    ref={previewContainerRef}
                    className="relative rounded-xl border border-border/40 overflow-hidden aspect-video bg-black w-full group"
                  >
                    {activeVideoSrc ? (
                      <video
                        ref={videoRef}
                        key={activeVideoSrc}
                        src={activeVideoSrc}
                        className="w-full h-full object-contain"
                        preload="auto"
                        controls
                        playsInline
                        onEnded={handleClipEnd}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onTimeUpdate={handleVideoTimeUpdate}
                      >
                        {isPreviewFullscreen && captionTrackSrc && (
                          <track
                            key={captionTrackSrc}
                            kind="subtitles"
                            src={captionTrackSrc}
                            srcLang={captionLangs[0] || "en"}
                            label="Captions"
                            default
                          />
                        )}
                      </video>
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
                    {isLoadingStitched && (
                      <div className="absolute top-3 right-3 rounded-md bg-black/60 px-2 py-1 text-[11px] text-white pointer-events-none">
                        Preparing seamless playback...
                      </div>
                    )}
                    {activeVideoSrc && !hasContinuousVideo && !isPlaying && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <button
                          onClick={handlePlayPause}
                          className="pointer-events-auto size-16 rounded-full bg-teal-500/20 backdrop-blur-sm flex items-center justify-center shadow-[0_0_20px_oklch(0.87_0.17_175/0.15)] opacity-80 hover:opacity-100 transition-opacity"
                          aria-label="Play video"
                        >
                          <Play className="size-8 text-teal-400 ml-1" />
                        </button>
                      </div>
                    )}
                    {/* Caption overlay */}
                    {!isPreviewFullscreen && getCaptionTextForClip(activeClip).length > 0 && (
                      <div
                        className={cn(
                          "absolute left-4 right-4 pointer-events-none flex flex-col items-center",
                          isPreviewFullscreen ? "bottom-8 gap-2" : "bottom-4 gap-1"
                        )}
                      >
                        {getCaptionTextForClip(activeClip).map((line, i) => (
                          <span
                            key={i}
                            className={cn(
                              "inline-block bg-black/70 text-white rounded leading-snug text-center",
                              isPreviewFullscreen
                                ? "text-lg md:text-xl px-5 py-2 max-w-[94%]"
                                : "text-sm px-3 py-1 max-w-[90%]"
                            )}
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
                      onClick={() => handleTimelineJump(Math.max(0, activeClip - 1))}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ChevronLeft className="size-4" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-2">
                      {/* Speed controls */}
                      <div className="flex items-center gap-1 ml-1">
                        {[1, 1.5, 2, 4, 6].map((speed) => (
                          <Button
                            key={speed}
                            variant={playbackSpeed === speed ? "default" : "ghost"}
                            size="sm"
                            onClick={() => handleSpeedChange(speed)}
                            className={cn(
                              "h-7 px-2 text-xs font-medium min-w-[36px]",
                              playbackSpeed === speed
                                ? "bg-teal-500/20 text-teal-400 hover:bg-teal-500/30"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {speed}x
                          </Button>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={activeClip >= clips.length - 1}
                      onClick={() => handleTimelineJump(Math.min(clips.length - 1, activeClip + 1))}
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
                            onClick={() => handleTimelineJump(i)}
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
                {/* Caption Language (checkbox — instant, no regeneration) */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Subtitles className="size-4 text-muted-foreground" />
                    Subtitle Captions
                  </div>
                  <p className="text-[11px] text-muted-foreground -mt-1">
                    Instant preview — no regeneration needed
                  </p>
                  <div className="flex flex-col gap-2">
                    {LANGUAGES.map((lang) => (
                      <label
                        key={lang.code}
                        className="flex items-center gap-2.5 cursor-pointer group"
                      >
                        <Checkbox
                          checked={captionLangs.includes(lang.code)}
                          onCheckedChange={() => toggleCaption(lang.code)}
                        />
                        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                          {lang.label}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {captionLangs.length === 0
                      ? "No captions selected"
                      : `${captionLangs.length} caption${captionLangs.length > 1 ? "s" : ""} selected`}
                  </p>
                </div>

                {/* Video Clip Audio Language (requires Veo regeneration) */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Video className="size-4 text-muted-foreground" />
                    Spoken Audio Language
                  </div>
                  <p className="text-[11px] text-muted-foreground -mt-1">
                    Requires clip regeneration
                  </p>
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
                    disabled={isRegenerating || !sessionId || !hasPendingLanguageChange}
                    onClick={handleRegenerateClipLanguage}
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

              {!isRegenerating && hasPendingLanguageChange && (
                <p className="mt-3 text-xs text-amber-300">
                  Pending changes detected. Click Generate Video to apply them.
                </p>
              )}

              <Separator className="my-3" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                <strong className="text-foreground/80">How it works:</strong> Subtitle captions update instantly in the preview and are burned into the downloaded MP4.
                Changing the spoken audio language requires regenerating clips with{" "}
                <span className="text-primary">Generate Video</span>.
                The downloaded video uses the current audio language + all selected subtitle languages.
              </p>
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
                {captionLangs.length > 0 && ` · ${captionLangs.length} subtitle${captionLangs.length > 1 ? "s" : ""} burned in`}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Youtube className="size-4 text-red-500" />
                Publish & Share
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {/* 2×2 grid — all four platforms equal */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-10 hover:border-red-500/50 hover:bg-red-500/10"
                  disabled={clips.length === 0 || isPublishing}
                  onClick={handlePublishYouTube}
                >
                  {isPublishing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Youtube className="size-4 text-red-500" />
                  )}
                  {isPublishing ? "Uploading…" : "YouTube"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-10 hover:border-green-500/30"
                  onClick={() => handleShare("whatsapp")}
                >
                  <MessageCircle className="size-4 text-green-400" />
                  WhatsApp
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-10 hover:border-pink-500/30 hover:bg-pink-500/10"
                  disabled={clips.length === 0 || isPublishingIG}
                  onClick={handlePublishInstagram}
                >
                  {isPublishingIG ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Instagram className="size-4 text-pink-400" />
                  )}
                  {isPublishingIG ? "Uploading…" : "IG Reels"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-10 hover:border-foreground/30"
                  onClick={() => handleShare("tiktok")}
                >
                  <Music2 className="size-4" />
                  TikTok
                </Button>
              </div>

              {publishedUrl && (
                <div className="rounded-lg bg-green-500/10 border border-green-500/30 px-3 py-2.5 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-sm font-medium text-green-400">
                    <CheckCircle2 className="size-4" />
                    YouTube — Published!
                  </div>
                  <a
                    href={publishedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 underline flex items-center gap-1 break-all"
                  >
                    {publishedUrl}
                    <ExternalLink className="size-3 flex-shrink-0" />
                  </a>
                </div>
              )}

              {publishedIGUrl && (
                <div className="rounded-lg bg-green-500/10 border border-green-500/30 px-3 py-2.5 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-sm font-medium text-green-400">
                    <CheckCircle2 className="size-4" />
                    Instagram — Published!
                  </div>
                  <a
                    href={publishedIGUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 underline flex items-center gap-1 break-all"
                  >
                    {publishedIGUrl}
                    <ExternalLink className="size-3 flex-shrink-0" />
                  </a>
                </div>
              )}

              {publishError && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-400 text-center">
                  YT: {publishError}
                </div>
              )}

              {publishIGError && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-400 text-center">
                  IG: {publishIGError}
                </div>
              )}

              {shareStatus && (
                <div className="rounded-lg bg-teal-500/10 border border-teal-500/30 px-3 py-2 text-xs text-teal-400 text-center">
                  {shareStatus}
                </div>
              )}
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
