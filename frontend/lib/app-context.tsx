"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import type { VisualAudioState, PreviewState, SceneCharacterAssignment, SocialOutput } from "@/lib/api"

export interface FactCheck {
  scam_name: string
  story_hook: string
  red_flag: string
  the_fix: string
  reference_sources: string[]
  category: string
  verified_by_officer: boolean
  verification_timestamp: string | null
  officer_notes: string | null
  // Deep Research insights
  global_ancestry: string | null
  psychological_exploit: string | null
  victim_profile: string | null
  counter_hack: string | null
  // Granular verification fields for UI
  scam_name_verified: boolean
  story_hook_verified: boolean
  red_flag_verified: boolean
  the_fix_verified: boolean
  reference_sources_verified: boolean
}

export interface ConfigData {
  avatar: string
  language: string
  targetAudience: string
  tone: string
  videoFormat: string
  videoLength: string
}

export interface SceneData {
  id: number
  description: string
  dialogue: string
  generated: boolean
  duration: number
}

export interface CharacterInfo {
  role: string
  type: "person" | "scammer"
  description: string
  imageUrl: string | null
  /** Base64-encoded image data (data:image/png;base64,...) from Nano Banana */
  imageBase64: string | null
}

export interface SensitivityFlag {
  severity: "warning" | "critical"
  issueType: string
  description: string
  sceneId?: number
  suggestedFix?: string
  regulationReference?: string
}

export interface ComplianceAnalysis {
  category: string
  status: "passed" | "warning" | "flagged"
  analysis: string
  elementsReviewed: string[]
}

export interface SensitivityReport {
  projectId: string
  passed: boolean
  flags: SensitivityFlag[]
  complianceSummary: string
  detailedAnalysis: ComplianceAnalysis[]
  checkedAgainst: string[]
}

interface AppState {
  // Landing
  showLanding: boolean
  setShowLanding: (val: boolean) => void
  // Session
  sessionId: string | null
  setSessionId: (id: string | null) => void
  // Navigation
  currentStep: number
  setCurrentStep: (step: number) => void
  // Input
  newsInput: string
  setNewsInput: (input: string) => void
  // Fact check
  factCheck: FactCheck
  setFactCheck: (fc: FactCheck) => void
  isAnalyzed: boolean
  setIsAnalyzed: (val: boolean) => void
  // Config
  config: ConfigData
  setConfig: (config: ConfigData) => void
  recommendedAvatars: string[]
  setRecommendedAvatars: (avatars: string[]) => void
  // Characters
  recommendedCharacters: string[]
  setRecommendedCharacters: (chars: string[]) => void
  characterInfoList: CharacterInfo[]
  setCharacterInfoList: (chars: CharacterInfo[]) => void
  // Scenes
  scenes: SceneData[]
  setScenes: (scenes: SceneData[]) => void
  scenesGenerated: boolean
  setScenesGenerated: (val: boolean) => void
  // Safety
  sensitivityReport: SensitivityReport | null
  setSensitivityReport: (report: SensitivityReport | null) => void
  // Visual/Audio
  visualAudioState: VisualAudioState | null
  setVisualAudioState: (state: VisualAudioState | null) => void
  visualAudioStatus: "idle" | "running" | "completed" | "error"
  setVisualAudioStatus: (status: "idle" | "running" | "completed" | "error") => void
  // Preview frames
  previewState: PreviewState | null
  setPreviewState: (state: PreviewState | null) => void
  // Social
  socialOutput: SocialOutput | null
  setSocialOutput: (output: SocialOutput | null) => void
  // Reset
  resetSession: () => void
}

const AppContext = createContext<AppState | null>(null)

const defaultFactCheck: FactCheck = {
  scam_name: "",
  story_hook: "",
  red_flag: "",
  the_fix: "",
  reference_sources: [],
  category: "",
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
}

const defaultConfig: ConfigData = {
  avatar: "officer_malay_male_01",
  language: "english",
  targetAudience: "general",
  tone: "urgent",
  videoFormat: "reels",
  videoLength: "90s",
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [showLanding, setShowLanding] = useState(true)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [newsInput, setNewsInput] = useState("")
  const [isAnalyzed, setIsAnalyzed] = useState(false)
  const [factCheck, setFactCheck] = useState<FactCheck>(defaultFactCheck)
  const [config, setConfig] = useState<ConfigData>(defaultConfig)
  const [scenes, setScenes] = useState<SceneData[]>([])
  const [scenesGenerated, setScenesGenerated] = useState(false)
  const [recommendedAvatars, setRecommendedAvatars] = useState<string[]>([])
  const [recommendedCharacters, setRecommendedCharacters] = useState<string[]>([])
  const [characterInfoList, setCharacterInfoList] = useState<CharacterInfo[]>([])
  const [sensitivityReport, setSensitivityReport] = useState<SensitivityReport | null>(null)
  const [visualAudioState, setVisualAudioState] = useState<VisualAudioState | null>(null)
  const [visualAudioStatus, setVisualAudioStatus] = useState<"idle" | "running" | "completed" | "error">("idle")
  const [previewState, setPreviewState] = useState<PreviewState | null>(null)
  const [socialOutput, setSocialOutput] = useState<SocialOutput | null>(null)

  function resetSession() {
    setShowLanding(true)
    setSessionId(null)
    setCurrentStep(0)
    setNewsInput("")
    setIsAnalyzed(false)
    setFactCheck(defaultFactCheck)
    setConfig(defaultConfig)
    setScenes([])
    setScenesGenerated(false)
    setRecommendedAvatars([])
    setRecommendedCharacters([])
    setCharacterInfoList([])
    setSensitivityReport(null)
    setVisualAudioState(null)
    setVisualAudioStatus("idle")
    setPreviewState(null)
    setSocialOutput(null)
  }

  return (
    <AppContext.Provider
      value={{
        showLanding,
        setShowLanding,
        sessionId,
        setSessionId,
        currentStep,
        setCurrentStep,
        newsInput,
        setNewsInput,
        factCheck,
        setFactCheck,
        config,
        setConfig,
        recommendedAvatars,
        setRecommendedAvatars,
        recommendedCharacters,
        setRecommendedCharacters,
        characterInfoList,
        setCharacterInfoList,
        scenes,
        setScenes,
        scenesGenerated,
        setScenesGenerated,
        sensitivityReport,
        setSensitivityReport,
        visualAudioState,
        setVisualAudioState,
        visualAudioStatus,
        setVisualAudioStatus,
        previewState,
        setPreviewState,
        socialOutput,
        setSocialOutput,
        isAnalyzed,
        setIsAnalyzed,
        resetSession,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be inside AppProvider")
  return ctx
}
