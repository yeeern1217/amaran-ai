/**
 * Mock Data for Demo/Pitch Mode
 *
 * Hardcoded responses based on the Pos Laju Verification Scam notebook flow.
 * Provides instant, deterministic responses for all pipeline stages.
 *
 * Chat editing still works in demo mode via keyword-matched presets
 * that return updated state — these updates persist when saved as Past Projects.
 */

import type {
  BackendFactSheet,
  FrontendFactCheck,
  IntakeResponse,
  GenerateResponse,
  Avatar,
  ConfigResponse,
  VisualAudioState,
  PreviewState,
  PreviewFrame,
  SerperNewsResponse,
  SocialOutput,
  RecommendAvatarsResponse,
} from "./client";

// ==================== Session ====================

export const MOCK_SESSION_ID = "demo-pos-laju-scam-001";

// ==================== Trending News ====================

export const MOCK_NEWS: SerperNewsResponse = {
  articles: [
    {
      id: "news-1",
      headline: "RM4.2 Million Lost to Fake Pos Laju Delivery Scam Syndicates in Johor",
      source: "The Star",
      date: "2026-02-15",
      category: "Parcel/Delivery Scam",
      summary: "A total of RM4.2 million was lost to fake delivery scam syndicates in Johor during the first two weeks of February. Victims were tricked by callers impersonating Pos Laju representatives who claimed parcels contained illegal items.",
      url: "https://www.thestar.com.my/news/nation/2026/02/15/rm42-million-lost-to-fake-delivery-scam",
      image_url: "https://images.unsplash.com/photo-1586769852044-692d6e3703f0?w=400&h=200&fit=crop",
    },
    {
      id: "news-2",
      headline: "Macau Scam Targets Elderly Victims in Selangor with AI Voice Cloning",
      source: "New Straits Times",
      date: "2026-02-12",
      category: "Digital Arrest",
      summary: "A new variant of the Macau scam uses AI voice-cloning technology to impersonate family members. At least 15 cases reported in the past week.",
      url: "https://www.nst.com.my/news/crime-courts/2026/02/macau-scam-ai-voice",
      image_url: "https://images.unsplash.com/photo-1633265486064-086b219458ec?w=400&h=200&fit=crop",
    },
    {
      id: "news-3",
      headline: "PDRM Warns of Rising WhatsApp Investment Scam Targeting Young Adults",
      source: "Malaysiakini",
      date: "2026-02-10",
      category: "Investment Scam",
      summary: "Police have identified a new wave of investment scams conducted via WhatsApp groups promising guaranteed returns of 300% within 30 days.",
      url: "https://www.malaysiakini.com/news/658200",
      image_url: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=200&fit=crop",
    },
    {
      id: "news-4",
      headline: "Job Scam on TikTok Lures Students with Fake Part-Time Offers",
      source: "Berita Harian",
      date: "2026-02-08",
      category: "Job Scam",
      summary: "Students across Malaysia are falling victim to job scams advertised on TikTok, requiring upfront 'registration fees' for non-existent positions.",
      url: "https://www.bharian.com.my/berita/jenayah/2026/02/job-scam-tiktok",
      image_url: "https://images.unsplash.com/photo-1676299081847-824916de030a?w=400&h=200&fit=crop",
    },
    {
      id: "news-5",
      headline: "Love Scam Victim in Penang Loses Life Savings of RM1.5 Million",
      source: "Malay Mail",
      date: "2026-02-05",
      category: "Love Scam",
      summary: "A 55-year-old professional in Penang lost RM1.5 million to a love scam conducted over 6 months through social media and messaging apps.",
      url: "https://www.malaymail.com/news/malaysia/2026/02/05/love-scam-penang",
      image_url: "https://images.unsplash.com/photo-1516542076529-1ea3854896f2?w=400&h=200&fit=crop",
    },
  ],
  query: "latest scam news Malaysia",
  count: 5,
};

// ==================== Fact Sheet ====================

export const MOCK_FACT_SHEET: BackendFactSheet = {
  scam_name: "Pos Laju Verification Scam",
  story_hook:
    "Scammers call victims impersonating Pos Laju representatives, claiming a parcel addressed to them has been flagged by customs for containing illegal items such as drugs or counterfeit goods. The call is then 'transferred' to a fake police officer or Bank Negara Malaysia representative who instructs the victim to transfer funds to a 'verification account' to clear their name.",
  red_flag:
    "Unsolicited call claiming a parcel contains illegal items; being 'transferred' to police or Bank Negara; pressure to keep the matter confidential; request to transfer money to a 'verification account'.",
  the_fix:
    "Hang up immediately. Never transfer money based on phone instructions. Verify claims through official Pos Laju, police (997), or Bank Negara hotlines. Tell a trusted family member or friend.",
  reference_sources: [
    "https://www.rmp.gov.my/",
    "https://www.bnm.gov.my/",
    "https://www.mcmc.gov.my/",
    "https://sfrauddirector.mcmc.gov.my/",
    "https://www.nst.com.my/news/crime-courts",
    "https://www.thestar.com.my/news/nation",
    "https://www.bharian.com.my/berita/jenayah",
    "https://www.bernama.com/en/general/news.php",
    "https://www.freemalaysiatoday.com/category/nation",
    "https://www.interpol.int/en/Crimes/Financial-crime",
    "https://www.unodc.org/roseap/en/what-we-do/anti-corruption/index.html",
    "https://www.mas.gov.sg/regulation/anti-money-laundering",
    "https://www.police.gov.hk/ppp_en/04_crime_matters/cpa.html",
    "https://doi.org/10.1016/j.chb.2021.106847",
    "https://doi.org/10.1093/bjc/azw031",
    "https://www.sc.com.my/regulation/enforcement/investor-alerts",
    "https://ccid.rmp.gov.my/semakmule/",
  ],
  category: "Parcel/Delivery Scam",
  verified_by_officer: false,
  verification_timestamp: null,
  officer_notes: null,
  global_ancestry: null,
  psychological_exploit: null,
  victim_profile: null,
  counter_hack: null,
};

export const MOCK_INTAKE_RESPONSE: IntakeResponse = {
  session_id: MOCK_SESSION_ID,
  fact_sheet: MOCK_FACT_SHEET,
  message: "Fact sheet generated. Please verify before proceeding.",
};

// ==================== Avatars ====================

export const MOCK_AVATARS: Avatar[] = [
  {
    id: "officer_malay_male_01",
    name: "ASP Ahmad",
    description: "Malay male police officer, authoritative and trustworthy",
    gender: "male",
    ethnicity: "Malay",
    age_range: "35-45",
    style: "Authoritative",
  },
  {
    id: "officer_malay_female_01",
    name: "Insp. Nurul",
    description: "Malay female police officer, warm and approachable",
    gender: "female",
    ethnicity: "Malay",
    age_range: "30-40",
    style: "Approachable",
  },
  {
    id: "officer_chinese_male_01",
    name: "DSP Lim",
    description: "Chinese male police officer, professional and calm",
    gender: "male",
    ethnicity: "Chinese",
    age_range: "40-50",
    style: "Professional",
  },
  {
    id: "officer_chinese_female_01",
    name: "ASP Tan",
    description: "Chinese female police officer, energetic and relatable",
    gender: "female",
    ethnicity: "Chinese",
    age_range: "28-38",
    style: "Energetic",
  },
  {
    id: "officer_indian_male_01",
    name: "Insp. Kumar",
    description: "Indian male police officer, knowledgeable and steady",
    gender: "male",
    ethnicity: "Indian",
    age_range: "35-45",
    style: "Steady",
  },
  {
    id: "officer_indian_female_01",
    name: "ASP Priya",
    description: "Indian female police officer, compassionate and firm",
    gender: "female",
    ethnicity: "Indian",
    age_range: "30-40",
    style: "Compassionate",
  },
];

// ==================== Config ====================

export const MOCK_CONFIG: ConfigResponse = {
  formats: {
    reel: { max_duration: 90, aspect_ratio: "9:16" },
    story: { max_duration: 60, aspect_ratio: "9:16" },
    post: { max_duration: 60, aspect_ratio: "1:1" },
    landscape: { max_duration: 180, aspect_ratio: "16:9" },
  },
  max_scene_duration: 15,
  supported_languages: [
    { code: "en", name: "English" },
    { code: "bm", name: "Bahasa Melayu" },
    { code: "zh", name: "Chinese (Mandarin)" },
    { code: "ta", name: "Tamil" },
  ],
  supported_tones: ["Urgent/Warning", "Calm", "Friendly", "Authoritative", "High Energy"],
  supported_audiences: ["Elderly", "Students", "Professionals", "Online Shoppers", "General Public"],
};

