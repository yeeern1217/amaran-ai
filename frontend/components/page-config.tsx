"use client"

import React, { useState } from "react"
import { useApp } from "@/lib/app-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import {
  Languages,
  Megaphone,
  Palette,
  MonitorPlay,
  Clapperboard,
  ArrowRight,
  ArrowLeft,
  Clock,
  Sparkles,
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const audiences = [
  { id: "seniors", label: "Seniors" },
  { id: "young-adults", label: "Young Adults" },
  { id: "general", label: "General Public" },
  { id: "parents", label: "Parents" },
]

const tones = [
  { id: "urgent", label: "Urgent Warning" },
  { id: "educational", label: "Educational" },
  { id: "dramatic", label: "Dramatic" },
  { id: "casual", label: "Casual & Friendly" },
]

const formats = [
  { id: "reels", label: "Story / Reels", ratio: "9:16" },
  { id: "post", label: "Square Post", ratio: "1:1" },
  { id: "landscape", label: "Landscape", ratio: "16:9" },
]

const videoLengths = [
  { id: "15s", label: "15 sec", desc: "Quick Story" },
  { id: "30s", label: "30 sec", desc: "Short Form" },
  { id: "60s", label: "60 sec", desc: "Standard" },
  { id: "90s", label: "90 sec", desc: "Extended" },
  { id: "3min", label: "3 min", desc: "Long Form" },
]

const recommended: Record<string, { ids: string[]; reason: string }> = {
  audience: {
    ids: ["seniors"],
    reason:
      "Seniors are among the most targeted and vulnerable demographics for scams. Content tailored to them can have the highest protective impact.",
  },
  format: {
    ids: ["landscape"],
    reason:
      "Landscape (16:9) is optimal for TV broadcasts, community screenings, and desktop viewing — the primary channels seniors engage with.",
  },
  tone: {
    ids: ["urgent"],
    reason:
      "An urgent warning tone drives immediate attention and action, which is critical when raising scam awareness before victims fall prey.",
  },
  length: {
    ids: ["90s"],
    reason:
      "90 seconds gives enough room to dramatise the full Macau Scam playbook — from the initial Pos Laju hook through the fake police transfer to the counter-hack resolution — while staying within the attention span of the 40-65 demographic on Facebook and WhatsApp.",
  },
}

