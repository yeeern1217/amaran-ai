"use client"

import Image from "next/image"
import { useApp } from "@/lib/app-context"
import { cn } from "@/lib/utils"
import {
  Newspaper,
  Settings2,
  Film,
  Users,
  Clapperboard,
  Share2,
  ChevronRight,
  Image as ImageIcon,
  Megaphone,
  Video,
} from "lucide-react"
import logoImg from "@/assets/logo.png"

const steps = [
  { label: "The Briefing", icon: Newspaper },
  { label: "Configuration", icon: Settings2 },
  { label: "The Studio", icon: Film },
  { label: "Characters", icon: Users },
  { label: "Preview", icon: ImageIcon },
  { label: "Clips Review", icon: Video },
  { label: "Screening Room", icon: Share2 },
  { label: "Social", icon: Megaphone },
]

export function StepperNav() {
  const { currentStep, setCurrentStep, factCheck, isAnalyzed } = useApp()

  // Check if all fact-check fields are verified
  const allFactCheckVerified = isAnalyzed && [
    factCheck.scam_name_verified,
    factCheck.story_hook_verified,
    factCheck.red_flag_verified,
    factCheck.the_fix_verified,
    factCheck.reference_sources_verified,
  ].every(Boolean)

  function handleStepClick(targetStep: number) {
    // Going backward is always allowed
    if (targetStep < currentStep) {
      setCurrentStep(targetStep)
      return
    }
    // Going forward past Briefing requires all fact-check verified
    if (currentStep === 0 && targetStep > 0 && !allFactCheckVerified) {
      return // block
    }
    setCurrentStep(targetStep)
  }

  return (
    <header className="border-b border-border/40 bg-card/50 backdrop-blur-xl sticky top-0 z-50 shadow-[0_1px_24px_oklch(0.87_0.17_175/0.04)]">
      <div className="flex items-center justify-between max-w-[1600px] mx-auto px-4 md:px-6 h-16">
        <div className="flex items-center gap-2.5">
          <Image
            src={logoImg}
            alt="amaran.ai logo"
            width={36}
            height={36}
            className="rounded-lg size-9 object-cover ring-1 ring-teal-400/30"
          />
          <span className="font-semibold text-foreground text-lg hidden sm:block tracking-tight">
            amaran<span className="text-gradient-mint">.ai</span>
          </span>
        </div>

        <nav className="flex items-center gap-1 md:gap-2" role="navigation" aria-label="Steps">
          {steps.map((step, i) => {
            const Icon = step.icon
            const isActive = currentStep === i
            const isDone = currentStep > i
            // Lock steps beyond Briefing if fact-check not complete
            const isLocked = i > 0 && currentStep === 0 && !allFactCheckVerified
            return (
              <div key={step.label} className="flex items-center gap-1 md:gap-2">
                <button
                  onClick={() => handleStepClick(i)}
                  disabled={isLocked}
                  title={isLocked ? "Verify all fact-check items first" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    isLocked
                      ? "text-muted-foreground/40 cursor-not-allowed"
                      : isActive
                        ? "bg-primary/15 text-primary shadow-[0_0_12px_oklch(0.87_0.17_175/0.15)]"
                        : isDone
                          ? "text-foreground hover:bg-secondary/70"
                          : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                  )}
                  aria-current={isActive ? "step" : undefined}
                >
                  <div
                    className={cn(
                      "flex items-center justify-center size-7 rounded-full text-xs font-bold transition-all duration-200",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-[0_0_10px_oklch(0.87_0.17_175/0.35)]"
                        : isDone
                          ? "bg-green-500/20 text-green-400"
                          : "bg-secondary text-muted-foreground"
                    )}
                  >
                    {isDone ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M3 7.5L5.5 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <Icon className="size-3.5" />
                    )}
                  </div>
                  <span className="hidden lg:inline">{step.label}</span>
                </button>
                {i < steps.length - 1 && (
                  <ChevronRight className="size-4 text-muted-foreground/50 hidden md:block" />
                )}
              </div>
            )
          })}
        </nav>

        <div className="w-9" />
      </div>
    </header>
  )
}