// ==================== Recommended Avatars ====================

export const MOCK_RECOMMENDED_AVATARS: RecommendAvatarsResponse = {
  recommended_avatars: [
    "officer_malay_male_01",
    "officer_malay_female_01",
    "officer_chinese_male_01",
    "officer_indian_male_01",
  ],
  message: "Recommended based on Parcel/Delivery Scam targeting elderly demographics in Johor.",
};

// ==================== Video Package (Director Output → Scenes) ====================

export const MOCK_SCENES = [
  {
    scene_id: 1,
    visual_prompt:
      "The Retiree (Victim) sits in a sunlit living room, watching television. The smartphone rings and he answers. Medium shot, eye level. Bright and calm morning mood. Cinematic style.",
    audio_script:
      'Retiree answers the phone: "Hello?"',
    text_overlay: "",
    duration_est_seconds: 8,
  },
  {
    scene_id: 2,
    visual_prompt:
      "The Retiree answers the phone with a curious expression. Cut to the Fake Pos Laju representative wearing a professional headset in a generic office setting. Documentary style.",
    audio_script:
      'Fake Pos Laju representative: "This is Pos Laju. Your parcel was flagged by customs." Retiree: "What?"',
    text_overlay: "",
    duration_est_seconds: 8,
  },
  {
    scene_id: 3,
    visual_prompt:
      "The Fake Pos Laju representative speaks urgently while looking at a computer screen. Scene cuts to a package being detained with drugs being pulled out. Tense drama style.",
    audio_script:
      'Fake Pos Laju representative: "The package contains illegal drugs. You are under investigation."',
    text_overlay: "",
    duration_est_seconds: 8,
  },
  {
    scene_id: 4,
    visual_prompt:
      "The Fake senior police officer speaks authoritatively while the Retiree listens on the other end, panicked. Medium shot. Cold, authoritative lighting. Tense thriller style.",
    audio_script:
      'Fake senior police officer: "I am a senior officer. Your identity is linked to a criminal investigation." Retiree: "No!"',
    text_overlay: "",
    duration_est_seconds: 8,
  },
  {
    scene_id: 5,
    visual_prompt:
      "The Fake senior police officer leans close to the monitor, looking stern. Camera slowly moves to a close-up. High contrast lighting. Suspenseful style.",
    audio_script:
      'Fake senior police officer: "This is confidential. Do not tell your family or anyone."',
    text_overlay: "",
    duration_est_seconds: 8,
  },
  {
    scene_id: 6,
    visual_prompt:
      "The Retiree standing afraid, wiping his sweat and holding his phone. Cut to the Fake senior police officer in a dimly lit police room. Intimate drama style.",
    audio_script:
      'Fake senior police officer: "To verify your innocence, your funds must be transferred to a special verification account monitored by Bank Negara Malaysia."',
    text_overlay: "",
    duration_est_seconds: 8,
  },
  {
    scene_id: 7,
    visual_prompt:
      "The male Fake Bank Negara Malaysia representative depicted as a featureless humanoid silhouette. Intimate drama style.",
    audio_script:
      'Fake Bank Negara Malaysia representative: "This is Bank Negara. Transfer 20,000 to our verification account to prove innocence."',
    text_overlay: "",
    duration_est_seconds: 8,
  },
  {
    scene_id: 8,
    visual_prompt:
      "The Retiree sits in his home office at a laptop with trembling hands, performing an online bank transfer. Close-up on the computer screen shows the transaction. Dim, somber lighting. Dramatic style.",
    audio_script: "",
    text_overlay: "",
    duration_est_seconds: 8,
  },
  {
    scene_id: 9,
    visual_prompt:
      "A calendar in the living room, the page gets blown to the next page smoothly by the wind revealing '3 weeks later'.",
    audio_script: "",
    text_overlay: "",
    duration_est_seconds: 8,
  },
  {
    scene_id: 10,
    visual_prompt:
      "The Retiree watching the scam news on his TV sitting on his sofa, realises he has been scammed. Visibly angry and upset.",
    audio_script:
      'Retiree: "I have been scammed!"',
    text_overlay: "",
    duration_est_seconds: 8,
  },
  {
    scene_id: 11,
    visual_prompt:
      "The Retiree dials 997 on their phone and speaks calmly into the receiver. A look of relief replaces the fear. Close-up on the phone screen showing '997'. Warm, safe lighting. Informative style.",
    audio_script:
      'Retiree: "Hello, NSRC? I want to report a scam. I won\'t transfer any money."',
    text_overlay: "",
    duration_est_seconds: 8,
  },
];

export const MOCK_SCENES_BM = [
  {
    scene_id: 1,
    visual_prompt:
      "The Retiree (Victim) sits in a sunlit living room in Johor, watching television. The smartphone in his pocket starts ringing and he answers the phone and put it to his ear saying \"Hello?\". Medium shot, eye level. Bright and calm morning mood. Visual style: Cinematic.",
    audio_script: 'Pesara menjawab telefon: "Hello?"',
    text_overlay: "",
    duration_est_seconds: 8,
  },
  {
    scene_id: 2,
    visual_prompt:
      "The Retiree (Victim) answers the phone with a curious expression. Cut to the Fake Pos Laju representative wearing a professional headset in a generic office setting says: 'Ini adalah Pos Laju. Bungkusan anda telah ditahan oleh pihak kastam.' The Retiree (Victim) looks surprised and says \"Apa?\" Neutral lighting. Visual style: Documentary.",
    audio_script:
      'Wakil Pos Laju Palsu: "Ini adalah Pos Laju. Bungkusan anda telah ditahan oleh pihak kastam." Pesara: "Apa?"',
    text_overlay: "",
    duration_est_seconds: 8,
  },
  {
    scene_id: 3,
    visual_prompt:
      "The Fake Pos Laju representative speaks urgently while looking at a computer screen, saying \"Bungkusan itu mengandungi dadah haram. Anda sedang berada di bawah siasatan.\" Scene cuts to a package being detained and drugs being pulled out from it. Tense mood. Visual style: Tense drama.",
    audio_script:
      'Wakil Pos Laju Palsu: "Bungkusan itu mengandungi dadah haram. Anda sedang berada di bawah siasatan."',
    text_overlay: "",
    duration_est_seconds: 8,
  },
  {
    scene_id: 4,
    visual_prompt:
      "The Fake senior police officer speaks authoritatively saying \"Saya adalah pegawai kanan polis. Identiti anda dikaitkan dengan satu siasatan jenayah.\" The Retiree (Victim) listens on the other end, looking panicked says \"Tidak!\". Medium shot of the officer. Cold, authoritative lighting. Visual style: Tense thriller.",
    audio_script:
      'Pegawai Polis Palsu: "Saya adalah pegawai kanan polis. Identiti anda dikaitkan dengan satu siasatan jenayah." Pesara: "Tidak!"',
    text_overlay: "",
    duration_est_seconds: 8,
  },
  {
    scene_id: 5,
    visual_prompt:
      "The Fake senior police officer leans a bit close to the monitor, looking stern says 'Ini adalah sulit. Jangan beritahu keluarga anda atau sesiapa pun.', while the camera slowly moves to a close-up on the officer looking at the camera. High contrast lighting. Visual style: Suspenseful.",
    audio_script:
      'Pegawai Polis Palsu: "Ini adalah sulit. Jangan beritahu keluarga anda atau sesiapa pun."',
    text_overlay: "",
    duration_est_seconds: 8,
  },
  {
    scene_id: 6,
    visual_prompt:
      "The Retiree (Victim) standing very afraid and worried wiping his sweat and holding his phone to his ear. Cut to the Fake senior police officer in a dimly lit police room says: 'Untuk mengesahkan bahawa anda tidak bersalah, dana anda mesti dipindahkan ke akaun pengesahan khas yang dipantau oleh Bank Negara Malaysia.' Medium shot. Neutral, tense lighting. Visual style: Intimate drama.",
    audio_script:
      'Pegawai Polis Palsu: "Untuk mengesahkan bahawa anda tidak bersalah, dana anda mesti dipindahkan ke akaun pengesahan khas yang dipantau oleh Bank Negara Malaysia."',
    text_overlay: "",
    duration_est_seconds: 8,
  },
  {
    scene_id: 7,
    visual_prompt:
      "The Fake Bank Negara Malaysia representative depicted as a featureless humanoid silhouette, says \"Ini adalah Bank Negara, pindahkan 20,000 ke akaun pengesahan kami untuk membuktikan anda tidak bersalah.\". Visual style: Intimate drama.",
    audio_script:
      'Wakil Bank Negara Palsu: "Ini adalah Bank Negara, pindahkan 20,000 ke akaun pengesahan kami untuk membuktikan anda tidak bersalah."',
    text_overlay: "",
    duration_est_seconds: 8,
  },
  {
    scene_id: 8,
    visual_prompt:
      "The Retiree (Victim) sits in his home office room at a laptop with trembling hands, performing an online bank transfer. Once done, the camera moves to a close-up on the computer screen showing the transaction has been performed. Dim, somber lighting. Visual style: Dramatic.",
    audio_script: "",
    text_overlay: "",
    duration_est_seconds: 8,
  },
  {
    scene_id: 9,
    visual_prompt:
      "A calendar in the living room, the page gets blown to the next page smoothly by the wind revealing the next page.",
    audio_script: "",
    text_overlay: "",
    duration_est_seconds: 8,
  },
  {
    scene_id: 10,
    visual_prompt:
      "The Retiree (Victim) watching the scam news on his TV sitting on his sofa realised he has been scammed and says \"Saya telah ditipu!\" angrily and upset.",
    audio_script: 'Pesara: "Saya telah ditipu!"',
    text_overlay: "",
    duration_est_seconds: 8,
  },
  {
    scene_id: 11,
    visual_prompt:
      "Close up of the Fake Pos Laju representative depicted as a featureless humanoid silhouette says \"Untuk mengelakkan perkara ini, letakkan telefon dengan segera jika anda menerima panggilan yang tidak dijangka mengenai bungkusan yang mencurigakan.\" in a presentation room with a big screen behind showing parcel scam calls. Visual style: Public service announcement.",
    audio_script:
      'Penceramah: "Untuk mengelakkan perkara ini, letakkan telefon dengan segera jika anda menerima panggilan yang tidak dijangka mengenai bungkusan yang mencurigakan."',
    text_overlay: "",
    duration_est_seconds: 8,
  },
  {
    scene_id: 12,
    visual_prompt:
      "Close up of the Fake Bank Negara Malaysia representative depicted as a featureless humanoid silhouette says \"Jangan sesekali memindahkan wang ke akaun peribadi untuk tujuan 'pengesahan'.\" in a presentation room with a big screen behind showing transferring money to suspicious account. Visual style: Public service announcement.",
    audio_script:
      'Penceramah: "Jangan sesekali memindahkan wang ke akaun peribadi untuk tujuan pengesahan."',
    text_overlay: "",
    duration_est_seconds: 8,
  },
  {
    scene_id: 13,
    visual_prompt:
      "Close up of the Fake senior police officer depicted as a featureless humanoid silhouette says \"Sahkan tuntutan dengan menghubungi NSRC di talian 997 atau dengan mengunjungi balai polis.\" in a presentation room with a big screen behind showing fake police identity in parcel scam calls. Visual style: Public service announcement.",
    audio_script:
      'Penceramah: "Sahkan tuntutan dengan menghubungi NSRC di talian 997 atau dengan mengunjungi balai polis."',
    text_overlay: "",
    duration_est_seconds: 8,
  },
];

