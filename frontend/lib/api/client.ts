/**
 * API Client for Scam Shield Backend
 * Maps backend snake_case responses to frontend camelCase models
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ==================== Types ====================

export interface BackendFactSheet {
  scam_name: string;
  story_hook: string;
  red_flag: string;
  the_fix: string;
  reference_sources: string[];
  category: string;
  verified_by_officer: boolean;
  verification_timestamp: string | null;
  officer_notes: string | null;
  // Deep Research insights (null when Deep Research is off)
  global_ancestry: string | null;
  psychological_exploit: string | null;
  victim_profile: string | null;
  counter_hack: string | null;
}

export interface IntakeResponse {
  session_id: string;
  fact_sheet: BackendFactSheet;
  message: string;
}

export interface VerifyResponse {
  session_id: string;
  fact_sheet: BackendFactSheet;
  verified: boolean;
  message: string;
}

export interface SensitivityFlag {
  severity: "warning" | "critical";
  issue_type: string;
  description: string;
  scene_id?: number;
  suggested_fix?: string;
  regulation_reference?: string;
}

export interface ComplianceAnalysis {
  category: string;
  status: "passed" | "warning" | "flagged";
  analysis: string;
  elements_reviewed: string[];
}

export interface SensitivityReport {
  project_id: string;
  passed: boolean;
  flags: SensitivityFlag[];
  compliance_summary: string;
  detailed_analysis: ComplianceAnalysis[];
  checked_against: string[];
}

export interface SceneCharacterAssignment {
  scene_id: number;
  character_ids: string[];
  character_images: string[];
  generated_at: string;
}

export interface CharacterRecommendation {
  scene_id: number;
  character_ids: string[];
  generated_at: string;
}

export interface GenerateResponse {
  session_id: string;
  status: string;
  video_package: {
    video_inputs?: Record<string, {
      project_id: string;
      total_duration_seconds?: number;
      scenes: Array<{
        scene_id: number;
        visual_prompt: string;
        audio_script: string;
        text_overlay?: string;
        duration_est_seconds?: number;
      }>;
    }>;
    sensitivity_report?: SensitivityReport;
  } | null;
  message: string;
  recommended_characters?: string[];
  character_descriptions?: Array<{
    role: string;
    type: "person" | "scammer";
    description: string;
    image_url: string | null;
    image_base64: string | null;
  }>;
}

export interface ChatResponse {
  session_id: string;
  response: string;
  fact_sheet?: BackendFactSheet;
  director_output?: {
    project_id: string;
    master_script: string;
    scene_breakdown: Array<{
      scene_id?: number;
      visual_prompt?: string;
      audio_script?: string;
      text_overlay?: string;
      duration_est_seconds?: number;
      purpose?: string;
      transition?: string;
      background_music_mood?: string;
    }>;
    creative_notes?: string;
  };
  video_package?: unknown;
  updated: boolean;
  changes_applied?: Record<string, unknown>;
}

export interface Avatar {
  id: string;
  name: string;
  description: string;
  gender: string;
  ethnicity: string;
  age_range: string;
  style: string;
  preview_url?: string;
}

export interface ConfigResponse {
  formats: Record<string, { max_duration: number; aspect_ratio: string }>;
  max_scene_duration: number;
  supported_languages: Array<{ code: string; name: string }>;
  supported_tones: string[];
  supported_audiences: string[];
}

// ==================== Visual/Audio Types ====================

export type VideoAssetsStage = "story" | "script" | "characters" | "char_refs" | "clip_refs";

export interface ScriptSegment {
  segment_id: number;
  characters_involved: string[];
  setting: string;
  veo_prompt: string;
}

export interface VeoScript {
  title: string;
  segments: ScriptSegment[];
}

export interface CharacterDescription {
  character_name: string;
  visual_description: string;
  outfit_and_accessories: string;
  facial_expression_default: string;
  posture_and_mannerisms: string;
  ethnicity_and_age: string;
}

export interface CharacterRefImage {
  character_name: string;
  image_path: string;
  image_base64?: string;
}

export interface ClipRefEntry {
  segment_id: number;
  start_frame_path: string;
  end_frame_path: string;
  start_frame_base64?: string;
  end_frame_base64?: string;
}

export interface VeoClipEntry {
  segment_id: number;
  video_path: string;
  video_uri?: string;
}

export interface VisualAudioState {
  obfuscated_story: {
    title: string;
    full_narrative: string;
    character_roles: Record<string, string>;
    scenes: Array<{
      scene_id: number;
      description: string;
      dialogue: string;
      visual_style: string;
    }>;
  } | null;
  veo_script: VeoScript | null;
  character_descriptions: {
    characters: CharacterDescription[];
  } | null;
  character_ref_images: CharacterRefImage[];
  clip_ref_prompts: Array<Record<string, unknown>>;
  clip_ref_images: ClipRefEntry[];
  veo_clips: VeoClipEntry[];
  output_dir: string | null;
}

export interface VideoAssetsResponse {
  session_id: string;
  status: string;
  language_code: string;
  visual_audio_state: VisualAudioState | null;
  message: string;
}

// ==================== Enhanced Workflow Types ====================

export interface RecommendAvatarsRequest {
  session_id: string;
  target_audience?: string;
  language?: string;
  tone?: string;
}

export interface RecommendAvatarsResponse {
  recommended_avatars: string[];
  message: string;
}

export interface PreviewFrame {
  scene_id: number;
  frame_type: "start" | "end";
  image_url?: string | null;
  image_data?: string | null;
  visual_prompt: string;
  generated_at: string;
  refined_at?: string | null;
}

export interface RefinementEntry {
  timestamp: string;
  user_message: string;
  ai_response: string;
  updated_prompts: Record<number, string>;
  regenerated_frames: number[];
}

export interface PreviewState {
  session_id: string;
  frames: PreviewFrame[];
  generation_status: "pending" | "generating" | "completed" | "error";
  generated_at?: string | null;
  refinement_history: RefinementEntry[];
}

export interface GeneratePreviewFramesRequest {
  session_id: string;
  language_code: string;
}

export interface GeneratePreviewFramesResponse {
  preview_state: PreviewState;
  message: string;
}

export interface ChatPreviewFramesRequest {
  session_id: string;
  message: string;
  chat_history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

export interface ChatPreviewFramesResponse {
  response: string;
  updated_frames?: PreviewState | null;
  updated: boolean;
}

// ==================== Character Chat Types ====================

export interface ChatCharacterRequest {
  session_id: string;
  message: string;
  chat_history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

export interface ChatCharacterResponse {
  session_id: string;
  response: string;
  updated_characters: Array<{
    role: string;
    type: "person" | "scammer";
    description: string;
    image_url: string | null;
    image_base64: string | null;
  }> | null;
  updated: boolean;
}

// ==================== Enhanced Workflow API Functions ====================

export async function generatePreviewFrames(
  request: GeneratePreviewFramesRequest
): Promise<GeneratePreviewFramesResponse> {
  return fetchApi<GeneratePreviewFramesResponse>("/preview-frames", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function chatPreviewFrames(
  request: ChatPreviewFramesRequest
): Promise<ChatPreviewFramesResponse> {
  return fetchApi<ChatPreviewFramesResponse>("/chat/preview-frames", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function chatCharacterRefinement(
  request: ChatCharacterRequest
): Promise<ChatCharacterResponse> {
  return fetchApi<ChatCharacterResponse>("/chat/characters", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export interface VideoAssetsStatusResponse {
  session_id: string;
  status: string;
  visual_audio_state: VisualAudioState | null;
}

// ==================== Frontend Fact Check Interface ====================

// Frontend uses same structure as backend, but adds granular verification fields
export interface FrontendFactCheck {
  scam_name: string;
  story_hook: string;
  red_flag: string;
  the_fix: string;
  reference_sources: string[];
  category: string;
  verified_by_officer: boolean;
  verification_timestamp: string | null;
  officer_notes: string | null;
  // Deep Research insights
  global_ancestry: string | null;
  psychological_exploit: string | null;
  victim_profile: string | null;
  counter_hack: string | null;
  // Granular verification fields for UI (derived from verified_by_officer)
  scam_name_verified: boolean;
  story_hook_verified: boolean;
  red_flag_verified: boolean;
  the_fix_verified: boolean;
  reference_sources_verified: boolean;
}

// Helper to create FrontendFactCheck from BackendFactSheet
function createFrontendFactCheck(backend: BackendFactSheet): FrontendFactCheck {
  const allVerified = backend.verified_by_officer;
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

// ==================== API Functions ====================

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      errorData.detail || `API error: ${response.status}`
    );
  }

  return response.json();
}

/**
 * Submit scam intake and get fact sheet
 */
