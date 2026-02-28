"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useApp } from "@/lib/app-context"
import { generateVideoAssets, getVideoAssetsStatus } from "@/lib/api"
import type { VideoAssetsStage, VisualAudioState } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
  Clapperboard,
  BookOpen,
  ScrollText,
  Users,
  Image as ImageIcon,
  Film,
  Video,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Play,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react"

// The 6 pipeline stages in order
const PIPELINE_STAGES = [
  { key: "story", label: "Expand Story", icon: BookOpen, description: "Expand fact sheet into full narrative" },
  { key: "script", label: "Veo Script", icon: ScrollText, description: "Convert scenes to Veo-structured prompts" },
  { key: "characters", label: "Character Descriptions", icon: Users, description: "Generate visual descriptions for each character" },
  { key: "char_refs", label: "Character References", icon: ImageIcon, description: "Generate character reference images (2×2 grids)" },
  { key: "clip_refs", label: "Clip Reference Frames", icon: Film, description: "Generate start/end reference frames per segment" },
  { key: "veo_clips", label: "Veo Video Clips", icon: Video, description: "Generate 8-second video clips via Veo" },
] as const

type StageKey = typeof PIPELINE_STAGES[number]["key"]

function getCompletedStages(state: VisualAudioState | null): Set<StageKey> {
  const done = new Set<StageKey>()
  if (!state) return done
  if (state.obfuscated_story) done.add("story")
  if (state.veo_script) done.add("script")
  if (state.character_descriptions) done.add("characters")
  if (state.character_ref_images.length > 0) done.add("char_refs")
  if (state.clip_ref_images.length > 0) done.add("clip_refs")
  if (state.veo_clips.length > 0) done.add("veo_clips")
  return done
}