// ==================== Final Video Path ====================

export const MOCK_FINAL_VIDEO_PATH = "/demo-assets/veoplz_subtitled_source.mp4";

export const MOCK_GENERATE_RESPONSE: GenerateResponse = {
  session_id: MOCK_SESSION_ID,
  status: "completed",
  video_package: {
    video_inputs: {
      en: {
        project_id: "scam_pos_laju_verification_demo_en",
        total_duration_seconds: 30,
        scenes: MOCK_SCENES,
      },
    },
    sensitivity_report: {
      project_id: "scam_pos_laju_verification_demo_en",
      passed: true,
      flags: [],
      compliance_summary:
        "Video content has been reviewed and meets all safety and compliance standards. No issues detected with 3R (Race, Religion, Royalty) compliance.",
      detailed_analysis: [
        {
          category: "Cultural Sensitivity (3R)",
          status: "passed",
          analysis:
            "Content does not reference race, religion, or royalty in any negative context. Characters are appropriately depicted.",
          elements_reviewed: [
            "Racial representation",
            "Religious references",
            "Royal mentions",
          ],
        },
        {
          category: "Content Safety",
          status: "passed",
          analysis:
            "No violence, hate speech, or harmful content detected. Scammer characters are featureless humanoids.",
          elements_reviewed: [
            "Violence",
            "Hate Speech",
            "Harmful Content",
            "Character Depiction",
          ],
        },
        {
          category: "Legal Compliance",
          status: "passed",
          analysis:
            "Content complies with MCMC guidelines. References to official bodies (PDRM, Bank Negara) are accurate and appropriate.",
          elements_reviewed: [
            "MCMC Guidelines",
            "Official Body References",
            "Accuracy of Claims",
          ],
        },
      ],
      checked_against: [
        "MCMC Content Guidelines",
        "PDRM Media Policy",
        "3R Compliance Framework",
        "Community Standards",
      ],
    },
  },
  message: "Video package generated successfully with 11 scenes.",
};

export const MOCK_GENERATE_RESPONSE_BM: GenerateResponse = {
  session_id: MOCK_SESSION_ID,
  status: "completed",
  video_package: {
    video_inputs: {
      bm: {
        project_id: "scam_pos_laju_verification_demo_bm",
        total_duration_seconds: 30,
        scenes: MOCK_SCENES_BM,
      },
    },
    sensitivity_report: MOCK_GENERATE_RESPONSE.video_package!.sensitivity_report!,
  },
  message: "Pakej video berjaya dihasilkan dengan 13 adegan.",
  recommended_characters: [
    "Retiree (Victim)",
    "Fake Pos Laju representative",
    "Fake senior police officer",
    "Fake Bank Negara Malaysia representative",
  ],
};

// ==================== Demo Asset Paths ====================

const DEMO_CLIP_REF = "/demo-assets/clip_refs";
const DEMO_CHAR_REF = "/demo-assets/character_refs";
const DEMO_VEO = "/demo-assets/veo_clips";

// ==================== Character Descriptions ====================

const DEMO_CHAR_REF_2 = "/demo-assets/character_refs_2";

/**
 * Initial character descriptions returned from generateVideoPackage.
 * The police officer uses the pre-refinement version (character_refs_2).
 * The user can then chat to refine the police officer.
 */
export const MOCK_CHARACTER_DESCRIPTIONS_INITIAL = [
  {
    role: "Retiree (Victim)",
    type: "person" as const,
    description:
      "Full-body Malaysian Malay man in his late 60s, short thinning grey hair, wearing a patterned batik short-sleeved shirt, dark grey slacks, and leather sandals. He wears a simple gold watch on his left wrist.",
    image_url: `${DEMO_CHAR_REF}/Retiree_Victim_2x2_grid.png`,
  },
  {
    role: "Fake Pos Laju representative",
    type: "scammer" as const,
    description:
      "Full-body featureless humanoid with a slender build and neutral light grey shading, wearing a suggested collared shirt and a visible professional call-center headset silhouette.",
    image_url: `${DEMO_CHAR_REF}/Fake_Pos_Laju_representative_2x2_grid.png`,
  },
  {
    role: "Fake senior police officer",
    type: "scammer" as const,
    description:
      "Full-body featureless humanoid with a broad, imposing build and dark grey shading, featuring a faint silhouette of a peaked uniform cap and a suggested duty belt outline.",
    image_url: `${DEMO_CHAR_REF_2}/Fake_senior_police_officer_2x2_grid.png`,
  },
  {
    role: "Fake Bank Negara Malaysia representative",
    type: "scammer" as const,
    description:
      "Full-body featureless humanoid with a medium build, neutral light-blue tinted shading, wearing a suggested formal waistcoat outline over a long-sleeved shirt silhouette.",
    image_url: `${DEMO_CHAR_REF}/Fake_Bank_Negara_Malaysia_representative_2x2_grid.png`,
  },
];

/**
 * Post-refinement character descriptions (from character_refs).
 * Returned after user chats to refine characters.
 */
