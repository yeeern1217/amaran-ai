/**
 * API Barrel Export — Switches between real and mock API clients.
 *
 * Set NEXT_PUBLIC_DEMO_MODE=true in .env.local to enable demo/pitch mode.
 * All imports should use "@/lib/api" instead of "@/lib/api/client".
 *
 * In demo mode:
 * - Pipeline functions (intake, generate, video-assets) → mock (instant, deterministic)
 * - Chat functions → mock-client tries real backend first, falls back to presets
 * - Project CRUD (list, save, get, delete) → ALWAYS real client (Firestore)
 */

// Re-export all types (always from the real client — types are identical)
export type {
  BackendFactSheet,
  IntakeResponse,
  VerifyResponse,
  GenerateResponse,
  ChatResponse,
  SensitivityFlag,
  ComplianceAnalysis,
  SensitivityReport,
  SceneCharacterAssignment,
  CharacterRecommendation,
  Avatar,
  ConfigResponse,
  VideoAssetsStage,
  ScriptSegment,
  VeoScript,
  CharacterDescription,
  CharacterRefImage,
  ClipRefEntry,
  VeoClipEntry,
  VisualAudioState,
  VideoAssetsResponse,
  CaptionEntry,
  CaptionsResponse,
  EnsureCaptionsRequest,
  RecommendAvatarsRequest,
  RecommendAvatarsResponse,
  PreviewFrame,
  RefinementEntry,
  PreviewState,
  GeneratePreviewFramesRequest,
  GeneratePreviewFramesResponse,
  ChatPreviewFramesRequest,
  ChatPreviewFramesResponse,
  ChatCharacterRequest,
  ChatCharacterResponse,
  VideoAssetsStatusResponse,
  FrontendFactCheck,
  SerperNewsItem,
  SerperNewsResponse,
  SocialTrendAnalysis,
  SocialCaptionOption,
  SocialThumbnailRecommendation,
  SocialHashtagStrategy,
  SocialOutput,
  SocialGenerateResponse,
  ChatSocialResponse,
  YouTubePublishRequest,
  YouTubePublishResponse,
  InstagramPublishRequest,
  InstagramPublishResponse,
  FirestoreProject,
  ProjectsListResponse,
} from "./client";

const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

import * as realClient from "./client";
import * as mockClient from "./mock-client";

function pick<T>(real: T, mock: T): T {
  return IS_DEMO ? mock : real;
}

// ==================== Pipeline Functions (toggled) ====================

export const submitIntake = pick(realClient.submitIntake, mockClient.submitIntake);
export const submitIntakeStream = pick(realClient.submitIntakeStream, mockClient.submitIntakeStream);
export const verifyFactSheet = pick(realClient.verifyFactSheet, mockClient.verifyFactSheet);
export const generateVideoPackage = pick(realClient.generateVideoPackage, mockClient.generateVideoPackage);
export const recommendAvatars = pick(realClient.recommendAvatars, mockClient.recommendAvatars);
export const getAvatars = pick(realClient.getAvatars, mockClient.getAvatars);
export const getConfig = pick(realClient.getConfig, mockClient.getConfig);
export const healthCheck = pick(realClient.healthCheck, mockClient.healthCheck);
export const generateVideoAssets = pick(realClient.generateVideoAssets, mockClient.generateVideoAssets);
export const getVideoAssetsStatus = pick(realClient.getVideoAssetsStatus, mockClient.getVideoAssetsStatus);
export const generatePreviewFrames = pick(realClient.generatePreviewFrames, mockClient.generatePreviewFrames);
export const fetchTrendingNews = pick(realClient.fetchTrendingNews, mockClient.fetchTrendingNews);
export const generateSocialStrategy = pick(realClient.generateSocialStrategy, mockClient.generateSocialStrategy);
export const getSocialStrategy = pick(realClient.getSocialStrategy, mockClient.getSocialStrategy);
export const getCaptions = pick(realClient.getCaptions, mockClient.getCaptions);
export const ensureCaptions = pick(realClient.ensureCaptions, mockClient.ensureCaptions);
export const exportStitchedVideo = pick(realClient.exportStitchedVideo, mockClient.exportStitchedVideo);
export const publishToYouTube = pick(realClient.publishToYouTube, mockClient.publishToYouTube);
export const publishToInstagram = pick(realClient.publishToInstagram, mockClient.publishToInstagram);

// ==================== Chat Functions (toggled — mock tries real backend first) ====================

export const chatFactSheet = pick(realClient.chatFactSheet, mockClient.chatFactSheet);
export const chatVideoPackage = pick(realClient.chatVideoPackage, mockClient.chatVideoPackage);
export const chatCharacterRefinement = pick(realClient.chatCharacterRefinement, mockClient.chatCharacterRefinement);
export const chatPreviewFrames = pick(realClient.chatPreviewFrames, mockClient.chatPreviewFrames);
export const chatSocialStrategy = pick(realClient.chatSocialStrategy, mockClient.chatSocialStrategy);

// ==================== Project CRUD (ALWAYS real — Firestore) ====================

export const listProjects = realClient.listProjects;
export const saveProject = realClient.saveProject;
export const getProject = realClient.getProject;
export const deleteProject = realClient.deleteProject;
