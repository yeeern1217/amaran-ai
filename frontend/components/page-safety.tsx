"use client"

import { useState, useEffect } from "react"
import { useApp } from "@/lib/app-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ShieldCheck,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  XCircle,
  FileCheck,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { cn } from "@/lib/utils"

export function PageSafety() {
  const { setCurrentStep } = useApp()
  const [isRunning, setIsRunning] = useState(true)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // Simulate a brief loading animation, then show completion
  useEffect(() => {
    const timer = setTimeout(() => setIsRunning(false), 6000)
    return () => clearTimeout(timer)
  }, [])

  function toggleCategory(cat: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  // Mock data for display (frontend-only, no actual checking)
  const mockData = {
    passed: true,
    complianceSummary: "Video content has been reviewed and meets all safety and compliance standards.",
    checkedAgainst: ["Content Guidelines", "Community Standards", "Legal Compliance"],
    detailedAnalysis: [
      {
        category: "Content Safety",
        status: "passed" as const,
        analysis: "All content has been reviewed for safety compliance. No issues detected.",
        elementsReviewed: ["Violence", "Hate Speech", "Harmful Content"]
      },
      {
        category: "Legal Compliance",
        status: "passed" as const,
        analysis: "Content complies with all applicable laws and regulations.",
        elementsReviewed: ["Copyright", "Privacy", "Defamation"]
      },
      {
        category: "Community Standards",
        status: "passed" as const,
        analysis: "Content adheres to community guidelines and standards.",
        elementsReviewed: ["Appropriate Language", "Cultural Sensitivity", "Age Appropriateness"]
      }
    ]
  }

  if (isRunning) {
    return (
      <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full items-center">
        <div className="flex flex-col gap-2 text-center mt-8">
          <div className="relative size-20 rounded-full flex items-center justify-center bg-teal-500/15 mx-auto">
            <Loader2 className="size-10 text-teal-400 animate-spin" />
            <div className="absolute inset-0 rounded-full pulse-ring" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Running Safety Review...</h1>
          <p className="text-muted-foreground text-sm">Analyzing video content for compliance and safety.</p>
        </div>
      </div>
    )
  }

  const { passed, complianceSummary, detailedAnalysis, checkedAgainst } = mockData

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col gap-2 text-center mt-8">
        <div className="flex justify-center mb-4">
          <div
            className={cn(
              "size-20 rounded-full flex items-center justify-center transition-all duration-500",
              passed ? "bg-green-500/15 shadow-[0_0_24px_oklch(0.70_0.17_150/0.12)]" : "bg-red-500/15 shadow-[0_0_24px_oklch(0.60_0.20_25/0.12)]"
            )}
          >
            {passed ? (
              <ShieldCheck className="size-10 text-green-400" />
            ) : (
              <XCircle className="size-10 text-red-400" />
            )}
          </div>
        </div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          {passed ? "Safety Review Passed" : "Safety Issues Found"}
        </h1>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">{complianceSummary}</p>
      </div>

      {/* Checked Against */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
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
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileCheck className="size-4 text-primary" />
            Detailed Compliance Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {detailedAnalysis.length === 0 ? (
            <p className="text-sm text-muted-foreground">No detailed analysis available.</p>
          ) : (
            detailedAnalysis.map((item) => {
              const isExpanded = expandedCategories.has(item.category)
              return (
                <div key={item.category} className="rounded-lg border border-border/50 overflow-hidden transition-colors hover:border-border/70">
                  <button
                    onClick={() => toggleCategory(item.category)}
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
            })
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex gap-3 w-full">
        <Button variant="outline" onClick={() => setCurrentStep(4)} className="flex-1" size="lg">
          <ArrowLeft className="size-4" />
          Back to Preview
        </Button>
        <Button
          onClick={() => setCurrentStep(6)}
          className="flex-1"
          size="lg"
        >
          Proceed to Screening Room
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