export const MOCK_CHARACTER_DESCRIPTIONS = [
  {
    role: "Retiree (Victim)",
    type: "person" as const,
    description:
      "Full-body Malaysian Malay man in his late 60s, short thinning grey hair, wearing a patterned batik short-sleeved shirt, dark grey slacks, and leather sandals. He wears a simple gold watch on his left wrist.",
    image_url: `${DEMO_CHAR_REF}/Retiree_Victim_2x2_grid.png`,
  },
  {
    role: "Fake Pos Laju representative",
    type: "scammer" as const,
    description:
      "Full-body featureless humanoid with a slender build and neutral light grey shading, wearing a suggested collared shirt and a visible professional call-center headset silhouette.",
    image_url: `${DEMO_CHAR_REF}/Fake_Pos_Laju_representative_2x2_grid.png`,
  },
  {
    role: "Fake senior police officer",
    type: "scammer" as const,
    description:
      "Full-body featureless humanoid with a broad-shouldered build, neutral grey shading, wearing a suggested peaked cap silhouette and a structured jacket with subtle epaulette outlines.",
    image_url: `${DEMO_CHAR_REF}/Fake_senior_police_officer_2x2_grid.png`,
  },
  {
    role: "Fake Bank Negara Malaysia representative",
    type: "scammer" as const,
    description:
      "Full-body featureless humanoid with a medium build, neutral light-blue tinted shading, wearing a suggested formal waistcoat outline over a long-sleeved shirt silhouette.",
    image_url: `${DEMO_CHAR_REF}/Fake_Bank_Negara_Malaysia_representative_2x2_grid.png`,
  },
];

// ==================== Video Clips (Veo) ====================

export const MOCK_VIDEO_CLIPS: Record<number, string> = {
  1: `${DEMO_VEO}/segment_1.mp4`,
  2: `${DEMO_VEO}/segment_2.mp4`,
  3: `${DEMO_VEO}/segment_3.mp4`,
  4: `${DEMO_VEO}/segment_4.mp4`,
  5: `${DEMO_VEO}/segment_5.mp4`,
  6: `${DEMO_VEO}/segment_6.mp4`,
  7: `${DEMO_VEO}/segment_7.mp4`,
  8: `${DEMO_VEO}/segment_8.mp4`,
  9: `${DEMO_VEO}/segment_9.mp4`,
  10: `${DEMO_VEO}/segment_10.mp4`,
  11: `${DEMO_VEO}/segment_11.mp4`,
};

export const MOCK_VIDEO_CLIPS_BM: Record<number, string> = {
  1: `${DEMO_VEO}/segment_1.mp4`,
  2: `${DEMO_VEO}/segment_2_malay.mp4`,
  3: `${DEMO_VEO}/segment_3.mp4`,
  4: `${DEMO_VEO}/segment_4.mp4`,
  5: `${DEMO_VEO}/segment_5.mp4`,
  6: `${DEMO_VEO}/segment_6.mp4`,
  7: `${DEMO_VEO}/segment_7.mp4`,
  8: `${DEMO_VEO}/segment_8.mp4`,
  9: `${DEMO_VEO}/segment_9.mp4`,
  10: `${DEMO_VEO}/segment_10.mp4`,
  11: `${DEMO_VEO}/segment_11.mp4`,
  12: `${DEMO_VEO}/segment_12.mp4`,
  13: `${DEMO_VEO}/segment_13.mp4`,
};

// ==================== Visual/Audio State ====================

const _MOCK_VA_SHARED = {
  obfuscated_story: null,
  veo_script: null,
  character_descriptions: {
    characters: MOCK_CHARACTER_DESCRIPTIONS.map((c) => ({
      character_name: c.role,
      visual_description: c.description,
      outfit_and_accessories:
        c.type === "person"
          ? "Traditional batik shirt, khaki trousers, leather loafers, silver wristwatch"
          : "Abstract silhouette attire as described",
      facial_expression_default: c.type === "person" ? "Neutral, slightly worried" : "Featureless",
      posture_and_mannerisms:
        c.type === "person" ? "Standing upright, slightly hunched from age" : "Rigid, mechanical posture",
      ethnicity_and_age: c.type === "person" ? "Malaysian Malay, late 60s" : "Abstract humanoid",
    })),
  },
  character_ref_images: MOCK_CHARACTER_DESCRIPTIONS.map((c) => ({
    character_name: c.role,
    image_path: c.image_url,
    image_base64: undefined,
  })),
  clip_ref_prompts: [] as Record<string, unknown>[],
  clip_ref_images: Array.from({ length: 13 }, (_, i) => ({
    segment_id: i + 1,
    start_frame_path: `${DEMO_CLIP_REF}/segment_${i + 1}_start.png`,
    end_frame_path: `${DEMO_CLIP_REF}/segment_${i + 1}_end.png`,
    start_frame_base64: undefined,
    end_frame_base64: undefined,
  })),
  output_dir: null,
};

export const MOCK_VISUAL_AUDIO_STATE: VisualAudioState = {
  ..._MOCK_VA_SHARED,
  veo_clips: Array.from({ length: 13 }, (_, i) => ({
    segment_index: i + 1,
    segment_id: i + 1,
    filename: `segment_${i + 1}.mp4`,
    path: `${DEMO_VEO}/segment_${i + 1}.mp4`,
    video_path: `${DEMO_VEO}/segment_${i + 1}.mp4`,
    video_uri: undefined,
  })),
};

/**
 * Malay variant — uses segment_2_malay.mp4 for segment 2,
 * and includes all 13 segments (matching the BM scene breakdown).
 */
export const MOCK_VISUAL_AUDIO_STATE_BM: VisualAudioState = {
  ..._MOCK_VA_SHARED,
  veo_clips: Array.from({ length: 13 }, (_, i) => {
    const segNum = i + 1;
    const filename = segNum === 2 ? "segment_2_malay.mp4" : `segment_${segNum}.mp4`;
    return {
      segment_index: segNum,
      segment_id: segNum,
      filename,
      path: `${DEMO_VEO}/${filename}`,
      video_path: `${DEMO_VEO}/${filename}`,
      video_uri: undefined,
    };
  }),
};

// ==================== Preview Frames ====================

function makePreviewFrame(
  sceneId: number,
  frameType: "start" | "end",
  prompt: string,
  segmentIndex?: number
): PreviewFrame {
  const seg = segmentIndex ?? sceneId;
  return {
    scene_id: sceneId,
    frame_type: frameType,
    image_url: `${DEMO_CLIP_REF}/segment_${seg}_${frameType}.png`,
    image_data: `${DEMO_CLIP_REF}/segment_${seg}_${frameType}.png`,
    visual_prompt: prompt,
    generated_at: "2026-02-20T10:00:00Z",
    refined_at: null,
  };
}

