"use client"

import { useState, useRef, useEffect } from "react"
import { useApp } from "@/lib/app-context"
import {
  submitIntake,
  submitIntakeStream,
  verifyFactSheet,
  chatFactSheet,
  type FrontendFactCheck,
} from "@/lib/api"

type ApiChatMessage = { role: "user" | "assistant"; content: string }
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import {
  Upload,
  Link,
  FileText,
  Search,
  ShieldCheck,
  AlertTriangle,
  Lightbulb,
  Wrench,
  ExternalLink,
  ArrowRight,
  Loader2,
  CheckCircle2,
  WifiOff,
  Send,
  Sparkles,
  Pencil,
  ChevronDown,
  ChevronUp,
  CheckCheck,
  Globe,
  Brain,
  Users,
  Shield,
} from "lucide-react"

interface ChatMessage {
  role: "user" | "ai"
  text: string
}

export function PageBriefing() {
  const {
    newsInput,
    setNewsInput,
    factCheck,
    setFactCheck,
    isAnalyzed,
    setIsAnalyzed,
    setCurrentStep,
    sessionId,
    setSessionId,
    setRecommendedAvatars,
  } = useApp()

  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [usedFallback, setUsedFallback] = useState(false)
  const [inputExpanded, setInputExpanded] = useState(false)
  const [useDeepResearch, setUseDeepResearch] = useState(false)

  // Deep Research thought process tracking
  const [researchThoughts, setResearchThoughts] = useState<string[]>([])
  const thoughtsContainerRef = useRef<HTMLDivElement>(null)

  // Controls the visual transition — set true one frame after isAnalyzed
  // so CSS transition kicks in (from "not shifted" → "shifted")
  const [shifted, setShifted] = useState(isAnalyzed)

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const verifiedCount = [
    factCheck.scam_name_verified,
    factCheck.story_hook_verified,
    factCheck.red_flag_verified,
    factCheck.the_fix_verified,
  ].filter(Boolean).length

  const allVerified = verifiedCount === 4

  // Auto-scroll chat
  useEffect(() => {
    const container = chatContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [chatMessages])

  // Auto-scroll research thoughts
  useEffect(() => {
    const container = thoughtsContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [researchThoughts])

  // Add welcome message when analysis completes
  useEffect(() => {
    if (isAnalyzed && chatMessages.length === 0) {
      setChatMessages([
        {
          role: "ai",
          text: "I've analyzed the input and generated a fact sheet. Review each field on the left — if anything needs refining, tell me what to change and I'll update it automatically.",
        },
      ])
    }
  }, [isAnalyzed]) // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger CSS transition after isAnalyzed changes
  useEffect(() => {
    if (isAnalyzed) {
      // Delay by one frame so the DOM renders in "un-shifted" state first,
      // then the transition triggers smoothly
      const raf = requestAnimationFrame(() => setShifted(true))
      return () => cancelAnimationFrame(raf)
    } else {
      setShifted(false)
    }
  }, [isAnalyzed])

  async function handleAnalyze() {
    if (!newsInput.trim()) return
    setIsAnalyzing(true)
    setUsedFallback(false)
    setChatMessages([])
    setResearchThoughts([])

    const sourceType = newsInput.trim().startsWith("http")
      ? ("news_url" as const)
      : ("manual_description" as const)

    try {
      if (useDeepResearch) {
        // Use streaming endpoint for Deep Research — shows thought process
        const result = await submitIntakeStream(
          newsInput.trim(),
          sourceType,
          (thought) => setResearchThoughts((prev) => [...prev, thought]),
          undefined,
          true,
        )
        setSessionId(result.session_id)
        setFactCheck(result.fact_check)
      } else {
        // Standard (non-streaming) intake
        const result = await submitIntake(newsInput.trim(), sourceType, undefined, false)
        setSessionId(result.session_id)
        setFactCheck(result.fact_check)
      }
      setIsAnalyzed(true)
      setIsVerified(false)
    } catch (err) {
      console.warn("Backend unavailable, using demo data:", err)
      setUsedFallback(true)
      setSessionId(null)
      setFactCheck({
        scam_name: "Fake APK Wedding Invitation",
        story_hook:
          "Victim receives a WhatsApp message from an unknown +60 number with a malicious .apk file disguised as a digital wedding invitation. The message uses familiar Malay greetings and social pressure to encourage immediate download. Once installed, the app requests extensive permissions including SMS access, contacts, and accessibility services. It then silently harvests banking credentials via a fake overlay on legitimate banking apps, intercepts TAC/OTP codes, and exfiltrates personal data to a remote command-and-control server.",
        red_flag:
          "Message from an unrecognized +60 number not in contacts. The attachment ends in .apk instead of .jpg, .png, or .pdf — legitimate wedding invitations are never distributed as Android application packages. Sender uses urgency and emotional manipulation. The file size (3.2MB) is unusually large for an invitation.",
        the_fix: "Do NOT download or install any .apk files received via messaging apps from unknown contacts. If you have already installed the file: (1) Immediately enable Airplane Mode, (2) Uninstall the suspicious app, (3) Change all banking passwords from a DIFFERENT device, (4) Contact your bank to freeze affected accounts, (5) Factory reset the compromised device, (6) File a report with NSRC at 997.",
        reference_sources: [
          "https://www.mcmc.gov.my/en/resources/scam-alerts/apk-scam"
        ],
        category: "Phishing",
        verified_by_officer: false,
        verification_timestamp: null,
        officer_notes: null,
        global_ancestry: null,
        psychological_exploit: null,
        victim_profile: null,
        counter_hack: null,
        scam_name_verified: false,
        story_hook_verified: false,
        red_flag_verified: false,
        the_fix_verified: false,
        reference_sources_verified: false,
      })
      setIsAnalyzed(true)
      setIsVerified(false)
    } finally {
      setIsAnalyzing(false)
    }
  }

  function handleEditInput() {
    setIsAnalyzed(false)
    setChatMessages([])
    setIsVerified(false)
    setResearchThoughts([])
  }

  async function handleVerify() {
    if (!sessionId) {
      setIsVerified(true)
      return
    }
    setIsVerifying(true)
    try {
      // Send fact check as corrections (using snake_case directly)
      const corrections = {
        scam_name: factCheck.scam_name,
        story_hook: factCheck.story_hook,
        red_flag: factCheck.red_flag,
        the_fix: factCheck.the_fix,
        reference_sources: factCheck.reference_sources,
      }
      const result = await verifyFactSheet(sessionId, "officer-web", corrections)
      
      setIsVerified(true)
    } catch {
      setIsVerified(true)
    } finally {
      setIsVerifying(false)
    }
  }

  function handleVerifyAll() {
    setFactCheck({
      ...factCheck,
      scam_name_verified: true,
      story_hook_verified: true,
      red_flag_verified: true,
      the_fix_verified: true,
      reference_sources_verified: true,
    })
  }

  function handleUnverifyAll() {
    setFactCheck({
      ...factCheck,
      scam_name_verified: false,
      story_hook_verified: false,
      red_flag_verified: false,
      the_fix_verified: false,
      reference_sources_verified: false,
    })
  }

  async function handleChatSend() {
    if (!chatInput.trim() || chatLoading) return
    const message = chatInput.trim()
    setChatMessages((prev) => [...prev, { role: "user", text: message }])
    setChatInput("")
    setChatLoading(true)

    try {
      if (sessionId) {
        // Convert chat history to API format
        const apiHistory: ApiChatMessage[] = chatMessages.map((msg) => ({
          role: msg.role === "ai" ? "assistant" : "user",
          content: msg.text,
        }))

        const result = await chatFactSheet(sessionId, message, apiHistory)
        setChatMessages((prev) => [
          ...prev,
          { role: "ai", text: result.response },
        ])
        
        // If fact sheet was updated, refresh it from the response
        if (result.updated && result.fact_check) {
          setFactCheck({
            ...result.fact_check,
            // Preserve deep research insights from prior analysis
            global_ancestry: result.fact_check.global_ancestry ?? factCheck.global_ancestry,
            psychological_exploit: result.fact_check.psychological_exploit ?? factCheck.psychological_exploit,
            victim_profile: result.fact_check.victim_profile ?? factCheck.victim_profile,
            counter_hack: result.fact_check.counter_hack ?? factCheck.counter_hack,
          })
        }
      } else {
        await new Promise((r) => setTimeout(r, 3600))
        setChatMessages((prev) => [
          ...prev,
          {
            role: "ai",
            text: "I've updated the fact sheet based on your feedback. The changes are reflected on the left — please review and verify each field.",
          },
        ])
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "(Offline) I couldn't process that — please try again or edit the fields directly.",
        },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Single layout with CSS transition between states
  // ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 w-full mx-auto transition-all duration-700 ease-in-out"
      style={{ maxWidth: shifted ? "1600px" : "56rem" /* 4xl = 56rem */ }}
    >
      {/* Header */}
      <div className="flex items-center justify-between transition-all duration-500">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">The Briefing</h1>
          <p className="text-muted-foreground text-sm transition-all duration-500">
            {shifted
              ? "Review the fact sheet, chat with the AI to refine, then verify."
              : "Drop your news source here. Paste a URL, type it out, or upload a document."}
          </p>
        </div>
        {shifted && (
          <div className="flex items-center gap-2 animate-in fade-in duration-500">
            {usedFallback && (
              <Badge
                variant="outline"
                className="text-orange-400 border-orange-500/30 bg-orange-500/10"
              >
                <WifiOff className="size-3 mr-1" />
                Demo Mode
              </Badge>
            )}
            <Badge
              variant="outline"
              className={
                allVerified
                  ? "text-green-400 border-green-500/30 bg-green-500/10"
                  : "text-teal-400 border-teal-500/30 bg-teal-500/10"
              }
            >
              {allVerified ? <CheckCircle2 className="size-3 mr-1" /> : null}
              {verifiedCount}/4 Verified
            </Badge>
          </div>
        )}
      </div>

      {/* Main grid — transitions from 1-col to 2-col */}
      <div
        className="grid gap-5 transition-all duration-700 ease-in-out"
        style={{
          gridTemplateColumns: shifted ? "1fr 420px" : "1fr 0fr",
        }}
      >
        {/* ── LEFT column: input (before) / fact-check (after) ──── */}
        <div className="min-w-0 transition-all duration-700 ease-in-out">
          {/* Input Card — visible before analysis */}
          <div
            className="transition-all duration-700 ease-in-out overflow-hidden"
            style={{
              maxHeight: shifted ? "0px" : "800px",
              opacity: shifted ? 0 : 1,
              marginBottom: shifted ? "0px" : "0px",
            }}
          >
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Upload className="size-4 text-teal-400" />
                  News Input
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Link className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Paste a URL here..."
                      className="pl-10 bg-input border-border text-foreground placeholder:text-muted-foreground"
                      value={newsInput.startsWith("http") ? newsInput : ""}
                      onChange={(e) => setNewsInput(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" size="icon" aria-label="Upload file">
                    <FileText className="size-4" />
                  </Button>
                </div>
                <Textarea
                  placeholder="Or paste/type the news content directly..."
                  rows={6}
                  className="bg-input border-border text-foreground placeholder:text-muted-foreground resize-none"
                  value={!newsInput.startsWith("http") ? newsInput : ""}
                  onChange={(e) => setNewsInput(e.target.value)}
                />
                <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Search className="size-4 text-cyan-400" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">Gemini Deep Research</span>
                      <span className="text-xs text-muted-foreground">Use Gemini to research and cross-reference sources</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={useDeepResearch}
                    onClick={() => setUseDeepResearch(!useDeepResearch)}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      useDeepResearch ? "bg-cyan-500" : "bg-secondary"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block size-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out",
                        useDeepResearch ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
                <Button
                  onClick={handleAnalyze}
                  disabled={!newsInput.trim() || isAnalyzing}
                  className="w-full"
                  size="lg"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Search className="size-4" />
                      Analyze & Extract
                    </>
                  )}
                </Button>

                {/* Deep Research Thought Process — live during analysis */}
                {useDeepResearch && isAnalyzing && researchThoughts.length > 0 && (
                  <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3 animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="size-3.5 text-cyan-400 animate-pulse" />
                      <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Deep Research — Thinking</span>
                    </div>
                    <div
                      ref={thoughtsContainerRef}
                      className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto pr-1"
                    >
                      {researchThoughts.map((thought, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 animate-in fade-in slide-in-from-bottom-1 duration-300"
                        >
                          <span className="text-cyan-500/60 text-[10px] mt-0.5 font-mono shrink-0">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="text-xs text-foreground/70 leading-relaxed">{thought}</span>
                        </div>
                      ))}
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="size-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="size-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="size-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Fact-Check Card — visible after analysis */}
          <div
            className="transition-all duration-700 ease-in-out overflow-hidden"
            style={{
              maxHeight: shifted ? "2000px" : "0px",
              opacity: shifted ? 1 : 0,
            }}
          >
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                    <ShieldCheck className="size-4 text-teal-400" />
                    Fact-Check Results
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {!allVerified ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground hover:text-green-400"
                        onClick={handleVerifyAll}
                      >
                        <CheckCheck className="size-3.5 mr-1" />
                        Verify All
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-green-400 hover:text-muted-foreground"
                        onClick={handleUnverifyAll}
                      >
                        <CheckCheck className="size-3.5 mr-1" />
                        Unverify All
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <FactCheckField
                  icon={<AlertTriangle className="size-3 text-red-400" />}
                  label="Scam Name"
                  value={factCheck.scam_name}
                  verified={factCheck.scam_name_verified}
                  onVerifiedChange={(v) =>
                    setFactCheck({ ...factCheck, scam_name_verified: v })
                  }
                  fieldType="short"
                />
                <FactCheckField
                  icon={<FileText className="size-3 text-blue-400" />}
                  label="The Story"
                  value={factCheck.story_hook}
                  verified={factCheck.story_hook_verified}
                  onVerifiedChange={(v) =>
                    setFactCheck({ ...factCheck, story_hook_verified: v })
                  }
                  fieldType="long"
                />
                <FactCheckField
                  icon={<Lightbulb className="size-3 text-orange-400" />}
                  label="The Red Flag"
                  value={factCheck.red_flag}
                  verified={factCheck.red_flag_verified}
                  onVerifiedChange={(v) =>
                    setFactCheck({ ...factCheck, red_flag_verified: v })
                  }
                  fieldType="long"
                />
                <FactCheckField
                  icon={<Wrench className="size-3 text-green-400" />}
                  label="The Fix"
                  value={factCheck.the_fix}
                  verified={factCheck.the_fix_verified}
                  onVerifiedChange={(v) =>
                    setFactCheck({ ...factCheck, the_fix_verified: v })
                  }
                  fieldType="long"
                />
                {/* Deep Research Intelligence Insights */}
                {(factCheck.global_ancestry || factCheck.psychological_exploit || factCheck.victim_profile || factCheck.counter_hack || factCheck.reference_sources.length > 0) && (
                  <>
                    <Separator />
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <Brain className="size-4 text-cyan-400" />
                        <span className="text-sm font-semibold text-foreground">Deep Research Intelligence</span>
                        <Badge variant="outline" className="text-cyan-400 border-cyan-500/30 bg-cyan-500/10 text-[10px] px-1.5 py-0">
                          AI Research
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 gap-2.5">
                        {factCheck.global_ancestry && (
                          <InsightCard
                            icon={<Globe className="size-3.5 text-blue-400" />}
                            title="Global Ancestry"
                            content={factCheck.global_ancestry}
                            accentColor="blue"
                          />
                        )}
                        {factCheck.psychological_exploit && (
                          <InsightCard
                            icon={<Brain className="size-3.5 text-purple-400" />}
                            title="Psychological Exploit"
                            content={factCheck.psychological_exploit}
                            accentColor="purple"
                          />
                        )}
                        {factCheck.victim_profile && (
                          <InsightCard
                            icon={<Users className="size-3.5 text-amber-400" />}
                            title="Victim Profile"
                            content={factCheck.victim_profile}
                            accentColor="amber"
                          />
                        )}
                        {factCheck.counter_hack && (
                          <InsightCard
                            icon={<Shield className="size-3.5 text-green-400" />}
                            title="Counter-Hack Strategy"
                            content={factCheck.counter_hack}
                            accentColor="green"
                          />
                        )}

                        {/* Reference Sources — collapsible */}
                        {factCheck.reference_sources.length > 0 && (
                          <Collapsible>
                            <div className={cn("rounded-lg border p-3 border-purple-500/30 bg-purple-500/5")}>
                              <CollapsibleTrigger className="flex items-center justify-between w-full group">
                                <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 font-medium pointer-events-none">
                                  <ExternalLink className="size-3.5 text-purple-400" />
                                  Reference Sources
                                  <Badge variant="outline" className="text-muted-foreground border-border/50 text-[10px] px-1.5 py-0 ml-1">
                                    {factCheck.reference_sources.length}
                                  </Badge>
                                </Label>
                                <ChevronDown className="size-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                              </CollapsibleTrigger>
                              {/* Always show first link */}
                              <a
                                href={factCheck.reference_sources[0]}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-cyan-400 hover:text-cyan-300 truncate transition-colors block mt-2"
                              >
                                {factCheck.reference_sources[0]}
                              </a>
                              <CollapsibleContent className="mt-1 flex flex-col gap-1">
                                {factCheck.reference_sources.slice(1).map((src, i) => (
                                  <a
                                    key={i}
                                    href={src}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-cyan-400 hover:text-cyan-300 truncate transition-colors block"
                                  >
                                    {src}
                                  </a>
                                ))}
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        )}
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {isVerified ? (
                      <span className="text-green-400 font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="size-4" />
                        Verified — ready to proceed
                      </span>
                    ) : allVerified ? (
                      <span className="text-green-400 font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="size-4" />
                        All checked — confirm to proceed
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle className="size-4 text-teal-400" />
                        Check each item to proceed
                      </span>
                    )}
                  </p>
                  <div className="flex gap-2">
                    {allVerified && !isVerified && (
                      <Button
                        onClick={handleVerify}
                        size="sm"
                        variant="outline"
                        disabled={isVerifying}
                      >
                        {isVerifying ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            Confirming...
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="size-4" />
                            Confirm
                          </>
                        )}
                      </Button>
                    )}
                    <Button onClick={() => setCurrentStep(1)} size="sm">
                      Next: Configuration
                      <ArrowRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── RIGHT column: original input + chat (slides in) ────── */}
        <div
          className="flex flex-col gap-4 min-w-0 transition-all duration-700 ease-in-out overflow-hidden"
          style={{ opacity: shifted ? 1 : 0 }}
        >
          {/* Collapsed original input */}
          <Card className="border-border bg-card shrink-0">
            <CardHeader className="pb-0 pt-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FileText className="size-3.5 text-muted-foreground" />
                  Original Input
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setInputExpanded(!inputExpanded)}
                  >
                    {inputExpanded ? (
                      <ChevronUp className="size-3.5" />
                    ) : (
                      <ChevronDown className="size-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-teal-400 hover:text-teal-300"
                    onClick={handleEditInput}
                  >
                    <Pencil className="size-3.5 mr-1" />
                    Edit
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-2">
              <p
                className={cn(
                  "text-xs text-foreground/70 leading-relaxed transition-all duration-300 overflow-hidden",
                  inputExpanded
                    ? "max-h-[300px] overflow-y-auto"
                    : "max-h-[3.6em] line-clamp-3"
                )}
              >
                {newsInput}
              </p>
            </CardContent>
          </Card>

          {/* AI Refine Chat */}
          <Card className="border-border bg-card flex flex-col flex-1 min-h-[400px]">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="size-4 text-cyan-400" />
                AI Refine Agent
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 gap-3 px-4 pb-3 pt-0">
              {/* Messages */}
              <div ref={chatContainerRef} className="flex flex-col gap-2.5 flex-1 overflow-y-auto max-h-[400px] min-h-[200px] pr-1">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-xl px-3.5 py-2.5 text-sm max-w-[90%] animate-in fade-in slide-in-from-bottom-2 duration-300",
                      msg.role === "user"
                        ? "bg-cyan-500/90 text-white self-end rounded-br-sm shadow-[0_2px_12px_oklch(0.60_0.14_200/0.20)]"
                        : "bg-secondary/80 text-foreground self-start rounded-bl-sm backdrop-blur-sm"
                    )}
                  >
                    {msg.role === "ai" && (
                      <span className="text-[10px] text-cyan-400 font-medium block mb-0.5">
                        AI Agent
                      </span>
                    )}
                    <span className="leading-relaxed">{msg.text}</span>
                  </div>
                ))}
                {chatLoading && (
                  <div className="bg-secondary rounded-xl px-3.5 py-2.5 self-start rounded-bl-sm animate-in fade-in duration-200">
                    <span className="text-[10px] text-cyan-400 font-medium block mb-0.5">
                      AI Agent
                    </span>
                    <div className="flex items-center gap-1.5">
                      <div
                        className="size-1.5 rounded-full bg-cyan-400 animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      />
                      <div
                        className="size-1.5 rounded-full bg-cyan-400 animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      />
                      <div
                        className="size-1.5 rounded-full bg-cyan-400 animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Chat input */}
              <div className="flex gap-2 pt-1">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && !e.shiftKey && handleChatSend()
                  }
                  placeholder="e.g. Make the story hook shorter..."
                  className="bg-input border-border text-foreground placeholder:text-muted-foreground text-sm"
                  disabled={chatLoading}
                />
                <Button
                  size="icon"
                  onClick={handleChatSend}
                  disabled={!chatInput.trim() || chatLoading}
                  className="bg-cyan-500 hover:bg-cyan-600 shrink-0"
                >
                  {chatLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  <span className="sr-only">Send</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ─── Fact Check Field (read-only with checkbox on the RIGHT) ─────

function FactCheckField({
  icon,
  label,
  value,
  verified,
  onVerifiedChange,
  fieldType,
  isLink,
}: {
  icon: React.ReactNode
  label: string
  value: string
  verified: boolean
  onVerifiedChange: (v: boolean) => void
  fieldType: "short" | "long"
  isLink?: boolean
}) {
  return (
    <div
      className={cn(
        "group rounded-lg border p-3 transition-all duration-300 cursor-pointer",
        verified
          ? "border-green-500/30 bg-green-500/5 shadow-[0_0_12px_oklch(0.70_0.17_150/0.06)]"
          : "border-border/50 bg-secondary/15 hover:bg-secondary/30 hover:border-border/70"
      )}
      onClick={() => onVerifiedChange(!verified)}
    >
      <div className="flex items-start gap-3">
        {/* Content (left) */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 font-medium pointer-events-none">
            {icon}
            {label}
            {verified && <CheckCircle2 className="size-3 text-green-400" />}
          </Label>
          {isLink ? (
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-cyan-400 hover:text-cyan-300 truncate transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {value}
            </a>
          ) : (
            <p
              className={cn(
                "text-sm text-foreground/90 leading-relaxed",
                fieldType === "long" ? "line-clamp-4" : ""
              )}
            >
              {value}
            </p>
          )}
        </div>

        {/* Checkbox (right) */}
        <div className="pt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={verified}
            onCheckedChange={(checked) => onVerifiedChange(checked === true)}
            className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
          />
        </div>
      </div>
    </div>
  )
}

// ─── Insight Card (read-only, accent-colored) ────────────────────

const accentMap = {
  blue:   { border: "border-blue-500/30",   bg: "bg-blue-500/5" },
  purple: { border: "border-purple-500/30", bg: "bg-purple-500/5" },
  amber:  { border: "border-amber-500/30",  bg: "bg-amber-500/5" },
  green:  { border: "border-green-500/30",  bg: "bg-green-500/5" },
} as const

function InsightCard({
  icon,
  title,
  content,
  accentColor,
}: {
  icon: React.ReactNode
  title: string
  content: string
  accentColor: keyof typeof accentMap
}) {
  const accent = accentMap[accentColor]
  return (
    <div className={cn("rounded-lg border p-3", accent.border, accent.bg)}>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 font-medium">
          {icon}
          {title}
        </Label>
        <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
          {content}
        </p>
      </div>
    </div>
  )
}