export function PageProduction() {
  const {
    sessionId,
    config,
    visualAudioState,
    setVisualAudioState,
    visualAudioStatus,
    setVisualAudioStatus,
    setCurrentStep,
  } = useApp()

  const [currentStage, setCurrentStage] = useState<StageKey | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const hasAutoStarted = useRef(false)

  const completedStages = getCompletedStages(visualAudioState)

  // Determine the language code from config
  const langMap: Record<string, string> = {
    english: "en",
    malay: "bm",
    chinese: "zh",
    tamil: "ta",
  }
  const languageCode = langMap[config.language] || "en"

  const runFullPipeline = useCallback(async () => {
    if (!sessionId) return
    setVisualAudioStatus("running")
    setError(null)
    setCurrentStage("story")

    try {
      // Run stages incrementally so UI updates progressively
      const stages: (VideoAssetsStage | undefined)[] = [
        "story",
        "script",
        "characters",
        "char_refs",
        "clip_refs",
        undefined, // undefined = run all (including veo_clips)
      ]

      for (const stopAfter of stages) {
        setCurrentStage(
          stopAfter ?? "veo_clips"
        )
        const result = await generateVideoAssets(
          sessionId,
          languageCode,
          stopAfter,
        )
        if (result.visual_audio_state) {
          setVisualAudioState(result.visual_audio_state)
        }
      }

      setVisualAudioStatus("completed")
      setCurrentStage(null)
    } catch (err) {
      console.error("Video assets generation error:", err)
      setError(err instanceof Error ? err.message : "Failed to generate video assets")
      setVisualAudioStatus("error")
      setCurrentStage(null)
    }
  }, [sessionId, languageCode, setVisualAudioState, setVisualAudioStatus])

  // Auto-start pipeline when entering the page if not already done
  useEffect(() => {
    if (
      sessionId &&
      visualAudioStatus === "idle" &&
      !hasAutoStarted.current
    ) {
      hasAutoStarted.current = true
      runFullPipeline()
    }
  }, [sessionId, visualAudioStatus, runFullPipeline])

  function toggleSection(key: string) {
    setExpandedSection((prev) => (prev === key ? null : key))
  }

  const isRunning = visualAudioStatus === "running"
  const isCompleted = visualAudioStatus === "completed"
  const isError = visualAudioStatus === "error"

  // Render loading state
  if (isRunning && !visualAudioState) {
    return (
      <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="size-20 rounded-full flex items-center justify-center bg-purple-500/20 animate-pulse">
            <Loader2 className="size-10 text-purple-500 animate-spin" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Starting Production Pipeline...</h2>
          <p className="text-muted-foreground text-sm text-center max-w-md">
            Generating visual and audio assets from your video package. This involves AI image and video generation — it may take a few minutes.
          </p>
        </div>
      </div>
    )
  }

  // Render no-session state
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

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-foreground text-balance tracking-tight">The Production</h1>
        <p className="text-muted-foreground text-sm">
          Generate visual assets — character references, clip frames, and video clips from your approved script.
        </p>
      </div>

      {/* Pipeline Progress */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <Clapperboard className="size-4 text-purple-400" />
              Production Pipeline
            </CardTitle>
            {isCompleted && (
              <Badge variant="outline" className="text-green-400 border-green-500/30 bg-green-500/10">
                <CheckCircle2 className="size-3 mr-1" />
                Complete
              </Badge>
            )}
            {isError && (
              <Badge variant="outline" className="text-red-400 border-red-500/30 bg-red-500/10">
                <XCircle className="size-3 mr-1" />
                Error
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {PIPELINE_STAGES.map((stage, i) => {
              const Icon = stage.icon
              const isDone = completedStages.has(stage.key)
              const isCurrent = currentStage === stage.key
              const isPending = !isDone && !isCurrent

              return (
                <div
                  key={stage.key}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                    isCurrent
                      ? "border-purple-500/40 bg-purple-500/5"
                      : isDone
                        ? "border-green-500/20 bg-green-500/5"
                        : "border-border bg-secondary/20"
                  )}
                >
                  <div
                    className={cn(
                      "size-8 rounded-full flex items-center justify-center shrink-0",
                      isCurrent
                        ? "bg-purple-500/20"
                        : isDone
                          ? "bg-green-500/20"
                          : "bg-secondary"
                    )}
                  >
                    {isCurrent ? (
                      <Loader2 className="size-4 text-purple-400 animate-spin" />
                    ) : isDone ? (
                      <CheckCircle2 className="size-4 text-green-400" />
                    ) : (
                      <Icon className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-sm font-medium",
                          isCurrent
                            ? "text-purple-300"
                            : isDone
                              ? "text-foreground"
                              : "text-muted-foreground"
                        )}
                      >
                        {i + 1}. {stage.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{stage.description}</p>
                  </div>
                  {isDone && (
                    <Badge variant="outline" className="text-green-400 border-green-500/30 bg-green-500/10 text-xs shrink-0">
                      Done
                    </Badge>
                  )}
                  {isCurrent && (
                    <Badge variant="outline" className="text-purple-400 border-purple-500/30 bg-purple-500/10 text-xs shrink-0">
                      Running
                    </Badge>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

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

      {/* Generated Assets Preview */}
      {visualAudioState && (
        <div className="flex flex-col gap-4">
          {/* Story */}
          {visualAudioState.obfuscated_story && (
            <CollapsibleCard
              title="Expanded Story"
              icon={<BookOpen className="size-4 text-blue-400" />}
              isOpen={expandedSection === "story"}
              onToggle={() => toggleSection("story")}
            >
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Title</p>
                  <p className="text-sm text-foreground">{visualAudioState.obfuscated_story.title}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Narrative</p>
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                    {visualAudioState.obfuscated_story.full_narrative}
                  </p>
                </div>
                {visualAudioState.obfuscated_story.character_roles &&
                  Object.keys(visualAudioState.obfuscated_story.character_roles).length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Characters</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(visualAudioState.obfuscated_story.character_roles).map(
                          ([name, role]) => (
                            <span
                              key={name}
                              className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 border border-blue-500/20 px-3 py-1 text-xs text-blue-300"
                            >
                              <Users className="size-3" />
                              <strong>{name}</strong>: {role}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  )}
              </div>
            </CollapsibleCard>
          )}

          {/* Veo Script */}
          {visualAudioState.veo_script && (
            <CollapsibleCard
              title={`Veo Script — ${visualAudioState.veo_script.segments.length} Segments`}
              icon={<ScrollText className="size-4 text-teal-400" />}
              isOpen={expandedSection === "script"}
              onToggle={() => toggleSection("script")}
            >
              <div className="flex flex-col gap-3">
                {visualAudioState.veo_script.segments.map((seg) => (
                  <div key={seg.segment_id} className="rounded-lg border border-border p-3 bg-secondary/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-teal-400 border-teal-500/30 bg-teal-500/10 text-xs">
                        Segment {seg.segment_id}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{seg.setting}</span>
                    </div>
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap">{seg.veo_prompt}</p>
                    {seg.characters_involved.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {seg.characters_involved.map((c) => (
                          <span key={c} className="text-xs bg-secondary px-2 py-0.5 rounded text-muted-foreground">
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleCard>
          )}

          {/* Character Descriptions */}
          {visualAudioState.character_descriptions && (
            <CollapsibleCard
              title={`Character Descriptions — ${visualAudioState.character_descriptions.characters.length} Characters`}
              icon={<Users className="size-4 text-cyan-400" />}
              isOpen={expandedSection === "characters"}
              onToggle={() => toggleSection("characters")}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {visualAudioState.character_descriptions.characters.map((char) => (
                  <div key={char.character_name} className="rounded-lg border border-border p-3 bg-secondary/10">
                    <p className="text-sm font-semibold text-foreground mb-2">{char.character_name}</p>
                    <div className="flex flex-col gap-1 text-xs">
                      <Detail label="Appearance" value={char.visual_description} />
                      <Detail label="Outfit" value={char.outfit_and_accessories} />
                      <Detail label="Expression" value={char.facial_expression_default} />
                      <Detail label="Posture" value={char.posture_and_mannerisms} />
                      <Detail label="Ethnicity/Age" value={char.ethnicity_and_age} />
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleCard>
          )}

          {/* Character Reference Images */}
          {visualAudioState.character_ref_images.length > 0 && (
            <CollapsibleCard
              title={`Character Reference Images — ${visualAudioState.character_ref_images.length} Characters`}
              icon={<ImageIcon className="size-4 text-pink-400" />}
              isOpen={expandedSection === "char_refs"}
              onToggle={() => toggleSection("char_refs")}
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visualAudioState.character_ref_images.map((ref) => (
                  <div key={ref.character_name} className="flex flex-col gap-2">
                    <p className="text-sm font-medium text-foreground">{ref.character_name}</p>
                    {ref.image_base64 ? (
                      <img
                        src={`data:image/png;base64,${ref.image_base64}`}
                        alt={`${ref.character_name} reference`}
                        className="rounded-lg border border-border w-full aspect-square object-cover"
                      />
                    ) : ref.image_path?.startsWith("/") ? (
                      <img
                        src={ref.image_path}
                        alt={`${ref.character_name} reference`}
                        className="rounded-lg border border-border w-full aspect-square object-cover"
                      />
                    ) : (
                      <div className="rounded-lg border border-border bg-secondary/20 w-full aspect-square flex items-center justify-center">
                        <div className="flex flex-col items-center gap-1 text-muted-foreground">
                          <ImageIcon className="size-8" />
                          <span className="text-xs">Saved to disk</span>
                          <span className="text-xs font-mono truncate max-w-[200px]">{ref.image_path}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleCard>
          )}

          {/* Clip Reference Frames */}
          {visualAudioState.clip_ref_images.length > 0 && (
            <CollapsibleCard
              title={`Clip Reference Frames — ${visualAudioState.clip_ref_images.length} Clips`}
              icon={<Film className="size-4 text-orange-400" />}
              isOpen={expandedSection === "clip_refs"}
              onToggle={() => toggleSection("clip_refs")}
            >
              <div className="flex flex-col gap-4">
                {visualAudioState.clip_ref_images.map((clip) => (
                  <div key={clip.segment_id} className="rounded-lg border border-border p-3 bg-secondary/10">
                    <p className="text-sm font-medium text-foreground mb-2">Segment {clip.segment_id}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Start Frame</p>
                        {clip.start_frame_base64 ? (
                          <img
                            src={`data:image/png;base64,${clip.start_frame_base64}`}
                            alt={`Segment ${clip.segment_id} start`}
                            className="rounded border border-border w-full aspect-video object-cover"
                          />
                        ) : clip.start_frame_path?.startsWith("/") ? (
                          <img
                            src={clip.start_frame_path}
                            alt={`Segment ${clip.segment_id} start`}
                            className="rounded border border-border w-full aspect-video object-cover"
                          />
                        ) : (
                          <div className="rounded border border-border bg-secondary/20 w-full aspect-video flex items-center justify-center text-xs text-muted-foreground">
                            Saved to disk
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">End Frame</p>
                        {clip.end_frame_base64 ? (
                          <img
                            src={`data:image/png;base64,${clip.end_frame_base64}`}
                            alt={`Segment ${clip.segment_id} end`}
                            className="rounded border border-border w-full aspect-video object-cover"
                          />
                        ) : clip.end_frame_path?.startsWith("/") ? (
                          <img
                            src={clip.end_frame_path}
                            alt={`Segment ${clip.segment_id} end`}
                            className="rounded border border-border w-full aspect-video object-cover"
                          />
                        ) : (
                          <div className="rounded border border-border bg-secondary/20 w-full aspect-video flex items-center justify-center text-xs text-muted-foreground">
                            Saved to disk
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleCard>
          )}

          {/* Veo Video Clips */}
          {visualAudioState.veo_clips.length > 0 && (
            <CollapsibleCard
              title={`Generated Video Clips — ${visualAudioState.veo_clips.length} Clips`}
              icon={<Video className="size-4 text-green-400" />}
              isOpen={expandedSection === "veo_clips"}
              onToggle={() => toggleSection("veo_clips")}
            >
              <div className="flex flex-col gap-3">
                {visualAudioState.veo_clips.map((clip) => (
                  <div key={clip.segment_id} className="rounded-lg border border-border p-3 bg-secondary/10">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-foreground">
                        Clip {clip.segment_id}
                      </p>
                      <Badge variant="outline" className="text-green-400 border-green-500/30 bg-green-500/10 text-xs">
                        <CheckCircle2 className="size-3 mr-1" />
                        Generated
                      </Badge>
                    </div>
                    {clip.video_path?.startsWith("/") ? (
                      <video
                        src={clip.video_path}
                        controls
                        className="rounded border border-border w-full aspect-video bg-black"
                        preload="metadata"
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
                        {clip.video_path}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleCard>
          )}
        </div>
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
            Proceed to Safety Review
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ==================== Sub-components ====================

function CollapsibleCard({
  title,
  icon,
  isOpen,
  onToggle,
  children,
}: {
  title: string
  icon: React.ReactNode
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <Card className="border-border bg-card">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-secondary/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-base font-semibold text-foreground">{title}</span>
        </div>
        {isOpen ? (
          <ChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground font-medium">{label}: </span>
      <span className="text-foreground/80">{value}</span>
    </div>
  )
}