export async function submitIntake(
  content: string,
  sourceType: "manual_description" | "news_url" | "police_report" = "manual_description",
  additionalContext?: string,
  useDeepResearch?: boolean
): Promise<{ session_id: string; fact_check: FrontendFactCheck }> {
  const response = await fetchApi<IntakeResponse>("/intake", {
    method: "POST",
    body: JSON.stringify({
      source_type: sourceType,
      content,
      additional_context: additionalContext,
      use_deep_research: useDeepResearch,
    }),
  });

  return {
    session_id: response.session_id,
    fact_check: createFrontendFactCheck(response.fact_sheet),
  };
}

/**
 * Submit scam intake with SSE streaming for Deep Research thought process.
 * Yields thought updates and resolves with the final fact sheet.
 */
export async function submitIntakeStream(
  content: string,
  sourceType: "manual_description" | "news_url" | "police_report" = "manual_description",
  onThought: (thought: string) => void,
  additionalContext?: string,
  useDeepResearch: boolean = true,
): Promise<{ session_id: string; fact_check: FrontendFactCheck }> {
  const url = `${API_BASE}/intake/stream`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source_type: sourceType,
      content,
      additional_context: additionalContext,
      use_deep_research: useDeepResearch,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      errorData.detail || `API error: ${response.status}`
    );
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body for SSE stream");

  const decoder = new TextDecoder();
  let buffer = "";
  let result: { session_id: string; fact_check: FrontendFactCheck } | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Parse SSE events from buffer
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // Keep incomplete line in buffer

    let currentEvent = "";
    let currentData = "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        currentData = line.slice(6);
      } else if (line === "" && currentEvent && currentData) {
        // End of SSE message
        try {
          const parsed = JSON.parse(currentData);
          if (currentEvent === "thought") {
            onThought(parsed.thought);
          } else if (currentEvent === "result") {
            result = {
              session_id: parsed.session_id,
              fact_check: createFrontendFactCheck(parsed.fact_sheet),
            };
          } else if (currentEvent === "error") {
            throw new Error(parsed.error || "Deep Research failed");
          }
        } catch (e) {
          if (e instanceof Error && e.message !== "Deep Research failed") {
            console.warn("SSE parse error:", e);
          } else {
            throw e;
          }
        }
        currentEvent = "";
        currentData = "";
      }
    }
  }

  if (!result) {
    throw new Error("Stream ended without result");
  }

  return result;
}

