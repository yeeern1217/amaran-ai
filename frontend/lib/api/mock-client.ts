/**
 * Mock API Client for Demo/Pitch Mode
 *
 * Drop-in replacement for client.ts that returns hardcoded responses
 * with realistic simulated delays for smooth pitching.
 *
 * NO real API calls are made when following the scripted demo flow.
 *
 * Deviation triggers real backend:
 *  - Different news article or manual text input → real intake + full real pipeline
 *  - Chat message not matching any preset → lazy real session + real AI response
 */

import type {
  FrontendFactCheck,
  IntakeResponse,
  GenerateResponse,
  ChatResponse,
  Avatar,
  ConfigResponse,
  VideoAssetsResponse,
  RecommendAvatarsRequest,
  RecommendAvatarsResponse,
  GeneratePreviewFramesRequest,
  GeneratePreviewFramesResponse,
  ChatPreviewFramesRequest,
  ChatPreviewFramesResponse,
  ChatCharacterRequest,
  ChatCharacterResponse,
  SerperNewsResponse,
  SocialGenerateResponse,
  ChatSocialResponse,
  VideoAssetsStatusResponse,
  BackendFactSheet,
  CaptionsResponse,
  YouTubePublishRequest,
  YouTubePublishResponse,
  InstagramPublishRequest,
  InstagramPublishResponse,
} from "./client";

import * as realClient from "./client";

import {
  MOCK_SESSION_ID,
  MOCK_NEWS,
  MOCK_FACT_SHEET,
  MOCK_AVATARS,
  MOCK_CONFIG,
  MOCK_RECOMMENDED_AVATARS,
  MOCK_GENERATE_RESPONSE,
  MOCK_GENERATE_RESPONSE_BM,
  MOCK_PREVIEW_STATE,
  MOCK_SOCIAL_OUTPUT,
  MOCK_VISUAL_AUDIO_STATE,
  MOCK_VISUAL_AUDIO_STATE_BM,
  MOCK_CHARACTER_DESCRIPTIONS,
  MOCK_CHARACTER_DESCRIPTIONS_INITIAL,
  MOCK_FACTSHEET_CHAT_PRESETS,
  MOCK_FACTSHEET_CHAT_DEFAULT_RESPONSE,
  MOCK_VIDEO_CHAT_PRESETS,
  MOCK_VIDEO_CHAT_DEFAULT_RESPONSE,
  MOCK_PREVIEW_CHAT_PRESETS,
  MOCK_PREVIEW_CHAT_DEFAULT_RESPONSE,
  MOCK_SOCIAL_CHAT_PRESETS,
  MOCK_SOCIAL_CHAT_DEFAULT_RESPONSE,
  MOCK_CHARACTER_CHAT_PRESETS,
  MOCK_CHARACTER_CHAT_DEFAULT_RESPONSE,
  MOCK_CAPTIONS,
} from "./mock-data";

// ==================== Helpers ====================

function delay(_ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 1000));
}

/** Chat responses get an extra second so the AI feels like it's thinking. */
function chatDelay(): Promise<void> {
  return delay(1000).then(() => delay(1000));
}

function createFrontendFactCheck(
  backend: BackendFactSheet,
  overrideVerified?: boolean
): FrontendFactCheck {
  const allVerified = overrideVerified ?? backend.verified_by_officer;
  return {
    ...backend,
    global_ancestry: backend.global_ancestry ?? null,
    psychological_exploit: backend.psychological_exploit ?? null,
    victim_profile: backend.victim_profile ?? null,
    counter_hack: backend.counter_hack ?? null,
    scam_name_verified: allVerified,
    story_hook_verified: allVerified,
    red_flag_verified: allVerified,
    the_fix_verified: allVerified,
    reference_sources_verified: allVerified,
  };
}

function findPreset<T extends { trigger: string }>(
  message: string,
  presets: T[]
): T | null {
  const lower = message.toLowerCase();
  return presets.find((p) => lower.includes(p.trigger)) ?? null;
}

/**
 * Tracks whether we have a real backend session.
 * Only created lazily when the user deviates from the demo flow.
 */
let _realSessionId: string | null = null;
let _realSessionPromise: Promise<string | null> | null = null;

/** When true, ALL subsequent pipeline calls route to the real backend. */
let _usingRealPipeline = false;

/** Tracks the latest selected audio language for demo stitched export fallback. */
let _latestAudioLanguageCode: string = "en";

/**
 * Known mock news URLs from MOCK_NEWS.
 * If intake input matches any of these, we stay on the mock path.
 * Anything else is treated as a deviation → real backend.
 */
