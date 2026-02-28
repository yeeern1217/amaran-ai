"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, Send, Sparkles } from "lucide-react"

export interface ChatMessage {
  role: "user" | "ai"
  text: string
}

interface ChatPanelProps {
  messages: ChatMessage[]
  input: string
  onInputChange: (value: string) => void
  onSend: () => void
  isLoading: boolean
  disabled?: boolean
  title?: string
  icon?: ReactNode
  placeholder?: string
  emptyStateText?: string
  loadingText?: string
  /** Extra content rendered below the title inside the card header area */
  headerExtra?: ReactNode
  className?: string
}

export function ChatPanel({
  messages,
  input,
  onInputChange,
  onSend,
  isLoading,
  disabled = false,
  title = "AI Assistant",
  icon,
  placeholder = "Type a message...",
  emptyStateText = "Ask me to make changes — I can adjust visuals, tone, and more.",
  loadingText = "Thinking...",
  headerExtra,
  className,
}: ChatPanelProps) {
  const chatContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = chatContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [messages, isLoading])

  return (
    <Card className={cn("border-border bg-card flex flex-col", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
          {icon ?? <Sparkles className="size-4 text-cyan-400" />}
          {title}
        </CardTitle>
        {headerExtra}
      </CardHeader>
      <CardContent className="flex flex-col flex-1 gap-3">
        {/* Hint box */}
        <div className="rounded-lg bg-gradient-to-r from-cyan-500/10 to-teal-500/5 border border-cyan-500/20 p-3 text-sm text-cyan-300">
          {emptyStateText}
        </div>

        {/* Messages */}
        <div ref={chatContainerRef} className="flex flex-col gap-2 flex-1 min-h-[300px] max-h-[calc(100vh-480px)] overflow-y-auto overflow-x-hidden">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={cn(
                "rounded-lg px-3 py-2 text-sm max-w-[85%] break-words overflow-hidden whitespace-pre-wrap",
                msg.role === "user"
                  ? "bg-cyan-500/90 text-white self-end shadow-[0_2px_10px_oklch(0.60_0.14_200/0.15)]"
                  : "bg-secondary/80 text-foreground self-start backdrop-blur-sm",
              )}
            >
              {msg.text}
            </div>
          ))}
          {isLoading && (
            <div className="bg-secondary text-foreground self-start rounded-lg px-3 py-2 text-sm flex items-center gap-2">
              <Loader2 className="size-3 animate-spin" />
              {loadingText}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isLoading && onSend()}
            placeholder={placeholder}
            className="bg-input border-border text-foreground placeholder:text-muted-foreground"
            disabled={isLoading || disabled}
          />
          <Button
            size="icon"
            onClick={onSend}
            disabled={!input.trim() || isLoading || disabled}
            className="bg-cyan-500 hover:bg-cyan-600"
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            <span className="sr-only">Send message</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