export const MOCK_PREVIEW_FRAMES: PreviewFrame[] = [
  makePreviewFrame(1, "start", "Retiree (Victim) as in the reference, sitting on a sofa chilling in a sunlit living room in Johor, gaze fixed on a television screen, body relaxed."),
  makePreviewFrame(1, "end", "Retiree (Victim) as in the reference, sitting on the sofa, holding his smartphone to his right ear, mouth slightly open as if speaking, looking toward the side with a neutral expression."),
  makePreviewFrame(2, "start", "Retiree (Victim) as in the reference, holding his smartphone to his ear, his eyebrows raised in a curious expression, while in a separate generic office, a Fake Pos Laju representative depicted exactly as a featureless humanoid silhouette with no human face or realistic features wears a professional headset."),
  makePreviewFrame(2, "end", "Retiree (Victim) as in the reference, in a close-up shot, holding the phone tightly to his ear, eyes widened slightly in reaction to the voice on the line."),
  makePreviewFrame(3, "start", "The Fake Pos Laju representative, a featureless humanoid silhouette exactly same as in the reference image, sits at a desk facing a computer monitor."),
  makePreviewFrame(3, "end", "A few fake Pos Laju representative, all featureless humanoid silhouette exactly same as in the reference is at a shipping port pulling out illegal drugs from a person's package."),
  makePreviewFrame(4, "start", "Close up of Retiree (Victim) as in the reference holding his smartphone to his ear, head bowed stressed, while in a separate dim police office, a fake senior police officer, depicted exactly as a featureless humanoid silhouette with no human face or realistic features sits at a desk facing a computer monitor;"),
  makePreviewFrame(4, "end", "Retiree (Victim) as in the reference, in a close-up shot, holding the phone tightly to his ear, shocked in reaction to the voice on the line."),
  makePreviewFrame(5, "start", "Tight close up of the featureless humanoid silhouette of the Fake senior police officer, leaning toward the monitor."),
  makePreviewFrame(5, "end", "Tight close up of the featureless humanoid silhouette of the Fake senior police officer, leaning toward the camera."),
  makePreviewFrame(6, "start", "A left right split screen showing Retiree (Victim) as in the reference standing in his living room wiping his sweat and holding his phone to his ear, a fake senior police officer, a featureless humanoid silhouette exactly same as in the reference image in a separate dim police office sits at a desk facing a computer monitor;"),
  makePreviewFrame(6, "end", "Retiree (Victim) as in the reference, in a close-up shot, holding the phone to his ear afraid and worried. The fake senior police officer, maintain his position."),
  makePreviewFrame(7, "start", "A fake Bank Negara Malaysia representative, a featureless humanoid silhouette exactly same colour as in the reference image, in a dimly lit formal bank office sits at a desk behind his computer monitor wearing headphones."),
  makePreviewFrame(7, "end", "The fake Bank Negara Malaysia representative as in the reference in a close up shot."),
  makePreviewFrame(8, "start", "Retiree (Victim) as in the reference, in his dimly lit home office room in Johor, with trembling hands performing an online bank transfer on his laptop."),
  makePreviewFrame(8, "end", "Tight close up of the laptop screen with a big green tick pop up showing the online bank transfer has been performed successfully."),
  makePreviewFrame(9, "start", "A close up of a calendar standing on the living room table."),
  makePreviewFrame(9, "end", 'The same calendar shows the text "3 weeks later".'),
  makePreviewFrame(10, "start", 'Retiree (Victim) as in the reference, watching the TV displaying "Pos Laju Scam" news.'),
  makePreviewFrame(10, "end", "Close up of the Retiree (Victim) as in the reference, is now visibly angry and upset at the news realising he has been scammed."),
  makePreviewFrame(11, "start", "Close up of the Fake Pos Laju representative, a featureless humanoid silhouette exactly same as in the reference image in a presentation room giving a lecture on suspicious parcel scams with a big screen behind him displaying parcel scams.", 11),
  makePreviewFrame(11, "end", "Close up of the Fake Pos Laju representative continuing giving a lecture on suspicious parcel scams.", 11),
  makePreviewFrame(12, "start", "Close up of the Fake Bank Negara Malaysia representative, a featureless humanoid silhouette exactly same as in the reference image in a bank presentation room giving a lecture on never transferring money to accounts for verification in parcel scam with a big screen behind him displaying transferring money in parcel scams.", 12),
  makePreviewFrame(12, "end", "Close up of the Fake Bank Negara Malaysia representative continuing giving a lecture on never transferring money in parcel scams.", 12),
  {
    scene_id: 13,
    frame_type: "start",
    image_url: `${DEMO_CLIP_REF}/segment_13_start_demo.png`,
    image_data: `${DEMO_CLIP_REF}/segment_13_start_demo.png`,
    visual_prompt: "Close up of the Fake senior police officer, a featureless humanoid silhouette exactly same as in the reference image in a very dark police presentation room giving a lecture on fake police identity in parcel scam with a big screen behind him displaying illustrative graphics of a digital ID, a police badge, and parcel delivery scenarios.",
    generated_at: "2026-02-20T10:00:00Z",
    refined_at: null,
  },
  {
    scene_id: 13,
    frame_type: "end",
    image_url: `${DEMO_CLIP_REF}/segment_13_end_demo.png`,
    image_data: `${DEMO_CLIP_REF}/segment_13_end_demo.png`,
    visual_prompt: "Close up of the Fake senior police officer continuing giving a lecture on fake police identity in parcel scams.",
    generated_at: "2026-02-20T10:00:00Z",
    refined_at: null,
  },
];

// ==================== Captions ====================

export const MOCK_CAPTIONS: Record<string, Array<{ segment_id: number; text: string }>> = {
  en: MOCK_SCENES.map((s) => ({
    segment_id: s.scene_id,
    text: s.audio_script || "(no dialogue)",
  })),
  bm: MOCK_SCENES_BM.map((s) => ({
    segment_id: s.scene_id,
    text: s.audio_script || "(tiada dialog)",
  })),
  zh: [
    { segment_id: 1, text: '退休者接听电话："喂？"' },
    { segment_id: 2, text: '假Pos Laju代表："这里是Pos Laju。您的包裹已被海关标记。" 退休者："什么？"' },
    { segment_id: 3, text: '假Pos Laju代表："包裹里含有非法毒品。您正在被调查。"' },
    { segment_id: 4, text: '假高级警官："我是一名高级警官。您的身份与一起刑事调查有关。" 退休者："不！"' },
    { segment_id: 5, text: '假高级警官："这是机密的。不要告诉您的家人或任何人。"' },
    { segment_id: 6, text: '假高级警官："为了证明您的清白，您的资金必须转入由国家银行监管的特别验证账户。"' },
    { segment_id: 7, text: '假国家银行代表："这里是国家银行。请将两万令吉转入我们的验证账户以证明清白。"' },
    { segment_id: 8, text: "（无对话）" },
    { segment_id: 9, text: "（无对话）" },
    { segment_id: 10, text: '退休者："我被骗了！"' },
    { segment_id: 11, text: '退休者："喂，NSRC？我要举报一个骗局。我不会转任何钱。"' },
    { segment_id: 12, text: "讲员：\"千万不要将钱转入个人账户进行所谓的\u2018验证\u2019。\"" },
    { segment_id: 13, text: '讲员："请拨打NSRC热线997或前往最近的警察局核实任何索赔。"' },
  ],
  ta: [
    { segment_id: 1, text: 'ஓய்வுபெற்றவர் தொலைபேசியில் பதிலளிக்கிறார்: "ஹலோ?"' },
    { segment_id: 2, text: 'போலி Pos Laju பிரதிநிதி: "இது Pos Laju. உங்கள் பார்சல் சுங்கத்தால் கொடியிடப்பட்டுள்ளது." ஓய்வுபெற்றவர்: "என்ன?"' },
    { segment_id: 3, text: 'போலி Pos Laju பிரதிநிதி: "பார்சலில் சட்டவிரோத போதைப்பொருள் உள்ளது. நீங்கள் விசாரணையில் உள்ளீர்கள்."' },
    { segment_id: 4, text: 'போலி மூத்த காவல்துறை அதிகாரி: "நான் ஒரு மூத்த அதிகாரி. உங்கள் அடையாளம் குற்றவியல் விசாரணையுடன் தொடர்புடையது." ஓய்வுபெற்றவர்: "இல்லை!"' },
    { segment_id: 5, text: 'போலி மூத்த காவல்துறை அதிகாரி: "இது ரகசியமானது. உங்கள் குடும்பத்தினரிடமோ யாரிடமோ சொல்லாதீர்கள்."' },
    { segment_id: 6, text: 'போலி மூத்த காவல்துறை அதிகாரி: "உங்கள் நிரபராதித்தன்மையை நிரூபிக்க Bank Negara கண்காணிக்கும் சிறப்புக் கணக்கிற்கு பணத்தை மாற்ற வேண்டும்."' },
    { segment_id: 7, text: 'போலி Bank Negara பிரதிநிதி: "இது Bank Negara. நிரபராதித்தன்மையை நிரூபிக்க 20,000 ரிங்கிட்டை எங்கள் சரிபார்ப்புக் கணக்கிற்கு மாற்றுங்கள்."' },
    { segment_id: 8, text: "(உரையாடல் இல்லை)" },
    { segment_id: 9, text: "(உரையாடல் இல்லை)" },
    { segment_id: 10, text: 'ஓய்வுபெற்றவர்: "நான் மோசடிக்கு ஆளானேன்!"' },
    { segment_id: 11, text: 'ஓய்வுபெற்றவர்: "ஹலோ, NSRC? நான் ஒரு மோசடியை புகாரளிக்க விரும்புகிறேன். நான் பணத்தை மாற்ற மாட்டேன்."' },
    { segment_id: 12, text: 'பேச்சாளர்: "சரிபார்ப்பு என்ற பெயரில் தனிப்பட்ட கணக்குகளுக்கு பணத்தை ஒருபோதும் மாற்ற வேண்டாம்."' },
    { segment_id: 13, text: 'பேச்சாளர்: "NSRC ஐ 997 இல் தொடர்பு கொள்வதன் மூலம் அல்லது உங்கள் அருகிலுள்ள காவல் நிலையத்திற்குச் சென்று உரிமைகோரல்களை சரிபார்க்கவும்."' },
  ],
};