/**
 * Verify fact sheet
 */
export async function verifyFactSheet(
  session_id: string,
  officer_id: string,
  corrections?: Partial<BackendFactSheet>,
  notes?: string
): Promise<{ fact_check: FrontendFactCheck; verified: boolean }> {
  const response = await fetchApi<VerifyResponse>("/verify", {
    method: "POST",
    body: JSON.stringify({
      session_id,
      officer_id,
      notes,
      corrections,
    }),
  });

  return {
    fact_check: createFrontendFactCheck(response.fact_sheet),
    verified: response.verified,
  };
}

/**
 * Generate video package
 */
export async function generateVideoPackage(
  sessionId: string,
  config: {
    targetGroups: string[];
    languages: string[];
    tone: string;
    avatarId: string;
    videoFormat: string;
    directorInstructions?: string;
  }
): Promise<GenerateResponse> {
  return fetchApi<GenerateResponse>("/generate", {
    method: "POST",
    body: JSON.stringify({
      session_id: sessionId,
      target_groups: config.targetGroups,
      languages: config.languages,
      tone: config.tone,
      avatar_id: config.avatarId,
      video_format: config.videoFormat,
      director_instructions: config.directorInstructions,
    }),
  });
}

/**
 * Chat about fact sheet
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
  const result = await fetchApi<ChatResponse>("/chat/factsheet", {
    method: "POST",
    body: JSON.stringify({
      session_id,
      message,
      chat_history,
    }),
  });

  return {
    response: result.response,
    fact_check: result.fact_sheet
      ? createFrontendFactCheck(result.fact_sheet)
      : undefined,
    updated: result.updated,
  };
}

/**
 * Chat about video package
 */
export async function chatVideoPackage(
  sessionId: string,
  message: string,
  chatHistory: Array<{ role: "user" | "assistant"; content: string }> = []
): Promise<ChatResponse> {
  return fetchApi<ChatResponse>("/chat/video-package", {
    method: "POST",
    body: JSON.stringify({
      session_id: sessionId,
      message,
      chat_history: chatHistory,
    }),
  });
}

/**
 * Recommend avatars based on fact sheet
 */
