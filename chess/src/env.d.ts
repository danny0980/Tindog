/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional REST endpoint for the global Gauntlet leaderboard (see README). */
  readonly VITE_LEADERBOARD_URL?: string
  /** The game server the iOS / Android apps talk to, e.g. https://chess.example.com. */
  readonly VITE_SERVER_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