const DEMO_INPUT_FRAGMENTS = [
  "rm42-million-lost-to-fake-delivery-scam",
];

const DEMO_GENERATE_DEFAULTS = {
  targetGroup: "general public",
  language: "english",
  tone: "urgent/warning",
  avatarId: "officer_malay_male_01",
  videoFormat: "landscape",
  videoDurationSeconds: 90,
};

function normalizeValue(value: string): string {
  return value.trim().toLowerCase();
}

function isDemoGenerateConfig(config: {
  targetGroups: string[];
  languages: string[];
  tone: string;
  avatarId: string;
  videoFormat: string;
  videoDurationSeconds?: number;
}): boolean {
  const normalizedTargetGroups = config.targetGroups.map(normalizeValue);
  const normalizedLanguages = config.languages.map(normalizeValue);
  const normalizedTone = normalizeValue(config.tone);
  const normalizedAvatarId = normalizeValue(config.avatarId);
  const normalizedFormat = normalizeValue(config.videoFormat);
  const duration = config.videoDurationSeconds ?? DEMO_GENERATE_DEFAULTS.videoDurationSeconds;

  const isDefaultTargetGroup =
    normalizedTargetGroups.length === 1 &&
    normalizedTargetGroups[0] === DEMO_GENERATE_DEFAULTS.targetGroup;
  const isDefaultLanguage =
    normalizedLanguages.length === 1 &&
    normalizedLanguages[0] === DEMO_GENERATE_DEFAULTS.language;
  const isDefaultTone =
    normalizedTone === DEMO_GENERATE_DEFAULTS.tone ||
    normalizedTone === "urgent warning" ||
    normalizedTone === "urgent";

  return (
    isDefaultTargetGroup &&
    isDefaultLanguage &&
    isDefaultTone &&
    normalizedAvatarId === DEMO_GENERATE_DEFAULTS.avatarId &&
    normalizedFormat === DEMO_GENERATE_DEFAULTS.videoFormat &&
    duration === DEMO_GENERATE_DEFAULTS.videoDurationSeconds
  );
}

function isDemoInput(content: string): boolean {
  const lower = content.toLowerCase();
  return DEMO_INPUT_FRAGMENTS.some((frag) => lower.includes(frag));
}

/**
 * Lazily create a real backend session on first chat deviation.
 * Runs intake + generateVideoPackage so the backend has scenes/characters
 * ready for subsequent chat calls.
 */
async function ensureRealSession(): Promise<string | null> {
  if (_realSessionId) return _realSessionId;
  if (_realSessionPromise) return _realSessionPromise;
  _realSessionPromise = (async () => {
    try {
      const result = await realClient.submitIntake(
        "Macau Scam digital arrest",
        "manual_description",
        undefined,
        false
      );
      _realSessionId = result.session_id;
      _usingRealPipeline = true;
      console.log("[DEMO] Real backend session created on deviation:", _realSessionId);

      // Verify fact sheet first (required before generate)
      try {
        await realClient.verifyFactSheet(_realSessionId, "officer-auto", undefined, "Auto-verified for demo deviation");
        console.log("[DEMO] Fact sheet auto-verified for deviation session");
      } catch (err) {
        console.warn("[DEMO] verifyFactSheet failed:", err);
      }

      // Also run generateVideoPackage so characters/scenes exist for chat
      try {
        await realClient.generateVideoPackage(_realSessionId, {
          targetGroups: ["Elderly", "General Public"],
          languages: ["English"],
          tone: "Urgent/Warning",
          avatarId: "officer_malay_male_01",
          videoFormat: "landscape",
          videoDurationSeconds: 90,
        });
        console.log("[DEMO] Real backend video package generated for deviation session");
      } catch (err) {
        console.warn("[DEMO] generateVideoPackage on deviation session failed (chat may still work):", err);
      }

      return _realSessionId;
    } catch (err) {
      console.warn("[DEMO] Backend unavailable:", (err as Error).message);
      _realSessionPromise = null; // allow retry
      return null;
    }
  })();
  return _realSessionPromise;
}

// ==================== Pipeline Functions (Mock) ====================