export function PageConfig() {
  const { config, setConfig, factCheck, setCurrentStep, sessionId } = useApp()
  const selectedAudience = audiences.find((a) => a.id === config.targetAudience)
  const selectedTone = tones.find((t) => t.id === config.tone)
  const selectedFormat = formats.find((f) => f.id === config.videoFormat)
  const selectedLength = videoLengths.find((l) => l.id === config.videoLength)

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-foreground text-balance tracking-tight">
          Configuration
        </h1>
        <p className="text-muted-foreground text-sm">
          Choose your language, target audience, tone, format, and length to shape the video.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          {/* Language & Audience */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Languages className="size-4 text-purple-400" />
                  Language
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={config.language}
                  onValueChange={(val) =>
                    setConfig({ ...config, language: val })
                  }
                >
                  <SelectTrigger className="w-full bg-input border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="english">English</SelectItem>
                    <SelectItem value="malay">Bahasa Melayu</SelectItem>
                    <SelectItem value="mandarin">Mandarin</SelectItem>
                    <SelectItem value="tamil">Tamil</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Megaphone className="size-4 text-pink-400" />
                  Target Audience
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {audiences.map((aud) => (
                    <TooltipProvider key={aud.id} delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() =>
                              setConfig({ ...config, targetAudience: aud.id })
                            }
                            className={cn(
                              "rounded-full px-4 py-1.5 text-sm font-medium border transition-all duration-200 relative",
                              config.targetAudience === aud.id
                                ? "bg-pink-500 text-white border-pink-500 shadow-[0_0_12px_oklch(0.65_0.20_0/0.20)]"
                                : "bg-secondary/40 text-foreground border-border/50 hover:bg-secondary hover:border-border"
                            )}
                          >
                            {aud.label}
                            {recommended.audience.ids.includes(aud.id) && (
                              <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-400">
                                <Sparkles className="size-3" />
                                Recommended
                              </span>
                            )}
                          </button>
                        </TooltipTrigger>
                        {recommended.audience.ids.includes(aud.id) && (
                          <TooltipContent side="bottom" className="max-w-[240px] text-xs">
                            <p className="flex items-start gap-1.5">
                              <Sparkles className="size-3 mt-0.5 shrink-0 text-amber-400" />
                              {recommended.audience.reason}
                            </p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tone & Format */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Palette className="size-4 text-teal-400" />
                  Tone
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {tones.map((tone) => (
                    <TooltipProvider key={tone.id} delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() =>
                              setConfig({ ...config, tone: tone.id })
                            }
                            className={cn(
                              "rounded-full px-4 py-1.5 text-sm font-medium border transition-all duration-200 relative",
                              config.tone === tone.id
                                ? "bg-teal-500 text-white border-teal-500 shadow-[0_0_12px_oklch(0.87_0.17_175/0.20)]"
                                : "bg-secondary/40 text-foreground border-border/50 hover:bg-secondary hover:border-border"
                            )}
                          >
                            {tone.label}
                            {recommended.tone.ids.includes(tone.id) && (
                              <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-400">
                                <Sparkles className="size-3" />
                                Recommended
                              </span>
                            )}
                          </button>
                        </TooltipTrigger>
                        {recommended.tone.ids.includes(tone.id) && (
                          <TooltipContent side="bottom" className="max-w-[240px] text-xs">
                            <p className="flex items-start gap-1.5">
                              <Sparkles className="size-3 mt-0.5 shrink-0 text-amber-400" />
                              {recommended.tone.reason}
                            </p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  <MonitorPlay className="size-4 text-cyan-400" />
                  Video Format
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {formats.map((fmt) => (
                    <TooltipProvider key={fmt.id} delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() =>
                              setConfig({ ...config, videoFormat: fmt.id })
                            }
                            className={cn(
                              "flex flex-col items-center gap-1.5 rounded-lg border p-3 min-w-[80px] transition-all duration-200",
                              config.videoFormat === fmt.id
                                ? "border-cyan-400 bg-cyan-500/10 ring-1 ring-cyan-400/30 shadow-[0_0_12px_oklch(0.70_0.14_200/0.15)]"
                                : "border-border/50 bg-secondary/30 hover:bg-secondary/60 hover:border-border"
                            )}
                          >
                            <div
                              className={cn(
                                "rounded border-2",
                                fmt.id === "reels" && "w-5 h-8",
                                fmt.id === "post" && "w-7 h-7",
                                fmt.id === "landscape" && "w-9 h-5",
                                config.videoFormat === fmt.id
                                  ? "border-cyan-400"
                                  : "border-muted-foreground/40"
                              )}
                            />
                            <span className="text-xs font-medium text-foreground">
                              {fmt.label}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {fmt.ratio}
                            </span>
                            {recommended.format.ids.includes(fmt.id) && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-400 mt-0.5">
                                <Sparkles className="size-3" />
                                Recommended
                              </span>
                            )}
                          </button>
                        </TooltipTrigger>
                        {recommended.format.ids.includes(fmt.id) && (
                          <TooltipContent side="bottom" className="max-w-[240px] text-xs">
                            <p className="flex items-start gap-1.5">
                              <Sparkles className="size-3 mt-0.5 shrink-0 text-amber-400" />
                              {recommended.format.reason}
                            </p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Video Length */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Clock className="size-4 text-emerald-400" />
                Video Length
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {videoLengths.map((len) => (
                  <TooltipProvider key={len.id} delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setConfig({ ...config, videoLength: len.id })}
                          className={cn(
                            "flex flex-col items-center gap-1 rounded-lg border p-3 min-w-[90px] transition-all duration-200",
                            config.videoLength === len.id
                              ? "border-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-400/30 shadow-[0_0_12px_oklch(0.70_0.17_155/0.15)]"
                              : "border-border/50 bg-secondary/30 hover:bg-secondary/60 hover:border-border"
                          )}
                        >
                          <span
                            className={cn(
                              "text-lg font-bold",
                              config.videoLength === len.id
                                ? "text-emerald-400"
                                : "text-muted-foreground"
                            )}
                          >
                            {len.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {len.desc}
                          </span>
                          {recommended.length.ids.includes(len.id) && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-400 mt-0.5">
                              <Sparkles className="size-3" />
                              Recommended
                            </span>
                          )}
                        </button>
                      </TooltipTrigger>
                      {recommended.length.ids.includes(len.id) && (
                        <TooltipContent side="bottom" className="max-w-[240px] text-xs">
                          <p className="flex items-start gap-1.5">
                            <Sparkles className="size-3 mt-0.5 shrink-0 text-amber-400" />
                            {recommended.length.reason}
                          </p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Director's Slate Summary */}
        <div className="lg:sticky lg:top-24 h-fit">
          <Card className="border-teal-500/25 bg-gradient-to-b from-teal-500/5 to-transparent shadow-[0_0_20px_oklch(0.87_0.17_175/0.05)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Clapperboard className="size-4 text-teal-400" />
                {"Director's Slate"}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {factCheck.scam_name && (
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                    Topic
                  </Label>
                  <p className="text-sm text-foreground font-medium">
                    {factCheck.scam_name}
                  </p>
                </div>
              )}
              <Separator />
              <div className="flex flex-col gap-2.5">
                <SlateLine
                  label="Language"
                  value={config.language.charAt(0).toUpperCase() + config.language.slice(1)}
                  color="text-purple-400"
                />
                <SlateLine label="Audience" value={selectedAudience?.label || "-"} color="text-pink-400" />
                <SlateLine label="Tone" value={selectedTone?.label || "-"} color="text-teal-400" />
                <SlateLine label="Format" value={selectedFormat?.label || "-"} color="text-cyan-400" />
                <SlateLine label="Length" value={selectedLength?.label || "-"} color="text-emerald-400" />
              </div>
              <Separator />
              <div className="rounded-md bg-secondary/50 p-3">
                <p className="text-xs text-foreground leading-relaxed">
                  <span className="text-teal-400 font-semibold">
                    {selectedTone?.label}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {config.language.charAt(0).toUpperCase() + config.language.slice(1)}{" "}
                    {selectedFormat?.label} ({selectedLength?.label}) targeting{" "}
                  </span>
                  <span className="text-foreground font-medium">
                    {selectedAudience?.label}
                  </span>
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(0)}
                  className="flex-1"
                  size="sm"
                >
                  <ArrowLeft className="size-4" />
                  Back
                </Button>
                <Button
                  onClick={() => setCurrentStep(2)}
                  className="flex-1"
                  size="sm"
                >
                  Generate Script
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function SlateLine({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant="secondary" className={`font-medium ${color || "text-foreground"}`}>
        {value}
      </Badge>
    </div>
  )
}
