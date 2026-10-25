import { createPersistentStore } from '../utils/store'
import { type JourneyState, sanitizeJourney } from './state'

export const JOURNEY_KEY = 'chess-arena:journey:v1'

export const journeyStore = createPersistentStore<JourneyState>(JOURNEY_KEY, sanitizeJourney, { backupKey: 'chess-arena:journey-backup' })
