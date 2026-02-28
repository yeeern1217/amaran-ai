"use client"

import { useState } from "react"
import { useApp } from "@/lib/app-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ChatPanel } from "@/components/ui/chat-panel"
import type { ChatMessage } from "@/components/ui/chat-panel"
import { cn } from "@/lib/utils"
import {
  generateSocialStrategy,
  chatSocialStrategy,
  type SocialOutput,
  type SocialCaptionOption,
} from "@/lib/api"
import {
  Loader2,
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  MessageSquareText,
  Image as ImageIcon,
  Hash,
  Copy,
  CheckCircle2,
  Sparkles,
  Instagram,
  RefreshCw,
  Clock,
  Zap,
  Target,
  Eye,
} from "lucide-react"

type SocialSection = "trends" | "captions" | "thumbnail" | "hashtags"

interface ChatMsg {
  role: "user" | "assistant"
  content: string
}

export function PageSocial() {
  const { sessionId, setCurrentStep, socialOutput, setSocialOutput } = useApp()

  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [platform, setPlatform] = useState<string>("instagram")
  const [activeSection, setActiveSection] = useState<SocialSection>("trends")
  const [selectedCaptionIdx, setSelectedCaptionIdx] = useState(0)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Chat state
  const [chatInput, setChatInput] = useState("")
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([])
  const [chatLoading, setChatLoading] = useState(false)

  // Map backend chat messages to ChatPanel format
  const chatMessages: ChatMessage[] = chatHistory.map((msg) => ({
    role: msg.role === "user" ? "user" : "ai",
    text: msg.content,
  }))

  async function handleGenerate() {
    if (!sessionId) return
    setIsGenerating(true)
    setError(null)
    try {
      const res = await generateSocialStrategy(sessionId, platform)
      if (res.social_output) {
        setSocialOutput(res.social_output)
        setSelectedCaptionIdx(res.social_output.selected_caption_index)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate social strategy")
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleChatSend() {
    if (!chatInput.trim() || !sessionId || chatLoading) return
    const userMsg = chatInput.trim()
    setChatInput("")
    const newHistory: ChatMsg[] = [...chatHistory, { role: "user", content: userMsg }]
    setChatHistory(newHistory)
    setChatLoading(true)
    try {
      const res = await chatSocialStrategy(
        sessionId,
        userMsg,
        activeSection,
        platform,
        newHistory.slice(-10)
      )
      setChatHistory([...newHistory, { role: "assistant", content: res.response }])
      if (res.updated && res.social_output) {
        setSocialOutput(res.social_output)
      }
    } catch {
      setChatHistory([
        ...newHistory,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 6000)
  }

  const platforms = [
    { id: "instagram", label: "Instagram", icon: Instagram },
    { id: "tiktok", label: "TikTok", icon: Zap },
    { id: "facebook", label: "Facebook", icon: Target },
    { id: "x", label: "X", icon: MessageSquareText },
  ]

  const sections: { id: SocialSection; label: string; icon: typeof TrendingUp }[] = [
    { id: "trends", label: "Trend Analysis", icon: TrendingUp },
    { id: "captions", label: "Captions", icon: MessageSquareText },
    { id: "thumbnail", label: "Thumbnail", icon: ImageIcon },
    { id: "hashtags", label: "Hashtags", icon: Hash },
  ]

  // === Not yet generated state ===
  if (!socialOutput) {
    return (
      <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Social Media Strategy</h1>
          <p className="text-muted-foreground text-sm">
            Generate captions, hashtags, thumbnail recommendations, and trend analysis for your anti-scam video.
          </p>
        </div>

        {/* Platform Selection */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Target className="size-4 text-teal-400" />
              Select Platform
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {platforms.map((p) => {
                const Icon = p.icon
                return (
                  <button
                    key={p.id}
                    onClick={() => setPlatform(p.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                      platform === p.id
                        ? "bg-primary/15 text-primary border border-primary/30 shadow-[0_0_10px_oklch(0.87_0.17_175/0.12)]"
                        : "bg-secondary/50 text-muted-foreground hover:bg-secondary/80 border border-transparent"
                    )}
                  >
                    <Icon className="size-4" />
                    {p.label}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setCurrentStep(6)}>
            <ArrowLeft className="size-4 mr-1" /> Back
          </Button>
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={isGenerating || !sessionId}
            className="bg-primary text-primary-foreground"
          >
            {isGenerating ? (
              <>
                <Loader2 className="size-4 mr-1 animate-spin" /> Generating...
              </>
            ) : (
              <>
                <Sparkles className="size-4 mr-1" /> Generate Social Strategy
              </>
            )}
          </Button>
        </div>
      </div>
    )
  }

  // === Generated state — show the full strategy ===
  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Social Media Strategy</h1>
          <p className="text-muted-foreground text-sm">
            Review and refine your posting strategy. Chat with AI to iterate on any section.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-teal-400 border-teal-500/30 bg-teal-500/10">
            {socialOutput.platform}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            <RefreshCw className={cn("size-3.5 mr-1", isGenerating && "animate-spin")} />
            Regenerate
          </Button>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-1 border-b border-border/40 pb-0">
        {sections.map((s) => {
          const Icon = s.icon
          return (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-[1px]",
                activeSection === s.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {s.label}
            </button>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Main Content Area */}
        <div className="flex flex-col gap-4">
          {activeSection === "trends" && <TrendsPanel data={socialOutput} />}
          {activeSection === "captions" && (
            <CaptionsPanel
              captions={socialOutput.captions}
              selectedIdx={selectedCaptionIdx}
              onSelect={setSelectedCaptionIdx}
              onCopy={copyToClipboard}
              copiedField={copiedField}
            />
          )}
          {activeSection === "thumbnail" && <ThumbnailPanel data={socialOutput} />}
          {activeSection === "hashtags" && (
            <HashtagsPanel
              data={socialOutput}
              onCopy={copyToClipboard}
              copiedField={copiedField}
            />
          )}
        </div>

        {/* Chat Sidebar */}
        <div className="h-fit sticky top-20">
          <ChatPanel
            title="Refine with AI"
            messages={chatMessages}
            input={chatInput}
            onInputChange={setChatInput}
            onSend={handleChatSend}
            isLoading={chatLoading}
            disabled={!sessionId}
            placeholder={`Refine ${sections.find(s => s.id === activeSection)?.label.toLowerCase()}...`}
            emptyStateText={`Tell the AI what to change. e.g. "Make captions more urgent"`}
            headerExtra={
              <p className="text-xs text-muted-foreground mt-1">
                Editing: <span className="text-primary font-medium">{sections.find(s => s.id === activeSection)?.label}</span>
              </p>
            }
          />
        </div>
      </div>

      {/* Navigation */}
      <Separator />
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setCurrentStep(6)}>
          <ArrowLeft className="size-4 mr-1" /> Back to Screening Room
        </Button>
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">
            Strategy ready for posting
          </p>
          <Badge variant="outline" className="text-green-400 border-green-500/30 bg-green-500/10">
            <CheckCircle2 className="size-3 mr-1" /> Complete
          </Badge>
        </div>
      </div>
    </div>
  )
}

// ==================== Sub-panels ====================

function TrendsPanel({ data }: { data: SocialOutput }) {
  const t = data.trend_analysis

  // Parse viral_potential: split "High — explanation" into level + detail
  const viralParts = t.viral_potential.split(/\s*[—–-]\s*([\s\S]*)/)

  const viralLevel = viralParts[0]?.trim() || t.viral_potential
  const viralDetail = viralParts[1]?.trim() || ""
  const viralLower = viralLevel.toLowerCase()

  return (
    <div className="flex flex-col gap-4 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="size-4 text-teal-400" />
            Trend Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {/* Viral Potential */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground shrink-0">Viral Potential:</span>
              <Badge
                variant="outline"
                className={cn(
                  viralLower.startsWith("high")
                    ? "text-green-400 border-green-500/30 bg-green-500/10"
                    : viralLower.startsWith("medium")
                      ? "text-yellow-400 border-yellow-500/30 bg-yellow-500/10"
                      : "text-muted-foreground border-border bg-secondary/50"
                )}
              >
                {viralLevel.toUpperCase()}
              </Badge>
            </div>
            {viralDetail && (
              <p className="text-xs text-muted-foreground leading-relaxed ml-0">
                {viralDetail}
              </p>
            )}
          </div>

          {/* Content Angle */}
          <div>
            <p className="text-sm font-medium text-foreground mb-1">Recommended Angle</p>
            <p className="text-sm text-muted-foreground bg-secondary/40 rounded-lg px-3 py-2">
              {t.content_angle || "No specific angle recommended."}
            </p>
          </div>

          {/* Posting Time */}
          <div className="flex items-start gap-2">
            <Clock className="size-4 text-muted-foreground mt-0.5 shrink-0" />
            <span className="text-sm text-muted-foreground shrink-0">Best Time:</span>
            <span className="text-sm text-foreground">{t.recommended_posting_time || "Not specified"}</span>
          </div>

          {/* Trending Topics */}
          {t.trending_topics.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-1.5">Trending Topics</p>
              <div className="flex flex-wrap gap-1.5">
                {t.trending_topics.map((topic, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Trend Hooks */}
          {t.trend_hooks.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-1.5">Trend Hooks to Leverage</p>
              <ul className="space-y-1">
                {t.trend_hooks.map((hook, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <Zap className="size-3.5 text-yellow-400 mt-0.5 shrink-0" />
                    {hook}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function CaptionsPanel({
  captions,
  selectedIdx,
  onSelect,
  onCopy,
  copiedField,
}: {
  captions: SocialCaptionOption[]
  selectedIdx: number
  onSelect: (i: number) => void
  onCopy: (text: string, field: string) => void
  copiedField: string | null
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  // Parse engagement level from "High — explanation" format
  function parseEngagement(val: string) {
    const parts = val.split(/\s*[—–-]\s*/)
    return parts[0]?.trim() || val
  }

  return (
    <div className="flex flex-col gap-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
      {captions.map((cap, i) => {
        const engLevel = parseEngagement(cap.estimated_engagement).toLowerCase()
        const isExpanded = expandedIdx === i
        return (
          <Card
            key={i}
            className={cn(
              "border-border bg-card cursor-pointer transition-all",
              selectedIdx === i && "border-primary/40 shadow-[0_0_12px_oklch(0.87_0.17_175/0.1)]"
            )}
            onClick={() => onSelect(i)}
          >
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs capitalize",
                      selectedIdx === i
                        ? "text-primary border-primary/30"
                        : "text-muted-foreground"
                    )}
                  >
                    {cap.style}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs capitalize",
                      engLevel.startsWith("high")
                        ? "text-green-400 border-green-500/30"
                        : engLevel.startsWith("medium")
                          ? "text-yellow-400 border-yellow-500/30"
                          : "text-muted-foreground"
                    )}
                  >
                    <Eye className="size-3 mr-1" />
                    {parseEngagement(cap.estimated_engagement)}
                  </Badge>
                  {selectedIdx === i && (
                    <Badge className="text-xs bg-primary/20 text-primary border-0">
                      <CheckCircle2 className="size-3 mr-1" /> Selected
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={(e) => {
                    e.stopPropagation()
                    onCopy(cap.caption, `caption-${i}`)
                  }}
                >
                  {copiedField === `caption-${i}` ? (
                    <CheckCircle2 className="size-3.5 text-green-400" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
              </div>
              <div
                className={cn(
                  "text-sm text-foreground whitespace-pre-wrap leading-relaxed",
                  !isExpanded && "line-clamp-4"
                )}
              >
                {cap.caption}
              </div>
              {cap.caption.split("\n").length > 4 && (
                <button
                  className="text-xs text-primary hover:underline mt-1"
                  onClick={(e) => {
                    e.stopPropagation()
                    setExpandedIdx(isExpanded ? null : i)
                  }}
                >
                  {isExpanded ? "Show less" : "Show more"}
                </button>
              )}
              {cap.call_to_action && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  CTA: <span className="text-foreground">{cap.call_to_action}</span>
                </p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function ThumbnailPanel({ data }: { data: SocialOutput }) {
  const thumb = data.thumbnail
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <ImageIcon className="size-4 text-teal-400" />
          Thumbnail Recommendation
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Recommended Scene */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Source Scene:</span>
          <Badge variant="outline" className="text-primary border-primary/30">
            Scene {thumb.recommended_scene_id}
          </Badge>
        </div>

        {/* Text Overlay */}
        {thumb.text_overlay && (
          <div>
            <p className="text-sm font-medium text-foreground mb-1">Text Overlay</p>
            <div className="bg-secondary/60 rounded-lg px-4 py-3 text-center">
              <p className="text-lg font-bold text-foreground">{thumb.text_overlay}</p>
            </div>
          </div>
        )}

        {/* Thumbnail Prompt */}
        <div>
          <p className="text-sm font-medium text-foreground mb-1">Visual Prompt</p>
          <p className="text-sm text-muted-foreground bg-secondary/40 rounded-lg px-3 py-2">
            {thumb.thumbnail_prompt}
          </p>
        </div>

        {/* Rationale */}
        <div>
          <p className="text-sm font-medium text-foreground mb-1">Why This Works</p>
          <p className="text-sm text-muted-foreground">{thumb.rationale}</p>
        </div>

        {/* Style Notes */}
        {thumb.style_notes && (
          <div>
            <p className="text-sm font-medium text-foreground mb-1">Style Notes</p>
            <p className="text-sm text-muted-foreground">{thumb.style_notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function HashtagsPanel({
  data,
  onCopy,
  copiedField,
}: {
  data: SocialOutput
  onCopy: (text: string, field: string) => void
  copiedField: string | null
}) {
  const h = data.hashtags

  function HashtagGroup({ label, tags, color }: { label: string; tags: string[]; color: string }) {
    if (tags.length === 0) return null
    return (
      <div>
        <p className="text-sm font-medium text-foreground mb-2">{label}</p>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag, i) => (
            <Badge key={i} variant="outline" className={cn("text-xs", color)}>
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    )
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Hash className="size-4 text-teal-400" />
            Hashtag Strategy
            <Badge variant="outline" className="text-xs text-muted-foreground ml-1">
              {h.total_count} total
            </Badge>
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="h-7"
            onClick={() => onCopy(h.hashtag_string, "hashtags-all")}
          >
            {copiedField === "hashtags-all" ? (
              <>
                <CheckCircle2 className="size-3.5 mr-1 text-green-400" /> Copied
              </>
            ) : (
              <>
                <Copy className="size-3.5 mr-1" /> Copy All
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <HashtagGroup label="Primary" tags={h.primary_hashtags} color="text-primary border-primary/30" />
        <HashtagGroup label="Trending" tags={h.trending_hashtags} color="text-yellow-400 border-yellow-500/30" />
        <HashtagGroup label="Niche / Community" tags={h.niche_hashtags} color="text-blue-400 border-blue-500/30" />
        <HashtagGroup label="Branded" tags={h.branded_hashtags} color="text-purple-400 border-purple-500/30" />

        {/* Copy-ready string */}
        <div>
          <p className="text-sm font-medium text-foreground mb-1">Ready to Paste</p>
          <div className="bg-secondary/40 rounded-lg px-3 py-2 text-xs text-muted-foreground break-all">
            {h.hashtag_string}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
