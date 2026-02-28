"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { useApp } from "@/lib/app-context"
import { fetchTrendingNews, type SerperNewsItem } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  Plus,
  Newspaper,
  FolderOpen,
  ArrowRight,
  Clock,
  ExternalLink,
  Play,
  Shield,
  TrendingUp,
  Search,
  Sparkles,
  Loader2,
  RefreshCw,
} from "lucide-react"
import logoImg from "@/assets/logo.png"

// ─── Types ───────────────────────────────────────────────────────

// Re-use the SerperNewsItem from the API client as our NewsItem type
type NewsItem = SerperNewsItem

interface Project {
  id: string
  name: string
  date: string
  status: "draft" | "in-progress" | "completed"
  scamType: string
}

const PLACEHOLDER_PROJECTS: Project[] = [
  { id: "p1", name: "APK Wedding Invitation Scam", date: "19 Feb 2026", status: "in-progress", scamType: "Phishing" },
  { id: "p2", name: "Pos Laju Delivery Fraud", date: "15 Feb 2026", status: "completed", scamType: "Parcel Scam" },
  { id: "p3", name: "Macau Scam Awareness", date: "10 Feb 2026", status: "completed", scamType: "Impersonation" },
  { id: "p4", name: "TikTok Job Scam Alert", date: "5 Feb 2026", status: "draft", scamType: "Job Scam" },
  { id: "p5", name: "Love Scam PSA — Valentine's", date: "1 Feb 2026", status: "completed", scamType: "Love Scam" },
]

// ─── Category colors ─────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  "Digital Arrest": "text-red-400 border-red-500/30 bg-red-500/10",
  "Parcel Scam": "text-orange-400 border-orange-500/30 bg-orange-500/10",
  "Job Scam": "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
  "Investment Scam": "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  "Phishing": "text-blue-400 border-blue-500/30 bg-blue-500/10",
  "Love Scam": "text-pink-400 border-pink-500/30 bg-pink-500/10",
  "Impersonation": "text-purple-400 border-purple-500/30 bg-purple-500/10",
}

const STATUS_STYLES: Record<string, string> = {
  draft: "text-muted-foreground border-border bg-secondary/50",
  "in-progress": "text-teal-400 border-teal-500/30 bg-teal-500/10",
  completed: "text-green-400 border-green-500/30 bg-green-500/10",
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  "in-progress": "In Progress",
  completed: "Completed",
}

// ─── Component ───────────────────────────────────────────────────