export async function submitIntake(
  content: string,
  sourceType: "manual_description" | "news_url" | "police_report" = "manual_description",
  additionalContext?: string,
  useDeepResearch?: boolean
): Promise<{ session_id: string; fact_check: FrontendFactCheck }> {
  // Deep Research toggle should always use real backend.
  if (useDeepResearch) {
    try {
      const result = await realClient.submitIntake(content, sourceType, additionalContext, true);
      _realSessionId = result.session_id;
      _usingRealPipeline = true;
      console.log("[DEMO] Deep Research enabled — switched to real pipeline:", _realSessionId);
      return result;
    } catch (err) {
      console.error("[DEMO] Deep Research requires real backend, but intake failed:", err);
      throw new Error("Deep Research requires a reachable real backend. Please ensure backend is running and API URL is correct.");
    }
  }

  // If input matches a demo article → pure mock
  if (isDemoInput(content)) {
    await delay(10500);
    return {
      session_id: MOCK_SESSION_ID,
      fact_check: createFrontendFactCheck(MOCK_FACT_SHEET),
    };
  }

  // Non-demo input → call real backend
  try {
    const result = await realClient.submitIntake(content, sourceType, additionalContext, useDeepResearch ?? false);
    _realSessionId = result.session_id;
    _usingRealPipeline = true;
    console.log("[DEMO] Non-demo input detected — switched to real pipeline:", _realSessionId);
    return result;
  } catch (err) {
    console.error("[DEMO] ⚠️ Real backend intake failed! Check backend is running with AUTH_DISABLED=true.", err);
    await delay(10500);
    return {
      session_id: MOCK_SESSION_ID,
      fact_check: createFrontendFactCheck(MOCK_FACT_SHEET),
    };
  }
}

export async function submitIntakeStream(
  content: string,
  sourceType: "manual_description" | "news_url" | "police_report" = "manual_description",
  onThought: (thought: string) => void,
  additionalContext?: string,
  useDeepResearch: boolean = true
): Promise<{ session_id: string; fact_check: FrontendFactCheck }> {
  // Deep Research toggle should always use real backend streaming.
  if (useDeepResearch) {
    try {
      const result = await realClient.submitIntakeStream(content, sourceType, onThought, additionalContext, true);
      _realSessionId = result.session_id;
      _usingRealPipeline = true;
      console.log("[DEMO] Deep Research enabled — switched to real pipeline:", _realSessionId);
      return result;
    } catch (err) {
      console.error("[DEMO] Deep Research requires real backend stream, but request failed:", err);
      throw new Error("Deep Research requires a reachable real backend. Please ensure backend is running and API URL is correct.");
    }
  }

  // Non-demo input → call real backend (streaming)
  if (!isDemoInput(content)) {
    try {
      const result = await realClient.submitIntakeStream(content, sourceType, onThought, additionalContext, useDeepResearch);
      _realSessionId = result.session_id;
      _usingRealPipeline = true;
      console.log("[DEMO] Non-demo input detected — switched to real pipeline:", _realSessionId);
      return result;
    } catch (err) {
      console.error("[DEMO] ⚠️ Real backend intake stream failed! Check backend is running with AUTH_DISABLED=true.", err);
    }
  }

  // Demo input or real backend failed → mock path

  const mockThoughts = [
    "Planning research strategy for this scam pattern...",
    "Searching Malaysian government sources \u2014 PDRM, MCMC, Bank Negara Malaysia...",
    "Found 12 related news articles from The Star, NST, Bernama. Analyzing scam patterns...",
    "Retrieving PDRM Commercial Crime Investigation Department (CCID) case data for 2023-2025...",
    "Cross-referencing with INTERPOL Global Financial Fraud Assessment and UNODC reports...",
    "Pulling Bank Negara Financial Consumer Alert bulletins and AMLA enforcement actions...",
    "Tracing global ancestry \u2014 found similar Macau Scam variants in China (\u7535\u4fe1\u8bc8\u9a97), Taiwan, Hong Kong, and Singapore...",
    "Analyzing cognitive biases exploited: Milgram authority compliance + fear of criminal prosecution...",
    "Reading peer-reviewed research: Cialdini (2021) on compliance psychology, Cross & Kelly (2016) on telecom fraud...",
    "Researching victim demographics from MCMC Scam Calls Report 2024 and BNM Annual Report...",
    "Found 7 additional academic and policy references. Compiling source bibliography...",
    "Developing counter-hack strategy to break authority-fear spiral based on behavioural science evidence...",
    "Synthesizing findings into structured fact sheet with 18 verified references...",
  ];

  for (const thought of mockThoughts) {
    await delay(2800);
    onThought(thought);
  }

  await delay(2400);

  const factSheet: BackendFactSheet = {
    ...MOCK_FACT_SHEET,
    global_ancestry: "This is a variant of the \u2018Macau Scam\u2019, a telecommunications fraud originating from Chinese organized crime syndicates in the early 2000s. The playbook \u2014 cold-call \u2192 impersonate authority \u2192 fabricate criminal charges \u2192 demand money transfer \u2014 spread from mainland China to Taiwan, Hong Kong, and Southeast Asia. In Malaysia, it evolved to use local hooks: Pos Laju replaces China Post, PDRM replaces the PSB, and Bank Negara replaces the People\u2019s Bank of China. INTERPOL\u2019s 2024 Global Financial Fraud Assessment ranks it among the top 3 social-engineering scams in ASEAN.",
    psychological_exploit: "Authority Compliance + Fear of Criminal Prosecution. The scam weaponises Milgram-style obedience: victims comply because they believe they are speaking to a real police officer with the power to arrest them. The fabricated drug trafficking allegation triggers existential fear (\u2018I will go to jail\u2019), which overrides rational evaluation. The \u2018transfer to clear your name\u2019 demand exploits sunk-cost reasoning \u2014 once the victim has spent 30+ minutes on the call, hanging up feels like admitting guilt.",
    victim_profile: "Adults aged 40-65, particularly retirees, homemakers, and civil servants with savings of RM 10,000-50,000. They are law-abiding citizens with high respect for authority and low exposure to scam awareness campaigns. Key vulnerability: they have never interacted with police in a criminal context, so they cannot distinguish a real investigation from a fake one. MCMC data shows 63% of Macau Scam victims in Malaysia are women.",
    counter_hack: "Do NOT use logic to counter this scam \u2014 the authority-fear spiral must be broken first. Deploy an \u2018Identity Challenge\u2019: instruct the viewer that real police NEVER call to demand money transfers and NEVER threaten arrest over the phone. Provide a concrete anchor: \u2018Hang up. Call 999 or walk into your nearest police station \u2014 if there\u2019s a real case, they will know about it.\u2019 The physical act of hanging up breaks the psychological hold. Follow up with Bank Negara\u2019s official statement: \u2018BNM will never ask you to transfer money to any account.\u2019",
  };

  return {
    session_id: MOCK_SESSION_ID,
    fact_check: createFrontendFactCheck(factSheet),
  };
}