export async function recommendAvatars(
  request: RecommendAvatarsRequest
): Promise<RecommendAvatarsResponse> {
  const response = await fetch(`${API_BASE}/recommend-avatars`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to generate avatar recommendations" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Get available avatars
 */
export async function getAvatars(): Promise<Avatar[]> {
  const response = await fetchApi<{ avatars: Avatar[] }>("/avatars");
  return response.avatars;
}

/**
 * Get video format config
 */
export async function getConfig(): Promise<ConfigResponse> {
  return fetchApi<ConfigResponse>("/config");
}

/**
 * Health check
 */
export async function healthCheck(): Promise<{
  status: string;
  api_key_configured: boolean;
}> {
  // Health endpoint is at root, not under /api/v1
  const response = await fetch(
    `${API_BASE.replace("/api/v1", "")}/health`
  );
  return response.json();
}

/**
 * Generate visual/audio assets (character refs, clip refs, Veo clips)
 * Runs the 6-stage Visual/Audio Agent pipeline against an existing video package.
 */
export async function generateVideoAssets(
  sessionId: string,
  languageCode: string = "en",
  stopAfter?: VideoAssetsStage,
  outputDir?: string
): Promise<VideoAssetsResponse> {
  return fetchApi<VideoAssetsResponse>("/video-assets", {
    method: "POST",
    body: JSON.stringify({
      session_id: sessionId,
      language_code: languageCode,
      stop_after: stopAfter ?? null,
      output_dir: outputDir ?? null,
    }),
  });
}

/**
 * Get current visual/audio pipeline state for a session
 */
export async function getVideoAssetsStatus(
  sessionId: string
): Promise<VideoAssetsStatusResponse> {
  return fetchApi<VideoAssetsStatusResponse>(`/video-assets/${sessionId}`);
}

// ==================== Trending News (Serper) ====================

export interface SerperNewsItem {
  id: string;
  headline: string;
  source: string;
  date: string;
  category: string;
  summary: string;
  url: string;
  image_url: string | null;
}

export interface SerperNewsResponse {
  articles: SerperNewsItem[];
  query: string;
  count: number;
}

/**
 * Fetch trending scam news from the backend (powered by Serper API).
 */
export async function fetchTrendingNews(
  query: string = "latest scam news Malaysia",
  num: number = 10
): Promise<SerperNewsResponse> {
  const params = new URLSearchParams({ query, num: String(num) });
  return fetchApi<SerperNewsResponse>(`/news?${params.toString()}`);
}

// ==================== Social Officer Agent Types ====================

export interface SocialTrendAnalysis {
  trending_topics: string[];
  recommended_posting_time: string;
  content_angle: string;
  viral_potential: string;
  trend_hooks: string[];
  competitor_insights: string;
}

export interface SocialCaptionOption {
  caption: string;
  style: string;
  estimated_engagement: string;
  call_to_action: string;
}

export interface SocialThumbnailRecommendation {
  recommended_scene_id: number;
  thumbnail_prompt: string;
  text_overlay: string;
  rationale: string;
  style_notes: string;
}

export interface SocialHashtagStrategy {
  primary_hashtags: string[];
  trending_hashtags: string[];
  niche_hashtags: string[];
  branded_hashtags: string[];
  total_count: number;
  hashtag_string: string;
}

export interface SocialOutput {
  project_id: string;
  platform: string;
  trend_analysis: SocialTrendAnalysis;
  captions: SocialCaptionOption[];
  selected_caption_index: number;
  thumbnail: SocialThumbnailRecommendation;
  hashtags: SocialHashtagStrategy;
  posting_notes: string;
  generated_at: string;
}

export interface SocialGenerateResponse {
  session_id: string;
  status: string;
  social_output: SocialOutput | null;
  message: string;
}

export interface ChatSocialResponse {
  session_id: string;
  response: string;
  social_output: SocialOutput | null;
  updated: boolean;
  section_updated: string | null;
}

// ==================== Social Officer Agent API Functions ====================

/**
 * Generate social media strategy (captions, hashtags, thumbnail, trends)
 */
export async function generateSocialStrategy(
  sessionId: string,
  platform: string = "instagram"
): Promise<SocialGenerateResponse> {
  return fetchApi<SocialGenerateResponse>("/social/generate", {
    method: "POST",
    body: JSON.stringify({
      session_id: sessionId,
      platform,
    }),
  });
}

/**
 * Chat to refine social media strategy
 */
export async function chatSocialStrategy(
  sessionId: string,
  message: string,
  section: string = "all",
  platform: string = "instagram",
  chatHistory: Array<{ role: "user" | "assistant"; content: string }> = []
): Promise<ChatSocialResponse> {
  return fetchApi<ChatSocialResponse>("/social/chat", {
    method: "POST",
    body: JSON.stringify({
      session_id: sessionId,
      message,
      section,
      platform,
      chat_history: chatHistory,
    }),
  });
}

/**
 * Get current social strategy for a session
 */
export async function getSocialStrategy(
  sessionId: string
): Promise<SocialGenerateResponse> {
  return fetchApi<SocialGenerateResponse>(`/social/${sessionId}`);
}