export const MOCK_PREVIEW_STATE: PreviewState = {
  session_id: MOCK_SESSION_ID,
  frames: MOCK_PREVIEW_FRAMES,
  generation_status: "completed",
  generated_at: "2026-02-20T10:00:00Z",
  refinement_history: [],
};

// ==================== Social Output ====================

export const MOCK_SOCIAL_OUTPUT: SocialOutput = {
  project_id: "scam_pos_laju_verification_demo_en",
  platform: "instagram",
  trend_analysis: {
    trending_topics: [
      "#ScamAlert",
      "#MacauScam",
      "#PosLajuScam",
      "#PDRM",
      "#BankNegara",
      "#JanganKenaTipu",
    ],
    recommended_posting_time: "12:00 \u2013 2:00 PM MYT (lunch-break scroll peak) or 8:00 \u2013 10:00 PM MYT (evening wind-down, when seniors browse with family)",
    content_angle:
      "90-second cinematic dramatisation in 16:9 landscape \u2014 traces the full Macau Scam playbook from fake Pos Laju call \u2192 fake police transfer \u2192 drug trafficking threat \u2192 \u2018verification account\u2019 demand \u2192 counter-hack resolution. Targets seniors aged 40-65 with an urgent warning tone.",
    viral_potential: "High \u2014 63% of Macau Scam victims in Malaysia are women aged 40-65; content directly addressing this demographic through family sharing channels (WhatsApp groups, Facebook) has 3-5x organic reach vs. standard awareness posts",
    trend_hooks: [
      "RM1.5 billion lost to Macau Scams in 2023 \u2014 your parents could be next.",
      "Real police NEVER call to demand money. Share this before it\u2019s too late.",
      "\u2018Your parcel has drugs.\u2019 The 6 words that cost a retiree her life savings.",
    ],
    competitor_insights:
      "PDRM & BNM awareness videos average 5K-15K views but run 2-3 minutes and focus on generic \u2018don\u2019t give your details\u2019 advice. None directly dramatise the authority-fear spiral or teach the specific counter-hack (\u2018Hang up. Call 999.\u2019). A 90-second landscape dramatisation with emotional storytelling can 5-8x completion rate and drive 3x more shares on Facebook and WhatsApp.",
  },
  captions: [
    {
      caption:
        "One phone call. A fake Pos Laju officer. A fake police inspector. A fake drug charge.\n\nRM890,000 \u2014 gone.\n\nThis is the Macau Scam. It\u2019s the #1 scam in Malaysia, and it targets people like your parents.\n\nReal police NEVER call to demand money.\nReal police NEVER threaten arrest over the phone.\n\n\ud83d\udcde Suspicious call? HANG UP. Call 999.\n\nWatch this 90-second breakdown and share it with your family.\n\n#MacauScam #ScamAlert #ProtectOurElders #JanganKenaTipu",
      style: "Emotional Hook \u2014 Family Protection",
      estimated_engagement: "High \u2014 front-loads shock value + directly addresses the family-protection instinct that drives WhatsApp sharing among the target demographic",
      call_to_action: "Watch till the end. Then forward this to every family group chat. Save 999.",
    },
    {
      caption:
        "\u26a0\ufe0f SCAM WARNING: The Macau Scam Playbook\n\n\ud83d\udce6 \u2018Your Pos Laju parcel contains drugs.\u2019\n\ud83d\udc6e \u2018I am a senior police officer. You are under investigation.\u2019\n\ud83e\udd2b \u2018Do NOT tell anyone \u2014 this is confidential.\u2019\n\ud83c\udfe6 \u2018Transfer your savings to this verification account.\u2019\n\ud83d\udcb8 Life savings \u2014 gone.\n\nThis is NOT how real police work.\n\u2705 Real police serve warrants IN PERSON.\n\u2705 Bank Negara NEVER asks you to transfer money.\n\n\ud83d\udcde Hang up. Call 999. Walk to your nearest balai polis.\n\n#MacauScam #PDRMAlert #BankNegaraWarning #AntiScamMY",
      style: "Urgent PSA \u2014 Step-by-Step Breakdown",
      estimated_engagement: "Medium-High \u2014 educational format ideal for sharing in WhatsApp groups and Facebook community pages",
      call_to_action: "Share this to every family WhatsApp group. It could save someone\u2019s savings.",
    },
    {
      caption:
        "She was a retired teacher. She respected authority. She trusted the voice on the phone.\n\nThat trust cost her RM200,000.\n\nThe Macau Scam exploits one thing: your respect for authority. They know you won\u2019t question a \u2018police officer.\u2019 They know fear of jail will override your judgement.\n\nBut here\u2019s the truth they don\u2019t want you to know:\n\ud83d\udea8 Real police NEVER demand money by phone.\n\ud83c\udfe6 Bank Negara NEVER asks for transfers.\n\nThe counter-hack is simple: HANG UP. Call 999.\n\n#MacauScam #ScamAwareness #ProtectOurElders #StopScams",
      style: "Storytelling \u2014 Victim Empathy",
      estimated_engagement: "Medium \u2014 narrative approach builds emotional connection; particularly effective with the 40-65 female demographic",
      call_to_action: "Tag someone who needs to see this. Share before it\u2019s too late.",
    },
  ],
  selected_caption_index: 0,
  thumbnail: {
    recommended_scene_id: 4,
    thumbnail_prompt:
      "Wide 16:9 landscape frame \u2014 split composition: left side shows the Retiree gripping a phone with a panicked expression under warm household lighting; right side shows a menacing silhouette of the fake police officer on a dark background with faint red/blue police light flares. Bold yellow warning text across the lower third.",
    text_overlay: "REAL POLICE NEVER CALL FOR MONEY",
    rationale:
      "Scene 4 captures the authority-fear turning point \u2014 the moment the fake police officer leverages criminal charges to override rational thinking.",
    style_notes:
      "16:9 aspect ratio (1920\u00d71080). Use cinematic colour grading \u2014 warm tones on victim side, cold blue/red on scammer side. Text overlay in bold sans-serif across the lower third.",
  },
  hashtags: {
    primary_hashtags: ["#MacauScam", "#ScamAlert", "#AntiScam", "#ScamAwareness"],
    trending_hashtags: ["#MalaysiaScam2026", "#CyberCrime", "#JanganKenaTipu", "#StaySafe"],
    niche_hashtags: ["#PDRMAlert", "#BankNegaraWarning", "#ElderlyProtection", "#ProtectOurElders"],
    branded_hashtags: ["#ScamShield", "#AmaranAI"],
    total_count: 12,
    hashtag_string:
      "#MacauScam #ScamAlert #AntiScam #ScamAwareness #MalaysiaScam2026 #CyberCrime #JanganKenaTipu #StaySafe #PDRMAlert #BankNegaraWarning #ElderlyProtection #ScamShield",
  },
  posting_notes:
    "Upload as a 16:9 horizontal video (1920\u00d71080, 90 seconds). Post between 12-2 PM or 8-10 PM MYT when the 40-65 demographic is most active. Add BM/EN SRT subtitles for sound-off viewing. Prioritise Facebook Video and WhatsApp Status, followed by YouTube, IG Reels, and LinkedIn.",
  generated_at: "2026-02-20T10:00:00Z",
};

// ==================== Chat Preset Flows ====================

export interface FactSheetChatPreset {
  trigger: string;
  response: string;
  updatedFactCheck: FrontendFactCheck;
}

