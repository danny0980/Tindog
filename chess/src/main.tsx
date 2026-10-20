import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles/index.css'
import { loadAccount } from './online/ranked/account'
import { startCloudSync } from './online/ranked/cloudSync'

const container = document.getElementById('root')
if (!container) throw new Error('Root element #root not found')

// Chunk-download failures (offline, or file names gone after a new deploy) are
// handled by lazyWithRetry + the view ErrorBoundaries, which retry in place and
// offer "Reload App". We deliberately don't auto-reload on `vite:preloadError`:
// Vite fires it on the first failed attempt, which would pre-empt the retries
// and throw the player out of the screen they were on.
// Your account on the game server (also finishes a sign-in from an email link), and cloud saves.
void loadAccount()
startCloudSync()

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary scope="app" label="the app">
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