export async function verifyFactSheet(
  session_id: string,
  officer_id: string,
  corrections?: Partial<BackendFactSheet>,
  notes?: string
): Promise<{ fact_check: FrontendFactCheck; verified: boolean }> {
  // If using real pipeline, also verify on real backend
  if (_usingRealPipeline && _realSessionId) {
    try {
      return await realClient.verifyFactSheet(_realSessionId, officer_id, corrections, notes);
    } catch (err) {
      console.warn("[DEMO] Real verifyFactSheet failed, using mock:", err);
    }
  }

  await delay(2400);
  return {
    fact_check: createFrontendFactCheck(
      {
        ...MOCK_FACT_SHEET,
        verified_by_officer: true,
        verification_timestamp: new Date().toISOString(),
        officer_notes: notes || null,
      },
      true
    ),
    verified: true,
  };
}

export async function generateVideoPackage(
  sessionId: string,
  config: {
    targetGroups: string[];
    languages: string[];
    tone: string;
    avatarId: string;
    videoFormat: string;
    videoDurationSeconds?: number;
    directorInstructions?: string;
  }
): Promise<GenerateResponse> {
  // If using real pipeline, call real backend
  if (_usingRealPipeline && _realSessionId) {
    try {
      return await realClient.generateVideoPackage(_realSessionId, config);
    } catch (err) {
      console.warn("[DEMO] Real generateVideoPackage failed, using mock:", err);
    }
  }

  // Config deviation from scripted demo (e.g. different duration/format/language) -> real backend
  if (!isDemoGenerateConfig(config)) {
    const realId = await ensureRealSession();
    if (realId) {
      try {
        console.log("[DEMO] Non-demo generation config detected — switched to real pipeline:", config);
        return await realClient.generateVideoPackage(realId, config);
      } catch (err) {
        console.warn("[DEMO] Real generateVideoPackage on config deviation failed, using mock:", err);
      }
    }
  }

  // Mock path
  await delay(15000);

  const isMalay = config.languages.some(
    (lang) => lang.toLowerCase().includes("malay") || lang.toLowerCase().includes("melayu")
  );

  // Keep a best-effort language hint for stitched preview fallback.
  _latestAudioLanguageCode = isMalay ? "bm" : "en";

  const baseResponse = isMalay ? MOCK_GENERATE_RESPONSE_BM : MOCK_GENERATE_RESPONSE;

  return {
    ...baseResponse,
    recommended_characters: [
      "Retiree (Victim)",
      "Fake Pos Laju representative",
      "Fake senior police officer",
      "Fake Bank Negara Malaysia representative",
    ],
    character_descriptions: MOCK_CHARACTER_DESCRIPTIONS_INITIAL.map((c) => ({
      role: c.role,
      type: c.type,
      description: c.description,
      image_url: c.image_url,
      image_base64: null,
    })),
  };
}