export const MOCK_FACTSHEET_CHAT_PRESETS: FactSheetChatPreset[] = [
  {
    trigger: "20k",
    response:
      "Done! I\u2019ve updated the story hook to mention the RM 20,000 figure. The fact sheet now highlights that victims are being tricked into transferring RM 20,000 to the scammer\u2019s \u2018verification account\u2019, making the financial impact more concrete and relatable for the audience.",
    updatedFactCheck: {
      scam_name: "Pos Laju Verification Scam",
      story_hook:
        "Scammers call victims impersonating Pos Laju representatives, claiming a parcel addressed to them has been flagged by customs for containing illegal items such as drugs or counterfeit goods. The call is then \u2018transferred\u2019 to a fake police officer or Bank Negara Malaysia representative who pressures the victim into transferring RM 20,000 to a \u2018verification account\u2019 to clear their name \u2014 wiping out their savings in a single transaction.",
      red_flag:
        "Unsolicited call claiming a parcel contains illegal items; being \u2018transferred\u2019 to police or Bank Negara; pressure to keep the matter confidential; request to transfer money to a \u2018verification account\u2019.",
      the_fix:
        "Hang up immediately. Never transfer money based on phone instructions. Verify claims through official Pos Laju, police (997), or Bank Negara hotlines. Tell a trusted family member or friend.",
      reference_sources: [
        "https://www.thestar.com.my/news/nation/2026/02/15/rm42-million-lost-to-fake-delivery-scam",
        "https://www.pdrm.gov.my/scam-alerts",
        "https://www.bnm.gov.my/financial-fraud",
      ],
      category: "Parcel/Delivery Scam",
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
    },
  },
];

export const MOCK_FACTSHEET_CHAT_DEFAULT_RESPONSE =
  "I\u2019ve reviewed your request. Could you be more specific about what you\u2019d like to change? For example, you can ask me to mention a specific amount like RM 20k in the story hook to make the financial impact more concrete.";

// --- Video Package Chat Presets ---

export interface VideoChatPreset {
  trigger: string;
  response: string;
  updatedSceneBreakdown: Array<{
    scene_id: number;
    visual_prompt: string;
    audio_script: string;
    text_overlay?: string;
    duration_est_seconds?: number;
  }>;
}

export const MOCK_VIDEO_CHAT_PRESETS: VideoChatPreset[] = [
  {
    trigger: "dramatic",
    response:
      "Great idea! I\u2019ve enhanced the drama across key scenes \u2014 added more intense lighting, tighter close-ups during the phone calls, and made the money transfer scene more emotionally impactful. The ending now has a stronger emotional payoff.",
    updatedSceneBreakdown: [
      {
        scene_id: 1,
        visual_prompt:
          "The Retiree (Victim) sits alone in a quiet, sunlit living room watching television. His phone RINGS sharply, cutting through the calm. He answers cautiously. Medium shot, eye level. Golden morning light. Cinematic style.",
        audio_script: 'Retiree hesitantly answers the phone: "Hello...?"',
        duration_est_seconds: 8,
      },
      {
        scene_id: 2,
        visual_prompt:
          "SPLIT SCREEN \u2014 Left: The Retiree\u2019s face showing curiosity turning to confusion. Right: A featureless humanoid silhouette (Fake Pos Laju rep) in a sterile office, headset on, leaning forward. Tense documentary style.",
        audio_script:
          'Fake Pos Laju rep (cold, official tone): "This is Pos Laju. Your parcel has been flagged by customs for illegal substances." Retiree: "What?!"',
        duration_est_seconds: 8,
      },
      {
        scene_id: 3,
        visual_prompt:
          "DRAMATIC ZOOM into the Fake Pos Laju rep\u2019s monitor showing fabricated customs documents. Quick cut to a dark warehouse \u2014 hands pulling drugs from a package. Red-tinted lighting. Thriller style.",
        audio_script:
          'Fake Pos Laju rep (urgent whisper): "The package contains illegal drugs. You are now under criminal investigation."',
        duration_est_seconds: 8,
      },
      {
        scene_id: 4,
        visual_prompt:
          "LOW ANGLE shot of the Fake senior police officer silhouette behind a desk \u2014 imposing, backlit. Cut to HIGH ANGLE of the Retiree \u2014 small, vulnerable, gripping his phone. Extreme contrast lighting. Intense thriller.",
        audio_script:
          'Fake police officer (commanding): "I am a senior officer. Your identity is linked to a major criminal ring." Retiree (voice breaking): "No... that can\'t be!"',
        duration_est_seconds: 8,
      },
      {
        scene_id: 5,
        visual_prompt:
          "EXTREME CLOSE-UP of the Fake police officer silhouette leaning into camera, filling the frame. Harsh single-source lighting casting deep shadows. Claustrophobic framing. Psychological thriller style.",
        audio_script:
          'Fake police officer (threatening whisper): "This is classified. If you tell ANYONE \u2014 your family, friends \u2014 you will be arrested immediately."',
        duration_est_seconds: 8,
      },
      {
        scene_id: 6,
        visual_prompt:
          "The Retiree stands in his living room, visibly trembling, sweat on his forehead. Phone pressed to his ear. Camera slowly PUSHES IN. The room darkens around him. Intimate, suffocating drama.",
        audio_script:
          'Fake police officer: "To verify your innocence, transfer your funds NOW to a special Bank Negara verification account. This is your only chance."',
        duration_est_seconds: 8,
      },
      {
        scene_id: 7,
        visual_prompt:
          "Dark, cold bank office. The Fake Bank Negara rep \u2014 a metallic featureless humanoid \u2014 speaks from behind a monitor. Blue cold light reflects off the metallic surface. Unsettling, clinical style.",
        audio_script:
          'Fake BNM rep (robotic calm): "This is Bank Negara. Transfer RM20,000 to verification account. Immediately."',
        duration_est_seconds: 8,
      },
      {
        scene_id: 8,
        visual_prompt:
          "CLOSE-UP of trembling hands on a laptop keyboard. The Retiree types his bank credentials. Camera SLOWLY ZOOMS into the screen \u2014 the transfer confirmation button. He clicks. A green checkmark appears. The light from the screen illuminates his devastated face. Gut-wrenching dramatic style.",
        audio_script: "(Silence. Only the sound of a keyboard clicking and a soft, ominous tone.)",
        duration_est_seconds: 8,
      },
      {
        scene_id: 9,
        visual_prompt:
          "Time-lapse of a calendar \u2014 pages tearing away rapidly. \u20183 WEEKS LATER\u2019 burns onto screen in red. The living room shifts from bright to dark, shadows creeping in. Ominous transition.",
        audio_script: "",
        duration_est_seconds: 8,
      },
      {
        scene_id: 10,
        visual_prompt:
          "The Retiree watches a TV news report about the Pos Laju scam. His face transforms from confusion to horror to fury. He stands up, SLAMS the remote down. Tight handheld camera. Raw, emotional style.",
        audio_script:
          'Retiree (shouting, voice cracking): "I\'ve been scammed! My entire savings... GONE!"',
        duration_est_seconds: 8,
      },
      {
        scene_id: 11,
        visual_prompt:
          "REDEMPTION SHOT \u2014 The Retiree, calmer now, picks up his phone and dials 997. Warm golden light gradually fills the room. Camera pulls back to a wide shot \u2014 he\u2019s not alone anymore, hope returns. Uplifting, informative style.",
        audio_script:
          'Retiree (determined, steady): "Hello, NSRC? I want to report a scam. And I want to make sure no one else falls for this."',
        duration_est_seconds: 8,
      },
    ],
  },
  {
    trigger: "avoid",
    response:
      "Great suggestion! I\u2019ve preserved the original first 11 scenes and added two extra prevention scenes (12 and 13) at the end. Total scenes updated from 11 to 13.",
    updatedSceneBreakdown: [
      ...MOCK_SCENES.map((s) => ({
        scene_id: s.scene_id,
        visual_prompt: s.visual_prompt,
        audio_script: s.audio_script,
        text_overlay: s.text_overlay,
        duration_est_seconds: s.duration_est_seconds,
      })),
      {
        scene_id: 12,
        visual_prompt:
          "Close up of the Fake Bank Negara Malaysia representative depicted as a featureless humanoid silhouette giving lecture on how to avoid being scammed in a presentation room with a big screen behind showing transferring money to suspicious account.",
        audio_script: 'Narrator: "Never transfer money to personal accounts for verification."',
        duration_est_seconds: 8,
      },
      {
        scene_id: 13,
        visual_prompt:
          "Close up of the Fake senior police officer depicted as a featureless humanoid silhouette giving lecture on how to avoid being scammed in a presentation room with a big screen behind showing fake police identity in parcel scam calls.",
        audio_script: 'Narrator: "Verify claims by calling NSRC at 997 or visit a police station."',
        duration_est_seconds: 8,
      },
    ],
  },
];

export const MOCK_VIDEO_CHAT_DEFAULT_RESPONSE =
  "I\u2019ve noted your feedback. Could you tell me specifically what you\u2019d like to change? For example \u2014 make scenes more dramatic, change the ending, adjust the tone, or add/remove scenes.";

