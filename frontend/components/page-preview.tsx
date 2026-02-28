"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useApp } from "@/lib/app-context"
import { generatePreviewFrames, chatPreviewFrames } from "@/lib/api"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChatPanel } from "@/components/ui/chat-panel"
import { cn } from "@/lib/utils"
import { Film, ImageIcon, Loader2, AlertCircle, ArrowLeft, ArrowRight } from "lucide-react"

const languageCodeMap: Record<string, string> = {
  english: "en",
  malay: "bm",
  mandarin: "zh",
  tamil: "ta",
}

export function PagePreview() {
  const { sessionId, config, previewState, setPreviewState, setCurrentStep } = useApp()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "ai"; text: string }>>(
    [],
  )
  const [chatHistory, setChatHistory] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([])
  const [chatInput, setChatInput] = useState("")
  const [isChatLoading, setIsChatLoading] = useState(false)

  useEffect(() => {
    if (!sessionId || previewState || isLoading) return
    handleGenerate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const handleGenerate = async () => {
    if (!sessionId) return
    setIsLoading(true)
    setError(null)
    try {
      const languageCode = languageCodeMap[config.language] ?? "en"
      const response = await generatePreviewFrames({
        session_id: sessionId,
        language_code: languageCode,
      })
      setPreviewState(response.preview_state)
    } catch (err) {
      console.error("Failed to generate preview frames:", err)
      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate preview frames. Please try again."
      )
    } finally {
      setIsLoading(false)
    }
  }

  const frames = previewState?.frames ?? []

  const handleChatSend = async () => {
    if (!sessionId || !chatInput.trim() || isChatLoading) return

    const userText = chatInput.trim()
    setChatInput("")

    const nextMessages = [...chatMessages, { role: "user", text: userText }]
    const nextHistory = [
      ...chatHistory,
      {
        role: "user" as const,
        content: userText,
      },
    ]

    setChatMessages(nextMessages)
    setChatHistory(nextHistory)
    setIsChatLoading(true)

    try {
      const response = await chatPreviewFrames({
        session_id: sessionId,
        message: userText,
        chat_history: nextHistory,
      })

      setChatMessages((prev) => [...prev, { role: "ai", text: response.response }])

      if (response.updated && response.updated_frames) {
        setPreviewState(response.updated_frames)
      }
    } catch (err) {
      console.error("Failed to chat about preview frames:", err)
      const errorMessage = err instanceof Error 
        ? err.message 
        : typeof err === 'string' 
          ? err 
          : "Maaf, saya menghadapi masalah untuk mengemas kini preview. Sila cuba lagi sebentar lagi."
      setChatMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: errorMessage,
        },
      ])
    } finally {
      setIsChatLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto w-full">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-foreground text-balance tracking-tight">Preview</h1>
        <p className="text-muted-foreground text-sm">
          Automatically generated start and end frames for each scene. Use this step to catch
          visual issues before committing to full video generation.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Frames grid */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <Film className="size-4 text-teal-400" />
              Scene Preview Frames
            </CardTitle>
            {previewState && (
              <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 text-xs">
                {previewState.frames.length} frames
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
                <AlertCircle className="size-4 mt-0.5" />
                <div>
                  <p>{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={handleGenerate}
                    disabled={isLoading}
                  >
                    <Loader2 className={cn("size-3 mr-1", isLoading && "animate-spin")} />
                    Retry
                  </Button>
                </div>
              </div>
            )}

            {!previewState && !error && (
              <div className="flex items-center justify-center p-10 border border-dashed border-border/50 rounded-lg bg-secondary/10">
                <div className="flex flex-col items-center gap-3 text-center">
                  {isLoading ? (
                    <>
                      <div className="relative">
                        <Loader2 className="size-8 text-teal-400/60 animate-spin" />
                        <div className="absolute inset-0 rounded-full pulse-ring" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Generating preview frames from your script...
                      </p>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="size-8 text-muted-foreground/60" />
                      <p className="text-sm text-muted-foreground">
                        Preview frames will be generated automatically.
                      </p>
                      <Button variant="outline" size="sm" onClick={handleGenerate}>
                        Generate Preview Frames
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}

            {previewState && frames.length > 0 && (
              <div className="rounded-lg border border-border/60 bg-secondary/10 p-3">
                <ScrollArea className="h-[calc(100vh-300px)]">
                  <div className="flex flex-col gap-4 pr-3">
                    {Array.from(new Set(frames.map((f) => f.scene_id))).map((sceneId) => {
                      const sceneFrames = frames.filter((f) => f.scene_id === sceneId)
                      const startFrame = sceneFrames.find((f) => f.frame_type === "start")
                      const endFrame = sceneFrames.find((f) => f.frame_type === "end")

                      return (
                        <Card key={sceneId} className="border-border/40 bg-secondary/20">
                          <CardHeader className="pb-2 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="text-teal-400 border-teal-500/30 bg-teal-500/10 text-xs"
                              >
                                Scene {sceneId}
                              </Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="flex flex-col gap-3">
                            <div className="grid gap-3 md:grid-cols-2">
                              {[startFrame, endFrame].map((frame, idx) => (
                                <div
                                  key={idx}
                                  className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/60 p-3"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                      {idx === 0 ? "Start Frame" : "End Frame"}
                                    </span>
                                    <Badge variant="outline" className="text-[10px]">
                                      {frame ? "Generated" : "Pending"}
                                    </Badge>
                                  </div>
                                  <div className="relative w-full aspect-video rounded-md bg-secondary/40 border border-border/60 flex items-center justify-center overflow-hidden">
                                    {frame?.image_data ? (
                                      <Image
                                        src={frame.image_data}
                                        alt={`Scene ${frame.scene_id} ${frame.frame_type} frame`}
                                        fill
                                        className="object-cover"
                                        unoptimized
                                      />
                                    ) : (
                                      <ImageIcon className="size-8 text-muted-foreground/40" />
                                    )}
                                  </div>
                                  {frame?.visual_prompt && (
                                    <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                                      {frame.visual_prompt}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chat + navigation */}
        <div className="lg:sticky lg:top-24 h-fit flex flex-col gap-4">
          <ChatPanel
            title="Preview Refinement"
            messages={chatMessages}
            input={chatInput}
            onInputChange={setChatInput}
            onSend={handleChatSend}
            isLoading={isChatLoading}
            disabled={!sessionId}
            placeholder="Adjust visual style, composition, mood..."
            emptyStateText="Ask me to change the visual style, composition, or mood of any scene."
          />

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(2)}
              size="sm"
              className="flex-1"
            >
              <ArrowLeft className="size-4" />
              Back to Studio
            </Button>
            <Button
              onClick={() => setCurrentStep(5)}
              size="sm"
              className="flex-1"
              disabled={!previewState && !error}
            >
              Generate Video
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}