// ==================== Chat Functions (Real backend with mock fallback) ====================

/**
 * Chat about fact sheet — tries real backend first, falls back to mock presets.
 */
export async function chatFactSheet(
  session_id: string,
  message: string,
  chat_history: Array<{ role: "user" | "assistant"; content: string }> = []
): Promise<{
  response: string;
  fact_check?: FrontendFactCheck;
  updated: boolean;
}> {
  // Try mock preset first (happy-path demo)
  const preset = findPreset(message, MOCK_FACTSHEET_CHAT_PRESETS);
  if (preset) {
    await chatDelay();
    return {
      response: preset.response,
      fact_check: preset.updatedFactCheck,
      updated: true,
    };
  }

  // No preset matched — deviation! Lazily create real session and call backend.
  const realId = await ensureRealSession();
  if (realId) {
    try {
      return await realClient.chatFactSheet(realId, message, chat_history);
    } catch (err) {
      console.warn("[DEMO] Real chat/factsheet failed, using default fallback:", err);
    }
  }

  await chatDelay();
  return {
    response: MOCK_FACTSHEET_CHAT_DEFAULT_RESPONSE,
    fact_check: createFrontendFactCheck(MOCK_FACT_SHEET),
    updated: false,
  };
}

/**
 * Chat about video package — tries real backend first, falls back to mock presets.
 */
export async function chatVideoPackage(
  sessionId: string,
  message: string,
  chatHistory: Array<{ role: "user" | "assistant"; content: string }> = []
): Promise<ChatResponse> {
  // Try mock preset first (happy-path demo)
  const preset = findPreset(message, MOCK_VIDEO_CHAT_PRESETS);
  if (preset) {
    await chatDelay();
    return {
      session_id: sessionId,
      response: preset.response,
      director_output: {
        project_id: sessionId,
        master_script: "Updated Pos Laju Verification Scam \u2014 Dramatised",
        scene_breakdown: preset.updatedSceneBreakdown,
      },
      updated: true,
    };
  }

  // No preset matched — deviation! Lazily create real session and call backend.
  const realId = await ensureRealSession();
  if (realId) {
    try {
      return await realClient.chatVideoPackage(realId, message, chatHistory);
    } catch (err) {
      console.warn("[DEMO] Real chat/video-package failed, using default fallback:", err);
    }
  }

  await chatDelay();
  return {
    session_id: sessionId,
    response: MOCK_VIDEO_CHAT_DEFAULT_RESPONSE,
    updated: false,
  };
}

/**
 * Chat to refine character designs — tries real backend first, falls back to mock presets.
 */
export async function chatCharacterRefinement(
  request: ChatCharacterRequest
): Promise<ChatCharacterResponse> {
  // Try mock preset first (happy-path demo)
  const preset = findPreset(request.message, MOCK_CHARACTER_CHAT_PRESETS);
  if (preset) {
    await chatDelay();
    return {
      session_id: request.session_id,
      response: preset.response,
      updated_characters: preset.updatedCharacters.map((c) => ({
        role: c.role,
        type: c.type,
        description: c.description,
        image_url: c.image_url,
        image_base64: null,
      })),
      updated: true,
    };
  }

  // No preset matched — deviation! Lazily create real session and call backend.
  const realId = await ensureRealSession();
  if (realId) {
    try {
      return await realClient.chatCharacterRefinement({
        ...request,
        session_id: realId,
      });
    } catch (err) {
      console.warn("[DEMO] Real chat/characters failed, using default fallback:", err);
    }
  }

  await chatDelay();
  return {
    session_id: request.session_id,
    response: MOCK_CHARACTER_CHAT_DEFAULT_RESPONSE,
    updated_characters: MOCK_CHARACTER_DESCRIPTIONS.map((c) => ({
      role: c.role,
      type: c.type,
      description: c.description,
      image_url: c.image_url,
      image_base64: null,
    })),
    updated: true,
  };
}

/**
 * Chat about preview frames — tries real backend first, falls back to mock presets.
 */
