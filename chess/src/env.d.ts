/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional REST endpoint for the global Gauntlet leaderboard (see README). */
  readonly VITE_LEADERBOARD_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