export function PageLanding() {
  const { setShowLanding, setNewsInput, setCurrentStep, setIsAnalyzed } = useApp()
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // Live news state
  const [newsItems, setNewsItems] = useState<NewsItem[]>([])
  const [newsLoading, setNewsLoading] = useState(true)
  const [newsError, setNewsError] = useState<string | null>(null)

  // Fetch trending news on mount
  useEffect(() => {
    let cancelled = false
    async function loadNews() {
      setNewsLoading(true)
      setNewsError(null)
      try {
        const res = await fetchTrendingNews("latest scam news Malaysia", 10)
        if (!cancelled) {
          setNewsItems(res.articles)
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Failed to load news"
          setNewsError(msg)
        }
      } finally {
        if (!cancelled) setNewsLoading(false)
      }
    }
    loadNews()
    return () => { cancelled = true }
  }, [])

  async function handleRefreshNews() {
    setNewsLoading(true)
    setNewsError(null)
    try {
      const res = await fetchTrendingNews("latest scam news Malaysia", 10)
      setNewsItems(res.articles)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load news"
      setNewsError(msg)
    } finally {
      setNewsLoading(false)
    }
  }

  function handleNewProject() {
    setNewsInput("")
    setIsAnalyzed(false)
    setCurrentStep(0)
    setShowLanding(false)
  }

  function handleNewsClick(news: NewsItem) {
    setSelectedNews(news)
    setDrawerOpen(true)
  }

  function handleGenerateFromNews() {
    if (!selectedNews) return
    // If the article has a URL, pass it directly so the Briefing page
    // auto-fills the URL input and treats it as a news_url source.
    // Otherwise fall back to headline + summary as plain text.
    const content = selectedNews.url
      ? selectedNews.url
      : `${selectedNews.headline}\n\n${selectedNews.summary}`
    setNewsInput(content)
    setIsAnalyzed(false)
    setCurrentStep(0)
    setDrawerOpen(false)
    setShowLanding(false)
  }

  function handleResumeProject(_project: Project) {
    // Placeholder: just enter the pipeline
    setCurrentStep(0)
    setShowLanding(false)
  }

  const filteredNews = searchQuery.trim()
    ? newsItems.filter(
        (n) =>
          n.headline.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : newsItems

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* ── Header ────────────────────────────────────────────── */}
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
            <div className="flex flex-col">
              <span className="font-semibold text-foreground text-lg leading-tight tracking-tight">
                amaran<span className="text-gradient-mint">.ai</span>
              </span>
              <span className="text-[10px] text-muted-foreground leading-none hidden sm:block">
                AI-Powered Anti-Scam Video Generation
              </span>
            </div>
          </div>
          {/* intentionally empty — Quick Start box below handles new project */}
          <div />
        </div>
      </header>

      {/* ── Main Content ──────────────────────────────────────── */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 md:px-6 py-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px]">

          {/* ── Left: Trending News ──────────────────────────── */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="size-5 text-teal-400" />
                <h2 className="text-lg font-semibold text-foreground">Trending Scam News</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-muted-foreground hover:text-teal-400"
                  onClick={handleRefreshNews}
                  disabled={newsLoading}
                >
                  <RefreshCw className={cn("size-3.5", newsLoading && "animate-spin")} />
                </Button>
              </div>
              <div className="relative w-64 hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search news..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-9 bg-input border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {/* Loading state */}
            {newsLoading && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                <Loader2 className="size-8 animate-spin text-teal-400" />
                <p className="text-sm">Fetching latest scam news...</p>
              </div>
            )}

            {/* Error state */}
            {!newsLoading && newsError && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
                <Newspaper className="size-8 opacity-40" />
                <p className="text-sm text-red-400">{newsError}</p>
                <Button variant="outline" size="sm" onClick={handleRefreshNews} className="gap-2">
                  <RefreshCw className="size-3.5" />
                  Retry
                </Button>
              </div>
            )}

            {/* News grid */}
            {!newsLoading && !newsError && (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredNews.map((news) => (
                <button
                  key={news.id}
                  onClick={() => handleNewsClick(news)}
                  className="text-left group"
                >
                  <Card className="border-border/40 bg-card/60 hover:border-teal-500/40 hover:bg-card/90 hover:shadow-[0_0_24px_oklch(0.87_0.17_175/0.06)] transition-all duration-300 h-full flex flex-col">
                    {/* Thumbnail */}
                    <div className="relative h-32 bg-gradient-to-br from-secondary/80 via-secondary/40 to-teal-500/5 rounded-t-xl flex items-center justify-center overflow-hidden">
                      {news.image_url ? (
                        <img
                          src={news.image_url}
                          alt={news.headline}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none"
                            e.currentTarget.nextElementSibling?.classList.remove("hidden")
                          }}
                        />
                      ) : null}
                      <Newspaper className={cn("size-8 text-muted-foreground/30", news.image_url && "hidden")} />
                      <Badge
                        variant="outline"
                        className={cn(
                          "absolute top-2 left-2 text-[10px]",
                          CATEGORY_COLORS[news.category] || "text-muted-foreground"
                        )}
                      >
                        {news.category}
                      </Badge>
                    </div>
                    <CardContent className="flex flex-col gap-2 p-3 flex-1">
                      <h3 className="text-sm font-medium text-foreground leading-snug line-clamp-2 group-hover:text-teal-400 transition-colors">
                        {news.headline}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {news.summary}
                      </p>
                      <div className="flex items-center gap-2 mt-auto pt-2">
                        <span className="text-[10px] text-muted-foreground">{news.source}</span>
                        <span className="text-[10px] text-muted-foreground/50">·</span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="size-3" />
                          {news.date}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
            )}

            {!newsLoading && !newsError && filteredNews.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                <Search className="size-8 opacity-40" />
                <p className="text-sm">No news matching &ldquo;{searchQuery}&rdquo;</p>
              </div>
            )}
          </div>

          {/* ── Right: Quick Start + Past Projects Sidebar ──── */}
          <div className="flex flex-col gap-4">
            {/* Quick Start */}
            <Card className="border-dashed border-teal-500/30 bg-gradient-to-br from-teal-500/8 to-cyan-500/5 shadow-[0_0_20px_oklch(0.87_0.17_175/0.06)]">
              <CardContent className="p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-full bg-teal-500/15 flex items-center justify-center">
                    <Sparkles className="size-3.5 text-teal-400" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">Quick Start</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Paste a news URL or describe a scam to start generating an awareness video instantly.
                </p>
                <Button
                  onClick={handleNewProject}
                  size="sm"
                  className="w-full gap-2"
                >
                  <Plus className="size-4" />
                  Start from Scratch
                </Button>
              </CardContent>
            </Card>

            {/* Past Projects */}
            <div className="flex items-center gap-2">
              <FolderOpen className="size-5 text-cyan-400" />
              <h2 className="text-lg font-semibold text-foreground">Past Projects</h2>
            </div>

            <Card className="border-border/40 bg-card/60">
              <CardContent className="p-0">
                <ScrollArea className="max-h-[calc(100vh-340px)]">
                  <div className="flex flex-col divide-y divide-border/40">
                    {PLACEHOLDER_PROJECTS.map((project) => (
                      <div
                        key={project.id}
                        className="flex items-center gap-3 p-4 hover:bg-secondary/30 transition-colors group"
                      >
                        {/* Icon */}
                        <div className={cn(
                          "size-10 rounded-lg flex items-center justify-center shrink-0",
                          project.status === "completed"
                            ? "bg-green-500/10"
                            : project.status === "in-progress"
                              ? "bg-teal-500/10"
                              : "bg-secondary"
                        )}>
                          <Shield className={cn(
                            "size-5",
                            project.status === "completed"
                              ? "text-green-400"
                              : project.status === "in-progress"
                                ? "text-teal-400"
                                : "text-muted-foreground"
                          )} />
                        </div>

                        {/* Info */}
                        <div className="flex flex-col gap-1 flex-1 min-w-0">
                          <span className="text-sm font-medium text-foreground truncate">
                            {project.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-1.5 py-0",
                                CATEGORY_COLORS[project.scamType] || "text-muted-foreground"
                              )}
                            >
                              {project.scamType}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Clock className="size-3" />
                              {project.date}
                            </span>
                          </div>
                        </div>

                        {/* Status + Action */}
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] px-1.5 py-0", STATUS_STYLES[project.status])}
                          >
                            {STATUS_LABELS[project.status]}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleResumeProject(project)}
                          >
                            {project.status === "completed" ? "View" : "Resume"}
                            <ArrowRight className="size-3 ml-1" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* ── News Detail Modal ─────────────────────────────────── */}
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden border-border/40 bg-card/95 backdrop-blur-xl">
          {selectedNews && (
            <>
              {/* Header */}
              <DialogHeader className="p-6 pb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      CATEGORY_COLORS[selectedNews.category] || "text-muted-foreground"
                    )}
                  >
                    {selectedNews.category}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{selectedNews.source}</span>
                  <span className="text-xs text-muted-foreground/50">·</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="size-3" />
                    {selectedNews.date}
                  </span>
                </div>
                <DialogTitle className="text-xl leading-snug pr-8">
                  {selectedNews.headline}
                </DialogTitle>
                <DialogDescription className="text-sm leading-relaxed mt-1">
                  {selectedNews.summary}
                </DialogDescription>
              </DialogHeader>

              <Separator />

              {/* Article summary */}
              <ScrollArea className="flex-1 overflow-y-auto">
                <div className="px-6 py-4 flex flex-col gap-4">
                  <p className="text-sm text-foreground/90 leading-relaxed">
                    {selectedNews.summary}
                  </p>

                  {/* Source link */}
                  <a
                    href={selectedNews.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors w-fit"
                  >
                    <ExternalLink className="size-3" />
                    Read full article
                  </a>
                </div>
              </ScrollArea>

              {/* Footer */}
              <DialogFooter className="border-t border-border/40 p-4 sm:justify-stretch">
                <Button onClick={handleGenerateFromNews} className="w-full gap-2" size="lg">
                  <Play className="size-4" />
                  Generate Video from This
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