export async function chatPreviewFrames(
  request: ChatPreviewFramesRequest
): Promise<ChatPreviewFramesResponse> {
  // Try mock preset first (happy-path demo)
  const preset = findPreset(request.message, MOCK_PREVIEW_CHAT_PRESETS);
  if (preset) {
    await chatDelay();
    return {
      response: preset.response,
      updated_frames: preset.updatedPreviewState,
      updated: true,
    };
  }

  // No preset matched — deviation! Lazily create real session and call backend.
  const realId = await ensureRealSession();
  if (realId) {
    try {
      return await realClient.chatPreviewFrames({
        ...request,
        session_id: realId,
      });
    } catch (err) {
      console.warn("[DEMO] Real chat/preview-frames failed, using default fallback:", err);
    }
  }

  await chatDelay();
  return {
    response: MOCK_PREVIEW_CHAT_DEFAULT_RESPONSE,
    updated_frames: null,
    updated: false,
  };
}

/**
 * Chat to refine social media strategy — tries real backend first, falls back to mock presets.
 */
export async function chatSocialStrategy(
  sessionId: string,
  message: string,
  section: string = "all",
  platform: string = "instagram",
  chatHistory: Array<{ role: "user" | "assistant"; content: string }> = []
): Promise<ChatSocialResponse> {
  // Try mock preset first (happy-path demo)
  const preset = findPreset(message, MOCK_SOCIAL_CHAT_PRESETS);
  if (preset) {
    await chatDelay();
    return {
      session_id: sessionId,
      response: preset.response,
      social_output: preset.updatedSocialOutput,
      updated: true,
      section_updated: section,
    };
  }

  // No preset matched — deviation! Lazily create real session and call backend.
  const realId = await ensureRealSession();
  if (realId) {
    try {
      return await realClient.chatSocialStrategy(realId, message, section, platform, chatHistory);
    } catch (err) {
      console.warn("[DEMO] Real social/chat failed, using default fallback:", err);
    }
  }

  await chatDelay();
  return {
    session_id: sessionId,
    response: MOCK_SOCIAL_CHAT_DEFAULT_RESPONSE,
    social_output: MOCK_SOCIAL_OUTPUT,
    updated: false,
    section_updated: null,
  };
}

// ==================== Other Pipeline Functions (Mock) ====================

export async function recommendAvatars(
  request: RecommendAvatarsRequest
): Promise<RecommendAvatarsResponse> {
  if (_usingRealPipeline && _realSessionId) {
    try {
      return await realClient.recommendAvatars(request);
    } catch (err) {
      console.warn("[DEMO] Real recommendAvatars failed, using mock:", err);
    }
  }
  await delay(6000);
  return MOCK_RECOMMENDED_AVATARS;
}

export async function getAvatars(): Promise<Avatar[]> {
  await delay(1200);
  return MOCK_AVATARS;
}

export async function getConfig(): Promise<ConfigResponse> {
  await delay(900);
  return MOCK_CONFIG;
}

export async function healthCheck(): Promise<{
  status: string;
  api_key_configured: boolean;
}> {
  return { status: "healthy", api_key_configured: true };
}

export async function generateVideoAssets(
  sessionId: string,
  languageCode: string = "en",
  stopAfter?: string,
  outputDir?: string
): Promise<VideoAssetsResponse> {
  if (_usingRealPipeline && _realSessionId) {
    try {
      const result = await realClient.generateVideoAssets(_realSessionId, languageCode, stopAfter as Parameters<typeof realClient.generateVideoAssets>[2], outputDir);
      _latestAudioLanguageCode = result.language_code || languageCode;
      return result;
    } catch (err) {
      console.warn("[DEMO] Real generateVideoAssets failed, using mock:", err);
    }
  }

  // For zh/ta, trigger real backend since we don't have mock audio clips
  if (languageCode === "zh" || languageCode === "ta") {
    const realId = await ensureRealSession();
    if (realId) {
      try {
        const result = await realClient.generateVideoAssets(realId, languageCode, stopAfter as Parameters<typeof realClient.generateVideoAssets>[2], outputDir);
        _latestAudioLanguageCode = result.language_code || languageCode;
        return result;
      } catch (err) {
        console.warn("[DEMO] Real generateVideoAssets for", languageCode, "failed, using EN mock:", err);
      }
    }
  }

  // Use BM variant for Malay, otherwise default EN
  const isBM = languageCode === "bm" || languageCode === "ms";
  const vaState = isBM ? MOCK_VISUAL_AUDIO_STATE_BM : MOCK_VISUAL_AUDIO_STATE;
  const effectiveLang = isBM ? "bm" : "en";
  _latestAudioLanguageCode = effectiveLang;

  await delay(3000);
  return {
    session_id: sessionId,
    status: "completed",
    language_code: effectiveLang,
    visual_audio_state: vaState,
    message: `Visual/audio assets generated successfully (demo mode, ${effectiveLang}).`,
  };
}

