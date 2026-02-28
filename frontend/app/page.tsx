"use client"

import { AppProvider, useApp } from "@/lib/app-context"
import { StepperNav } from "@/components/stepper-nav"
import { PageLanding } from "@/components/page-landing"
import { PageBriefing } from "@/components/page-briefing"
import { PageConfig } from "@/components/page-config"
import { PageStudio } from "@/components/page-studio"
import { PageCharacter } from "@/components/page-character"
import { PagePreview } from "@/components/page-preview"
import { PageClips } from "@/components/page-clips"
import { PagePremiere } from "@/components/page-premiere"
import { PageSocial } from "@/components/page-social"

function StepContent() {
  const { currentStep } = useApp()

  return (
    <>
      {currentStep === 0 && <PageBriefing />}
      {currentStep === 1 && <PageConfig />}
      {currentStep === 2 && <PageStudio />}
      {currentStep === 3 && <PageCharacter />}
      {currentStep === 4 && <PagePreview />}
      {currentStep === 5 && <PageClips />}
      {currentStep === 6 && <PagePremiere />}
      {currentStep === 7 && <PageSocial />}
    </>
  )
}

function AppContent() {
  const { showLanding } = useApp()

  if (showLanding) {
    return <PageLanding />
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <StepperNav />
      <main className="flex-1 p-4 md:p-6">
        <StepContent />
      </main>
    </div>
  )
}

export default function Home() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}