// --- Preview Frames Chat Presets ---

export interface PreviewChatPreset {
  trigger: string;
  response: string;
  updatedPreviewState: PreviewState;
}

export const MOCK_PREVIEW_CHAT_PRESETS: PreviewChatPreset[] = [
  {
    trigger: "lighting",
    response:
      "Done! I\u2019ve updated the visual prompts across all scenes with more dramatic, high-contrast lighting \u2014 darker shadows for tense scenes, warmer golden tones for the resolution. The frames will regenerate with these new prompts.",
    updatedPreviewState: {
      ...MOCK_PREVIEW_STATE,
      frames: MOCK_PREVIEW_FRAMES.map((f) => ({
        ...f,
        visual_prompt: f.visual_prompt + " High-contrast dramatic cinematic lighting with deep shadows and warm highlights.",
        refined_at: "2026-02-20T10:05:00Z",
      })),
      refinement_history: [
        {
          timestamp: "2026-02-20T10:05:00Z",
          user_message: "Make the lighting more dramatic",
          ai_response: "Updated all frames with high-contrast cinematic lighting.",
          updated_prompts: Object.fromEntries(
            Array.from({ length: 11 }, (_, i) => [i + 1, "Updated with dramatic lighting"])
          ),
          regenerated_frames: Array.from({ length: 11 }, (_, i) => i + 1),
        },
      ],
    },
  },
  {
    trigger: "childish",
    response:
      "Got it! I\u2019ve replaced the illustrative cartoon-style graphics on Scene 13\u2019s background slide with more realistic, professional visuals. The frames have been regenerated.",
    updatedPreviewState: {
      ...MOCK_PREVIEW_STATE,
      frames: MOCK_PREVIEW_FRAMES.map((f) => {
        if (f.scene_id === 13) {
          return {
            ...f,
            image_url: `${DEMO_CLIP_REF}/segment_13_${f.frame_type}.png`,
            image_data: `${DEMO_CLIP_REF}/segment_13_${f.frame_type}.png`,
            visual_prompt: f.frame_type === "start"
              ? "Close up of the Fake senior police officer, a featureless humanoid silhouette exactly same as in the reference image in a very dark police presentation room giving a lecture on fake police identity in parcel scam with a big screen behind him displaying fake police identity in parcel scams."
              : "Close up of the Fake senior police officer continuing giving a lecture on fake police identity in parcel scams.",
            refined_at: "2026-02-20T10:08:00Z",
          };
        }
        return f;
      }),
      refinement_history: [
        {
          timestamp: "2026-02-20T10:08:00Z",
          user_message: "Make it less childish in the background slide",
          ai_response: "Replaced illustrative graphics with realistic visuals for Scene 13.",
          updated_prompts: { 13: "Updated with realistic background slide" },
          regenerated_frames: [13],
        },
      ],
    },
  },
];

export const MOCK_PREVIEW_CHAT_DEFAULT_RESPONSE =
  "I can adjust the preview frames. Try asking me to change the lighting, camera angles, character poses, or scene composition.";

// --- Social Chat Presets ---

export interface SocialChatPreset {
  trigger: string;
  response: string;
  updatedSocialOutput: SocialOutput;
}

export const MOCK_SOCIAL_CHAT_PRESETS: SocialChatPreset[] = [
  {
    trigger: "caption",
    response:
      "Done! I\u2019ve rewritten the primary caption to hit harder on the authority-fear exploit identified by Deep Research. The new version names the Macau Scam directly, deploys the counter-hack (\u2018Real police NEVER call for money\u2019), and targets the family-protection instinct that drives WhatsApp sharing among the 40-65 demographic.",
    updatedSocialOutput: {
      ...MOCK_SOCIAL_OUTPUT,
      captions: [
        {
          caption:
            "RM890,000. Gone. One phone call.\n\nThis is the Macau Scam \u2014 the #1 fraud in Malaysia.\n\n\u2018Your Pos Laju parcel has drugs.\u2019 \u2192 Fake police. \u2192 \u2018You\u2019re under investigation.\u2019 \u2192 \u2018Transfer your savings now.\u2019\n\nAll lies. Designed to weaponise your respect for authority.\n\n\ud83d\udea8 Real police NEVER demand money by phone.\n\ud83c\udfe6 Bank Negara NEVER asks for transfers.\n\n\ud83d\udcde Hang up. Call 999. Walk to your nearest balai polis.\n\nWatch this 90-second breakdown and share it with your parents.\n\n#MacauScam #ScamAlert #ProtectOurElders #JanganKenaTipu",
          style: "Counter-Hack Hook \u2014 Authority Fear Breaker",
          estimated_engagement: "Very High \u2014 directly deploys the counter-hack message from Deep Research",
          call_to_action: "Watch, then forward to every family group chat. The counter-hack is simple: HANG UP. Call 999.",
        },
        ...MOCK_SOCIAL_OUTPUT.captions.slice(1),
      ],
      generated_at: "2026-02-20T10:10:00Z",
    },
  },
  {
    trigger: "hashtag",
    response:
      "I\u2019ve updated the hashtag strategy to align with the Macau Scam categorisation from Deep Research. Added #MacauScam as the primary identifier, plus #HangUpCall999 as the counter-hack anchor.",
    updatedSocialOutput: {
      ...MOCK_SOCIAL_OUTPUT,
      hashtags: {
        primary_hashtags: ["#MacauScam", "#ScamAlert", "#AntiScam", "#HangUpCall999", "#ScamAwareness"],
        trending_hashtags: ["#MalaysiaScam2026", "#CyberCrime", "#JanganKenaTipu", "#997Malaysia", "#StaySafe"],
        niche_hashtags: ["#PDRMAlert", "#BankNegaraWarning", "#ElderlyProtection", "#ProtectOurElders", "#TelephoneFraud"],
        branded_hashtags: ["#ScamShield", "#AmaranAI", "#ProtectMalaysia"],
        total_count: 18,
        hashtag_string:
          "#MacauScam #ScamAlert #AntiScam #HangUpCall999 #ScamAwareness #MalaysiaScam2026 #CyberCrime #JanganKenaTipu #997Malaysia #StaySafe #PDRMAlert #BankNegaraWarning #ElderlyProtection #ProtectOurElders #TelephoneFraud #ScamShield #AmaranAI #ProtectMalaysia",
      },
      generated_at: "2026-02-20T10:10:00Z",
    },
  },
];

export const MOCK_SOCIAL_CHAT_DEFAULT_RESPONSE =
  "I can refine the social strategy. Try asking me to change the caption, add more hashtags, adjust the thumbnail, or modify the posting schedule.";

// --- Character Chat Presets ---

export interface CharacterChatPreset {
  trigger: string;
  response: string;
  updatedCharacters: typeof MOCK_CHARACTER_DESCRIPTIONS;
}

export const MOCK_CHARACTER_CHAT_PRESETS: CharacterChatPreset[] = [
  {
    trigger: "police",
    response:
      "Updated the police officer character! The silhouette now features a structured jacket with subtle epaulette outlines and a more defined peaked cap. The broad-shouldered build has been adjusted to look more authoritative with neutral grey shading.",
    updatedCharacters: MOCK_CHARACTER_DESCRIPTIONS,
  },
  {
    trigger: "officer",
    response:
      "Done! I\u2019ve refined the fake police officer\u2019s design. The silhouette now has a structured jacket with visible epaulette outlines, a sharper peaked cap, and a broader, more imposing stance.",
    updatedCharacters: MOCK_CHARACTER_DESCRIPTIONS,
  },
  {
    trigger: "refine",
    response:
      "I\u2019ve refined the police officer character based on your feedback. The silhouette now features a structured jacket with subtle epaulette outlines and a more defined peaked cap for a more authoritative look.",
    updatedCharacters: MOCK_CHARACTER_DESCRIPTIONS,
  },
  {
    trigger: "bulk",
    response:
      "Refined the police officer's character model to a more standard, realistic build. The uniform silhouette has been streamlined, reducing the broadness of the jacket and shoulders to ensure a natural, approachable presence while maintaining professional detail in the insignia and peaked cap.",
    updatedCharacters: MOCK_CHARACTER_DESCRIPTIONS,
  },
];

export const MOCK_CHARACTER_CHAT_DEFAULT_RESPONSE =
  "Done! I\u2019ve refined the police officer character based on your feedback. The reference image and description have been updated with a more detailed uniform silhouette.";