export async function getVideoAssetsStatus(
  sessionId: string
): Promise<VideoAssetsStatusResponse> {
  if (_usingRealPipeline && _realSessionId) {
    try {
      return await realClient.getVideoAssetsStatus(_realSessionId);
    } catch (err) {
      console.warn("[DEMO] Real getVideoAssetsStatus failed, using mock:", err);
    }
  }
  return {
    session_id: sessionId,
    status: "completed",
    visual_audio_state: MOCK_VISUAL_AUDIO_STATE,
  };
}

export async function generatePreviewFrames(
  request: GeneratePreviewFramesRequest
): Promise<GeneratePreviewFramesResponse> {
  if (_usingRealPipeline && _realSessionId) {
    try {
      return await realClient.generatePreviewFrames({ ...request, session_id: _realSessionId });
    } catch (err) {
      console.warn("[DEMO] Real generatePreviewFrames failed, using mock:", err);
    }
  }
  await delay(13500);
  return {
    preview_state: MOCK_PREVIEW_STATE,
    message: "Preview frames generated successfully (demo mode).",
  };
}

export async function fetchTrendingNews(
  query: string = "latest scam news Malaysia",
  num: number = 10
): Promise<SerperNewsResponse> {
  if (_usingRealPipeline) {
    try {
      return await realClient.fetchTrendingNews(query, num);
    } catch (err) {
      console.warn("[DEMO] Real fetchTrendingNews failed, using mock:", err);
    }
  }
  await delay(6000);
  return MOCK_NEWS;
}

export async function generateSocialStrategy(
  sessionId: string,
  platform: string = "instagram"
): Promise<SocialGenerateResponse> {
  if (_usingRealPipeline && _realSessionId) {
    try {
      return await realClient.generateSocialStrategy(_realSessionId, platform);
    } catch (err) {
      console.warn("[DEMO] Real generateSocialStrategy failed, using mock:", err);
    }
  }
  // Mock path
  await delay(12000);
  return {
    session_id: sessionId,
    status: "completed",
    social_output: MOCK_SOCIAL_OUTPUT,
    message: "Social media strategy generated successfully (demo mode).",
  };
}

export async function getSocialStrategy(sessionId: string): Promise<SocialGenerateResponse> {
  if (_usingRealPipeline && _realSessionId) {
    try {
      return await realClient.getSocialStrategy(_realSessionId);
    } catch (err) {
      console.warn("[DEMO] Real getSocialStrategy failed, using mock:", err);
    }
  }
  return {
    session_id: sessionId,
    status: "completed",
    social_output: MOCK_SOCIAL_OUTPUT,
    message: "Social strategy retrieved (demo mode).",
  };
}

export async function getCaptions(sessionId: string): Promise<CaptionsResponse> {
  if (_usingRealPipeline && _realSessionId) {
    try {
      return await realClient.getCaptions(_realSessionId);
    } catch (err) {
      console.warn("[DEMO] Real getCaptions failed, using mock:", err);
    }
  }
  return {
    session_id: sessionId,
    captions: MOCK_CAPTIONS,
  };
}

export async function ensureCaptions(
  request: realClient.EnsureCaptionsRequest
): Promise<CaptionsResponse> {
  if (_usingRealPipeline && _realSessionId) {
    return await realClient.ensureCaptions({ ...request, session_id: _realSessionId });
  }
  return {
    session_id: request.session_id,
    captions: MOCK_CAPTIONS,
  };
}

