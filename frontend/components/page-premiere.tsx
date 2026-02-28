"use client"

import { useRef } from "react"
import { useApp } from "@/lib/app-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
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
} from "lucide-react"

export function PagePremiere() {
  const { scenes, factCheck, config, setCurrentStep } = useApp()
  const generatedCount = scenes.filter((s) => s.generated).length
  const videoRef = useRef<HTMLVideoElement>(null)

  const allFactsVerified =
    factCheck.scam_name_verified &&
    factCheck.story_hook_verified &&
    factCheck.red_flag_verified &&
    factCheck.the_fix_verified &&
    factCheck.reference_sources_verified

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
            <div className="relative rounded-xl bg-gradient-to-b from-secondary/40 to-secondary/20 border border-border/40 overflow-hidden aspect-[9/16] max-h-[520px] mx-auto flex items-center justify-center">
              <div className="flex flex-col items-center gap-4 text-center p-6">
                <div className="size-16 rounded-full bg-teal-500/15 flex items-center justify-center shadow-[0_0_20px_oklch(0.87_0.17_175/0.12)] transition-transform hover:scale-105">
                  <Play className="size-8 text-teal-400" />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-foreground font-semibold">
                    {factCheck.scam_name || "Your Video"}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {generatedCount} of {scenes.length} scenes generated
                  </p>
                </div>
                <div className="flex gap-1 mt-2">
                  {scenes.map((scene) => (
                    <div
                      key={scene.id}
                      className={`h-1.5 rounded-full flex-1 max-w-[40px] ${
                        scene.generated ? "bg-green-400" : "bg-secondary"
                      }`}
                    />
                  ))}
                </div>
                {/* Simulated timeline */}
                <div className="w-full mt-3">
                  <div className="h-1 bg-secondary rounded-full w-full overflow-hidden">
                    <div className="h-full w-0 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full" />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>0:00</span>
                    <span>1:00</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {generatedCount === scenes.length
                    ? "All scenes ready. Click play to preview."
                    : "Generate all scenes in The Studio to preview the full video."}
                </p>
              </div>
            </div>
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
              <Button className="w-full" size="lg">
                <Download className="size-4" />
                Download MP4
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                {config.videoFormat === "reels"
                  ? "9:16 vertical format"
                  : config.videoFormat === "post"
                    ? "1:1 square format"
                    : "16:9 landscape format"}
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
              >
                <MessageCircle className="size-5 text-green-400" />
                Share to WhatsApp
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-11 text-foreground hover:border-pink-500/30 transition-all"
              >
                <Instagram className="size-5 text-pink-400" />
                Share to Instagram Reels
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-11 text-foreground hover:border-foreground/30 transition-all"
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
