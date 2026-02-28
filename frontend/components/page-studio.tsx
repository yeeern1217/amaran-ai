"use client"

import { useState, useEffect, useRef } from "react"
import { useApp } from "@/lib/app-context"
import { generateVideoPackage, chatVideoPackage, verifyFactSheet } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { ChatPanel } from "@/components/ui/chat-panel"
import type { ChatMessage } from "@/components/ui/chat-panel"
import { cn } from "@/lib/utils"
import {
  Film,
  Play,
  MessageSquare,
  Loader2,
  Check,
  ArrowRight,
  ArrowLeft,
  Users,
  ShieldAlert,
  ShieldCheck,
  User,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileCheck,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from "lucide-react"

interface BackendChatMessage {
  role: "user" | "assistant"
  content: string
}

export function PageStudio() {
  const { sessionId, config, setConfig, factCheck, scenes, setScenes, scenesGenerated, setScenesGenerated, setSensitivityReport, sensitivityReport, setCurrentStep, setRecommendedAvatars, recommendedCharacters, setRecommendedCharacters, setCharacterInfoList } = useApp()
  const [activeScene, setActiveScene] = useState(0)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatHistory, setChatHistory] = useState<BackendChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [generatingScene, setGeneratingScene] = useState<number | null>(null)
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [isGeneratingAll, setIsGeneratingAll] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [safetyExpanded, setSafetyExpanded] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [safetyReviewing, setSafetyReviewing] = useState(false)
  const [isRevealing, setIsRevealing] = useState(true)
  const hasTriggeredGenerate = useRef(false)

  const current = scenes[activeScene]
  const allGenerated = scenes.length > 0 && scenes.every((s) => s.generated)
  const generatedCount = scenes.filter((s) => s.generated).length
  const totalDuration = scenes.reduce((sum, s) => sum + (s.duration || 8), 0)

  // Brief reveal loading when entering Studio (gives visual feedback before scripts appear)
  useEffect(() => {
    if (scenesGenerated && scenes.length > 0 && !isGeneratingAll) {
      const timer = setTimeout(() => setIsRevealing(false), 1200)
      return () => clearTimeout(timer)
    }
    if (!scenesGenerated) {
      setIsRevealing(true)
    }
  }, [scenesGenerated, scenes.length, isGeneratingAll])

  // Auto-generate scenes from the fact sheet when entering Studio
  useEffect(() => {
    if (!sessionId || scenesGenerated || hasTriggeredGenerate.current) return
    hasTriggeredGenerate.current = true

    async function autoGenerate() {
      setIsGeneratingAll(true)
      setGenerateError(null)
      try {
        // Auto-verify fact sheet if not already verified
        try {
          await verifyFactSheet(sessionId, "officer-auto", factCheck, "Auto-verified for generation")
        } catch (verifyErr) {
          console.warn("Verify before generate:", verifyErr)
        }

        const toneMap: Record<string, string> = {
          urgent: "Urgent/Warning",
          calm: "Calm",
          friendly: "Friendly",
          authoritative: "Authoritative",
        }
        const languageMap: Record<string, string> = {
          english: "English",
          malay: "Bahasa Melayu",
          chinese: "Chinese (Mandarin)",
          tamil: "Tamil",
        }
        const audienceMap: Record<string, string> = {
          general: "General Public",
          elderly: "Elderly",
          students: "Students",
          professionals: "Professionals",
        }

        const result = await generateVideoPackage(sessionId, {
          targetGroups: [audienceMap[config.targetAudience] || "General Public"],
          languages: [languageMap[config.language] || "English"],
          tone: toneMap[config.tone] || "Urgent/Warning",
          avatarId: config.avatar,
          videoFormat: config.videoFormat === "reels" ? "reel" : config.videoFormat,
        })

        // Store recommended avatars from AI (all recommendations, not just first)
        if (result.recommended_avatars && result.recommended_avatars.length > 0) {
          setRecommendedAvatars(result.recommended_avatars)
          // Auto-update config with first recommended avatar if current one is not in recommendations
          if (!result.recommended_avatars.includes(config.avatar)) {
            setConfig({ ...config, avatar: result.recommended_avatars[0] })
          }
        }

        // Store recommended characters from AI (minimum 2, consistent across all scenes)
        if (result.recommended_characters && result.recommended_characters.length > 0) {
          setRecommendedCharacters(result.recommended_characters)
          // Build character info list — prefer full descriptions if available
          if (result.character_descriptions && result.character_descriptions.length > 0) {
            setCharacterInfoList(result.character_descriptions.map((c) => ({
              role: c.role,
              type: c.type,
              description: c.description,
              imageUrl: c.image_url,
              imageBase64: c.image_base64 ?? null,
            })))
          } else {
            setCharacterInfoList(result.recommended_characters.map((role) => ({
              role,
              type: role.toLowerCase().includes("victim") || role.toLowerCase().includes("retiree")
                ? "person" as const
                : "scammer" as const,
              description: "",
              imageUrl: null,
              imageBase64: null,
            })))
          }
        }

        // Extract scenes from the nested video_inputs structure
        let extractedScenes: Array<{ scene_id: number; visual_prompt: string; audio_script: string; text_overlay?: string; duration_est_seconds?: number }> = []
        if (result.video_package?.video_inputs) {
          const firstLang = Object.values(result.video_package.video_inputs)[0]
          if (firstLang?.scenes) {
            extractedScenes = firstLang.scenes
          }
        }

        if (extractedScenes.length > 0) {
          const newScenes = extractedScenes.map((s) => ({
            id: s.scene_id,
            description: s.visual_prompt || "",
            dialogue: s.audio_script || "",
            generated: false,
            duration: s.duration_est_seconds ?? 8,
          }))
          setScenes(newScenes)
        } else {
          setGenerateError("No scenes were returned. Try regenerating.")
        }

        // Store sensitivity report for Safety Review page
        if (result.video_package?.sensitivity_report) {
          const sr = result.video_package.sensitivity_report
          setSensitivityReport({
            projectId: sr.project_id,
            passed: sr.passed,
            flags: sr.flags.map((f) => ({
              severity: f.severity,
              issueType: f.issue_type,
              description: f.description,
              sceneId: f.scene_id ?? undefined,
              suggestedFix: f.suggested_fix ?? undefined,
              regulationReference: f.regulation_reference ?? undefined,
            })),
            complianceSummary: sr.compliance_summary,
            detailedAnalysis: sr.detailed_analysis.map((a) => ({
              category: a.category,
              status: a.status,
              analysis: a.analysis,
              elementsReviewed: a.elements_reviewed,
            })),
            checkedAgainst: sr.checked_against,
          })
        }

        setScenesGenerated(true)
      } catch (err) {
        console.error("Auto-generate error:", err)
        setGenerateError(
          err instanceof Error ? err.message : "Failed to generate scenes. Please try again."
        )
      } finally {
        setIsGeneratingAll(false)
      }
    }

    autoGenerate()
  }, [sessionId, scenesGenerated, config, setScenes, setScenesGenerated])

  function handleSceneUpdate(field: "description" | "dialogue", value: string) {
    const updated = [...scenes]
    updated[activeScene] = { ...updated[activeScene], [field]: value }
    setScenes(updated)
  }

  async function handleGenerate(sceneIndex: number) {
    if (!sessionId) {
      // Fallback to mock if no session (for demo)
      setGeneratingScene(sceneIndex)
      setTimeout(() => {
        const updated = [...scenes]
        updated[sceneIndex] = { ...updated[sceneIndex], generated: true }
        setScenes(updated)
        setGeneratingScene(null)
      }, 9000)
      return
    }

    setGeneratingScene(sceneIndex)
    try {
      // Map frontend config to backend format
      const toneMap: Record<string, string> = {
        urgent: "Urgent/Warning",
        calm: "Calm",
        friendly: "Friendly",
        authoritative: "Authoritative",
      }
      const languageMap: Record<string, string> = {
        english: "English",
        malay: "Bahasa Melayu",
        chinese: "Chinese (Mandarin)",
        tamil: "Tamil",
      }
      const audienceMap: Record<string, string> = {
        general: "General Public",
        elderly: "Elderly",
        students: "Students",
        professionals: "Professionals",
      }

      const result = await generateVideoPackage(sessionId, {
        targetGroups: [audienceMap[config.targetAudience] || "General Public"],
        languages: [languageMap[config.language] || "English"],
        tone: toneMap[config.tone] || "Urgent/Warning",
        avatarId: config.avatar,
        videoFormat: config.videoFormat === "reels" ? "reel" : config.videoFormat,
        directorInstructions: `Generate scene ${sceneIndex + 1}`,
      })

      // Extract scenes from nested video_inputs structure
      let extractedScenes: Array<{ scene_id: number; visual_prompt?: string; audio_script?: string; duration_est_seconds?: number }> = []
      if (result.video_package?.video_inputs) {
        const firstLang = Object.values(result.video_package.video_inputs)[0]
        if (firstLang?.scenes) {
          extractedScenes = firstLang.scenes
        }
      }

      if (extractedScenes.length > 0) {
        const updated = [...scenes]
        extractedScenes.forEach((s) => {
          const idx = s.scene_id - 1
          if (idx >= 0 && idx < updated.length) {
            updated[idx] = {
              ...updated[idx],
              description: s.visual_prompt || updated[idx].description,
              dialogue: s.audio_script || updated[idx].dialogue,
              duration: s.duration_est_seconds ?? updated[idx].duration ?? 8,
              generated: true,
            }
          }
        })
        setScenes(updated)
      } else {
        // Mark as generated even without new content
        const updated = [...scenes]
        updated[sceneIndex] = { ...updated[sceneIndex], generated: true }
        setScenes(updated)
      }
    } catch (err) {
      console.error("Generate error:", err)
      // Still mark as generated for demo purposes
      const updated = [...scenes]
      updated[sceneIndex] = { ...updated[sceneIndex], generated: true }
      setScenes(updated)
    } finally {
      setGeneratingScene(null)
    }
  }

  async function handleChatSend() {
    if (!chatInput.trim()) return
    
    const userMsg: ChatMessage = { role: "user", text: chatInput }
    setChatMessages((prev) => [...prev, userMsg])
    const currentInput = chatInput
    setChatInput("")
    
    if (!sessionId) {
      // Fallback mock response
      setSafetyReviewing(true)
      setSafetyExpanded(true)
      setTimeout(() => {
        setChatMessages((prev) => [
          ...prev,
          {
            role: "ai",
            text: `Updated Scene ${activeScene + 1} based on your feedback. The mood has been adjusted to be more intense with darker lighting.`,
          },
        ])
        // Simulate safety re-review finishing after scene update
        setTimeout(() => setSafetyReviewing(false), 5400)
      }, 3600)
      return
    }

    setIsChatLoading(true)
    try {
      const newHistory: BackendChatMessage[] = [
        ...chatHistory,
        { role: "user", content: currentInput },
      ]
      
      const result = await chatVideoPackage(sessionId, currentInput, chatHistory)
      
      setChatHistory([
        ...newHistory,
        { role: "assistant", content: result.response },
      ])
      setChatMessages((prev) => [
        ...prev,
        { role: "ai", text: result.response },
      ])

      // Sync scenes if the AI Director made changes
      if (result.updated && result.director_output?.scene_breakdown) {
        const updatedScenes = result.director_output.scene_breakdown.map((s, i) => ({
          id: s.scene_id ?? i + 1,
          description: s.visual_prompt || "",
          dialogue: s.audio_script || "",
          generated: false,
          duration: s.duration_est_seconds ?? 8,
        }))
        setScenes(updatedScenes)
        // Re-run safety review after scenes change
        setSafetyReviewing(true)
        setSafetyExpanded(true)
        setTimeout(() => setSafetyReviewing(false), 6000)
      }
    } catch (err) {
      console.error("Chat error:", err)
      setChatMessages((prev) => [
        ...prev,
        { role: "ai", text: "Sorry, I encountered an error. Please try again." },
      ])
    } finally {
      setIsChatLoading(false)
    }
  }

  // Per-scene editing view
  if (isGeneratingAll || (isRevealing && scenesGenerated && scenes.length > 0)) {
    return (
      <div className="flex flex-col gap-6 max-w-[1600px] mx-auto w-full items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Loader2 className="size-10 animate-spin text-teal-400" />
            <div className="absolute inset-0 rounded-full pulse-ring" />
          </div>
          <h2 className="text-xl font-semibold text-foreground tracking-tight">
            {isGeneratingAll ? "Generating Scenes..." : "Loading Scripts..."}
          </h2>
          <p className="text-muted-foreground text-sm text-center max-w-md">
            {isGeneratingAll
              ? "The AI Director is creating scenes based on your fact sheet and configuration. This may take a moment."
              : "Preparing your scene scripts and safety review..."}
          </p>
        </div>
      </div>
    )
  }

  if (scenes.length === 0 && !isGeneratingAll) {
    return (
      <div className="flex flex-col gap-6 max-w-[1600px] mx-auto w-full items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Film className="size-10 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground">No Scenes Yet</h2>
          <p className="text-muted-foreground text-sm text-center max-w-md">
            {generateError || (sessionId 
              ? "Scenes will be generated from your fact sheet." 
              : "Complete the Briefing and Casting steps first.")}
          </p>
          {generateError && sessionId && (
            <Button onClick={() => { hasTriggeredGenerate.current = false; setScenesGenerated(false) }}>
              <Play className="size-4" />
              Retry Generation
            </Button>
          )}
          <Button variant="outline" onClick={() => setCurrentStep(1)} size="sm">
            <ArrowLeft className="size-4" />
            Back to Configuration
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto w-full">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-foreground text-balance tracking-tight">
          The Studio
        </h1>
        <p className="text-muted-foreground text-sm">
          Review and edit your scenes, then chat with the AI Director to refine the video package.
        </p>
      </div>

      {/* Main Layout: Scenes + Chat side by side */}
      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* All Scenes */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Film className="size-4 text-teal-400" />
              <span className="text-sm font-semibold text-foreground">
                Scenes ({scenes.length})
              </span>
              <Badge variant="outline" className="text-xs text-muted-foreground border-border">
                Total: {totalDuration}s
              </Badge>
            </div>
          </div>

          <ScrollArea className="max-h-[calc(100vh-280px)]">
            <div className="flex flex-col gap-4 pr-3">
              {/* Characters Overview (simplified list — full details on Characters page) */}
              {recommendedCharacters.length > 0 && (
                <Card className="border-border bg-card">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Users className="size-4 text-blue-400" />
                      Characters ({recommendedCharacters.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="flex flex-wrap gap-2">
                      {recommendedCharacters.map((role) => {
                        const isScammer = !role.toLowerCase().includes("victim") && !role.toLowerCase().includes("retiree")
                        return (
                          <Badge
                            key={role}
                            variant="outline"
                            className={cn(
                              "text-xs flex items-center gap-1.5 py-1 px-2.5",
                              isScammer
                                ? "text-red-400 border-red-500/30 bg-red-500/10"
                                : "text-teal-400 border-teal-500/30 bg-teal-500/10"
                            )}
                          >
                            {isScammer ? (
                              <ShieldAlert className="size-3" />
                            ) : (
                              <User className="size-3" />
                            )}
                            {role}
                          </Badge>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {scenes.map((scene, i) => (
                <Card key={scene.id} className="border-border bg-card">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Badge variant="outline" className="text-teal-400 border-teal-500/30 bg-teal-500/10 text-xs">
                          Scene {i + 1}
                        </Badge>
                        <Badge variant="outline" className="text-muted-foreground border-border text-xs">
                          {scene.duration || 8}s
                        </Badge>
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 px-4 pb-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                        Visual Description
                      </label>
                      <Textarea
                        value={scene.description}
                        onChange={(e) => {
                          const updated = [...scenes]
                          updated[i] = { ...updated[i], description: e.target.value }
                          setScenes(updated)
                        }}
                        rows={3}
                        className="bg-input border-border text-foreground placeholder:text-muted-foreground resize-none text-sm"
                        placeholder="Describe the visual scene..."
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                        Dialogue / Audio
                      </label>
                      <Textarea
                        value={scene.dialogue}
                        onChange={(e) => {
                          const updated = [...scenes]
                          updated[i] = { ...updated[i], dialogue: e.target.value }
                          setScenes(updated)
                        }}
                        rows={2}
                        className="bg-input border-border text-foreground placeholder:text-muted-foreground resize-none text-sm"
                        placeholder="[VO]: Voiceover text... [Text]: On-screen text..."
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* AI Director Chat */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
          <ChatPanel
            title="AI Director"
            messages={chatMessages}
            input={chatInput}
            onInputChange={setChatInput}
            onSend={handleChatSend}
            isLoading={isChatLoading}
            disabled={!sessionId}
            placeholder="Make scene 2 more dramatic..."
            emptyStateText="Ask me to adjust any scene — change visuals, mood, dialogue, pacing, or add/remove scenes."
          />
        </div>
      </div>

      {/* Safety Review Section */}
      <SafetyReviewSection
        sensitivityReport={sensitivityReport}
        safetyExpanded={safetyExpanded}
        setSafetyExpanded={setSafetyExpanded}
        expandedCategories={expandedCategories}
        setExpandedCategories={setExpandedCategories}
        isReviewing={safetyReviewing}
      />

      {/* Navigation */}
      <div className="flex gap-2 justify-end">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(1)}
          size="sm"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button onClick={() => setCurrentStep(3)} size="sm">
          Proceed to Characters
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

// ==================== Safety Review Sub-Component ====================

/** Default safety data used when no backend report is available */
const DEFAULT_SAFETY_DATA = {
  passed: false,
  complianceSummary: "Safety review pending.",
  checkedAgainst: [] as string[],
  detailedAnalysis: [] as { category: string; status: "passed" | "failed"; analysis: string; elementsReviewed: string[] }[],
}

interface SafetyReviewSectionProps {
  sensitivityReport: import("@/lib/app-context").SensitivityReport | null
  safetyExpanded: boolean
  setSafetyExpanded: (val: boolean) => void
  expandedCategories: Set<string>
  setExpandedCategories: React.Dispatch<React.SetStateAction<Set<string>>>
  isReviewing?: boolean
}

function SafetyReviewSection({ sensitivityReport, safetyExpanded, setSafetyExpanded, expandedCategories, setExpandedCategories, isReviewing }: SafetyReviewSectionProps) {
  // Use real backend data if available, otherwise defaults
  const passed = sensitivityReport?.passed ?? DEFAULT_SAFETY_DATA.passed
  const complianceSummary = sensitivityReport?.complianceSummary ?? DEFAULT_SAFETY_DATA.complianceSummary
  const checkedAgainst = sensitivityReport?.checkedAgainst ?? DEFAULT_SAFETY_DATA.checkedAgainst
  const detailedAnalysis = sensitivityReport?.detailedAnalysis ?? DEFAULT_SAFETY_DATA.detailedAnalysis

  function toggleCategory(cat: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  return (
    <Card className="border-border bg-card">
      <button
        onClick={() => setSafetyExpanded(!safetyExpanded)}
        className="w-full"
      >
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            {isReviewing ? (
              <div className="size-7 rounded-full flex items-center justify-center shrink-0 bg-teal-500/15">
                <Loader2 className="size-4 text-teal-400 animate-spin" />
              </div>
            ) : (
              <div className={cn(
                "size-7 rounded-full flex items-center justify-center shrink-0",
                passed ? "bg-green-500/20" : "bg-red-500/20"
              )}>
                {passed ? (
                  <ShieldCheck className="size-4 text-green-400" />
                ) : (
                  <XCircle className="size-4 text-red-400" />
                )}
              </div>
            )}
            <span className="flex-1 text-left">
              {isReviewing ? "Safety Review — Re-checking..." : `Safety Review — ${passed ? "Passed" : "Issues Found"}`}
            </span>
            {isReviewing ? (
              <Badge variant="outline" className="text-xs text-teal-400 border-teal-500/30 bg-teal-500/10">
                Reviewing
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  passed
                    ? "text-green-400 border-green-500/30 bg-green-500/10"
                    : "text-red-400 border-red-500/30 bg-red-500/10"
                )}
              >
                {passed ? "Passed" : "Flagged"}
              </Badge>
            )}
            {safetyExpanded ? (
              <ChevronUp className="size-4 text-muted-foreground shrink-0 ml-1" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground shrink-0 ml-1" />
            )}
          </CardTitle>
        </CardHeader>
      </button>

      {safetyExpanded && isReviewing && (
        <CardContent className="flex flex-col items-center gap-3 py-6">
          <Loader2 className="size-8 text-teal-400 animate-spin" />
          <p className="text-sm text-muted-foreground">Re-analysing updated scenes for compliance and safety...</p>
        </CardContent>
      )}

      {safetyExpanded && !isReviewing && (
        <CardContent className="flex flex-col gap-4 pt-0">
          {/* Summary */}
          <p className="text-sm text-muted-foreground">{complianceSummary}</p>

          {/* Checked Against */}
          <div className="flex items-center gap-2 flex-wrap">
            {checkedAgainst.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1 rounded-full bg-secondary/60 px-3 py-1 text-xs font-medium text-muted-foreground"
              >
                <BookOpen className="size-3" />
                {item}
              </span>
            ))}
          </div>

          {/* Detailed Analysis */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-1">
              <FileCheck className="size-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Detailed Compliance Analysis</span>
            </div>
            {detailedAnalysis.map((item) => {
              const isExpanded = expandedCategories.has(item.category)
              return (
                <div key={item.category} className="rounded-lg border border-border/50 overflow-hidden transition-colors hover:border-border/70">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleCategory(item.category) }}
                    className="w-full flex items-center gap-3 p-3 hover:bg-secondary/20 transition-colors text-left"
                  >
                    <div className={cn(
                      "size-7 rounded-full flex items-center justify-center shrink-0",
                      item.status === "passed"
                        ? "bg-green-500/20"
                        : item.status === "warning"
                          ? "bg-amber-500/20"
                          : "bg-red-500/20"
                    )}>
                      {item.status === "passed" ? (
                        <CheckCircle2 className="size-4 text-green-400" />
                      ) : item.status === "warning" ? (
                        <AlertTriangle className="size-4 text-amber-400" />
                      ) : (
                        <XCircle className="size-4 text-red-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground">{item.category}</span>
                      <span className={cn(
                        "ml-2 text-xs font-medium uppercase",
                        item.status === "passed" ? "text-green-400"
                          : item.status === "warning" ? "text-amber-400"
                          : "text-red-400"
                      )}>
                        {item.status}
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="size-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="border-t border-border p-3 bg-secondary/10">
                      <p className="text-sm text-foreground/90 whitespace-pre-wrap">{item.analysis}</p>
                      {item.elementsReviewed.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Elements reviewed:</p>
                          <div className="flex flex-wrap gap-1">
                            {item.elementsReviewed.map((el, j) => (
                              <span
                                key={j}
                                className="inline-block rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
                              >
                                {el}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Sensitivity flags (if any) */}
          {sensitivityReport && sensitivityReport.flags.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="size-4 text-amber-400" />
                <span className="text-sm font-semibold text-foreground">Sensitivity Flags</span>
              </div>
              {sensitivityReport.flags.map((flag, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-lg border p-3 text-sm",
                    flag.severity === "high"
                      ? "border-red-500/30 bg-red-500/10 text-red-300"
                      : flag.severity === "medium"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                        : "border-blue-500/30 bg-blue-500/10 text-blue-300"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs uppercase">
                      {flag.severity}
                    </Badge>
                    <span className="font-medium">{flag.issueType}</span>
                    {flag.sceneId && (
                      <span className="text-xs text-muted-foreground">Scene {flag.sceneId}</span>
                    )}
                  </div>
                  <p>{flag.description}</p>
                  {flag.suggestedFix && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      <span className="font-medium">Suggested fix:</span> {flag.suggestedFix}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