export async function exportStitchedVideo(
  sessionId: string,
  captionLanguages: string[] = []
): Promise<Blob> {
  if (_usingRealPipeline && _realSessionId) {
    try {
      return await realClient.exportStitchedVideo(_realSessionId, captionLanguages);
    } catch (err) {
      console.warn("[DEMO] Real exportStitchedVideo failed, using mock:", err);
    }
  }

  const hasEN = captionLanguages.includes("en");
  const hasBM = captionLanguages.includes("bm");
  const hasZH = captionLanguages.includes("zh");
  const hasTA = captionLanguages.includes("ta");
  const hasNoCaptions = captionLanguages.length === 0;
  const isBMAudio = _latestAudioLanguageCode === "bm" || _latestAudioLanguageCode === "ms";
  // EN+BM only → pre-baked bilingual video
  const isENBMOnly = hasEN && hasBM && !hasZH && !hasTA && captionLanguages.length === 2;
  // EN only → pre-baked English-subtitled video
  const isENOnly = hasEN && !hasBM && !hasZH && !hasTA;

  // Pick best pre-baked base video
  let videoPath: string;
  if (hasNoCaptions) {
    videoPath = isBMAudio ? "/demo-assets/veoplz_malay.mp4" : "/demo-assets/veoplz_eng.MP4";
  } else if (isENBMOnly) {
    videoPath = "/demo-assets/veoplz_subtitled_eng_my.mp4";
  } else if (isENOnly) {
    videoPath = "/demo-assets/veoplz_subtitled_source.mp4";
  } else {
    // Any other combination — use clean base and burn in selected captions
    videoPath = isBMAudio ? "/demo-assets/veoplz_malay.mp4" : "/demo-assets/veoplz_eng.MP4";
  }

  // Burn in captions when needed (zh, ta, or any non-pre-baked combo)
  const needsBurnIn = hasZH || hasTA || (!hasNoCaptions && !isENOnly && !isENBMOnly);
  if (needsBurnIn) {
    try {
      const srt = buildSrtFromMockCaptions(captionLanguages);
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      const burnBase = hasNoCaptions || (!isENOnly && !isENBMOnly)
        ? (isBMAudio ? "/demo-assets/veoplz_malay.mp4" : "/demo-assets/veoplz_eng.MP4")
        : videoPath;
      const res = await fetch(`${apiBase}/export/burn-subtitles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_url: burnBase, srt_content: srt }),
      });
      if (res.ok) return await res.blob();
      console.warn("[DEMO] burn-subtitles failed, falling back to base video:", res.status);
    } catch (err) {
      console.warn("[DEMO] burn-subtitles unavailable, falling back:", err);
    }
  }

  // Return chosen base video
  try {
    const resp = await fetch(videoPath);
    if (resp.ok) return await resp.blob();
  } catch { /* fall through */ }
  try {
    const resp = await fetch("/demo-assets/veo_clips/segment_1.mp4");
    if (resp.ok) return await resp.blob();
  } catch { /* fall through */ }
  return new Blob([], { type: "video/mp4" });
}

/** Generate SRT subtitle content from MOCK_CAPTIONS for the given languages. */
function buildSrtFromMockCaptions(languages: string[]): string {
  const requestedLanguages =
    languages.length > 0 ? languages : Object.keys(MOCK_CAPTIONS);
  const segmentCount = requestedLanguages.reduce((maxCount, lang) => {
    const maxSegmentForLang = (MOCK_CAPTIONS[lang] ?? []).reduce(
      (maxSegment, entry) => Math.max(maxSegment, entry.segment_id),
      0
    );
    return Math.max(maxCount, maxSegmentForLang);
  }, 0);
  const durationPerSegment = 8; // seconds
  const lines: string[] = [];
  let idx = 1;

  for (let i = 0; i < segmentCount; i++) {
    const parts: string[] = [];
    for (const lang of languages) {
      const entries = MOCK_CAPTIONS[lang];
      if (!entries) continue;
      const entry = entries.find((e) => e.segment_id === i + 1);
      if (entry?.text) {
        // Extract quoted dialogue only (like the backend does)
        const quoted = entry.text.match(/"([^"]+)"|'([^']+)'/g);
        if (quoted) {
          parts.push(...quoted.map((q) => q.replace(/^["']|["']$/g, "")));
        } else if (entry.text.trim()) {
          parts.push(entry.text.trim());
        }
      }
    }
    if (parts.length === 0) continue;

    const startSec = i * durationPerSegment;
    const endSec = startSec + durationPerSegment;
    const startTs = formatSrtTime(startSec);
    const endTs = formatSrtTime(endSec);
    lines.push(`${idx}`);
    lines.push(`${startTs} --> ${endTs}`);
    lines.push(parts.join("\n"));
    lines.push("");
    idx++;
  }
  return lines.join("\n");
}

function formatSrtTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},000`;
}

// ==================== YouTube Direct Publish ====================

export async function publishToYouTube(
  request: YouTubePublishRequest
): Promise<YouTubePublishResponse> {
  // Always route to real backend — this is the whole point (end-to-end demo)
  return realClient.publishToYouTube(request);
}

// ==================== Instagram Reels Direct Publish ====================

export async function publishToInstagram(
  request: InstagramPublishRequest
): Promise<InstagramPublishResponse> {
  // Always route to real backend — end-to-end demo
  return realClient.publishToInstagram(request);
}
