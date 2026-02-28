"use client"

import { useState, useEffect } from "react"
import { useApp } from "@/lib/app-context"
import type { CharacterInfo } from "@/lib/app-context"
import { chatCharacterRefinement } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChatPanel } from "@/components/ui/chat-panel"
import type { ChatMessage } from "@/components/ui/chat-panel"
import { cn } from "@/lib/utils"
import {
  Users,
  ArrowRight,
  ArrowLeft,
  ShieldAlert,
  User,
  Loader2,
} from "lucide-react"

/** Map character role names to their reference image paths */
const CHARACTER_IMAGE_MAP: Record<string, string> = {}

interface BackendChatMessage {
  role: "user" | "assistant"
  content: string
}

export function PageCharacter() {
  const {
    sessionId,
    characterInfoList,
    setCharacterInfoList,
    recommendedCharacters,
    setCurrentStep,
  } = useApp()

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatHistory, setChatHistory] = useState<BackendChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [isRevealing, setIsRevealing] = useState(true)

  // Brief loading state before showing characters
  useEffect(() => {
    const timer = setTimeout(() => setIsRevealing(false), 5000)
    return () => clearTimeout(timer)
  }, [])

  // Use characterInfoList if available, otherwise build from recommendedCharacters
  const characters: CharacterInfo[] =
    characterInfoList.length > 0
      ? characterInfoList
      : recommendedCharacters.map((role) => ({
          role,
          type: role.toLowerCase().includes("victim") ? "person" as const : "scammer" as const,
          description: "",
          imageUrl: CHARACTER_IMAGE_MAP[role] || null,
          imageBase64: null,
        }))

  const handleChatSend = async () => {
    const message = chatInput.trim()
    if (!message || isChatLoading || !sessionId) return

    setChatInput("")
    setChatMessages((prev) => [...prev, { role: "user", text: message }])
    setIsChatLoading(true)

    try {
      const result = await chatCharacterRefinement({
        session_id: sessionId,
        message,
        chat_history: chatHistory,
      })

      // Update chat history
      const newHistory: BackendChatMessage[] = [
        ...chatHistory,
        { role: "user" as const, content: message },
        { role: "assistant" as const, content: result.response },
      ]
      setChatHistory(newHistory)

      // Show AI response
      setChatMessages((prev) => [...prev, { role: "ai", text: result.response }])

      // If characters were updated, apply them
      if (result.updated && result.updated_characters) {
        const updatedInfoList: CharacterInfo[] = result.updated_characters.map((c) => ({
          role: c.role,
          type: c.type,
          description: c.description,
          imageUrl: c.image_url,
          imageBase64: c.image_base64,
        }))
        setCharacterInfoList(updatedInfoList)
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { role: "ai", text: "Sorry, something went wrong. Please try again." },
      ])
    } finally {
      setIsChatLoading(false)
    }
  }

  if (isRevealing && characters.length > 0) {
    return (
      <div className="flex flex-col gap-6 max-w-[1200px] mx-auto w-full items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Loader2 className="size-10 animate-spin text-teal-400" />
            <div className="absolute inset-0 rounded-full pulse-ring" />
          </div>
          <h2 className="text-xl font-semibold text-foreground tracking-tight">Generating Characters...</h2>
          <p className="text-muted-foreground text-sm text-center max-w-md">
            Creating character designs and reference images for your video. This may take a moment.
          </p>
        </div>
      </div>
    )
  }

  if (characters.length === 0) {
    return (
      <div className="flex flex-col gap-6 max-w-[1200px] mx-auto w-full items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Users className="size-10 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground">No Characters Yet</h2>
          <p className="text-muted-foreground text-sm text-center max-w-md">
            Characters will be generated once scenes are created in The Studio.
          </p>
          <Button variant="outline" onClick={() => setCurrentStep(2)} size="sm">
            <ArrowLeft className="size-4" />
            Back to Studio
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto w-full">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-foreground text-balance tracking-tight">
          Characters
        </h1>
        <p className="text-muted-foreground text-sm">
          Review the characters for your scam awareness video. Use the chat to refine character designs — updated images and descriptions will be regenerated.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Character Cards */}
        <ScrollArea className="max-h-[calc(100vh-280px)]">
          <div className="grid gap-4 md:grid-cols-2 pr-3">
            {characters.map((char) => {
              const isScammer = char.type === "scammer"
              const imageUrl = char.imageBase64 || char.imageUrl || CHARACTER_IMAGE_MAP[char.role] || null

              return (
                <Card
                  key={char.role}
                  className="border-border bg-card overflow-hidden"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                        {isScammer ? (
                          <ShieldAlert className="size-4 text-red-400 shrink-0" />
                        ) : (
                          <User className="size-4 text-teal-400 shrink-0" />
                        )}
                        {char.role}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className={
                          isScammer
                            ? "text-red-400 border-red-500/30 bg-red-500/10 text-xs ml-auto shrink-0"
                            : "text-teal-400 border-teal-500/30 bg-teal-500/10 text-xs ml-auto shrink-0"
                        }
                      >
                        {isScammer ? "Scammer" : "Person"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    {/* Character Reference Image */}
                    {imageUrl ? (
                      <div className="w-full aspect-square rounded-lg overflow-hidden ring-1 ring-border/60 bg-secondary/30">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imageUrl}
                          alt={char.role}
                          className="object-cover size-full"
                        />
                      </div>
                    ) : (
                      <div className="w-full aspect-square rounded-lg bg-secondary/30 border border-dashed border-border/50 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <User className="size-12" />
                          <span className="text-xs">Reference image pending</span>
                        </div>
                      </div>
                    )}

                    {/* Character Description */}
                    {char.description ? (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                          Visual Description
                        </label>
                        <p className="text-sm text-foreground/90 leading-relaxed">
                          {char.description}
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                          Visual Description
                        </label>
                        <p className="text-sm text-muted-foreground italic">
                          Description will be generated during video production.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </ScrollArea>

        {/* Chat Panel */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
          <ChatPanel
            title="Refine Characters"
            messages={chatMessages}
            input={chatInput}
            onInputChange={setChatInput}
            onSend={handleChatSend}
            isLoading={isChatLoading}
            disabled={!sessionId}
            placeholder="Change the victim's outfit to casual..."
            emptyStateText="Describe how you'd like to change the character designs — appearance, outfits, expressions, or poses."
            loadingText="Regenerating characters..."
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-2 justify-end">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(2)}
          size="sm"
        >
          <ArrowLeft className="size-4" />
          Back to Studio
        </Button>
        <Button onClick={() => setCurrentStep(4)} size="sm">
          Proceed to Preview
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
