// Card deck definitions
// Each deck is an array of display values.
// '☕' = "need a break", '?' = "uncertain / can't estimate"

export const CARD_DECKS = {
  fibonacci: {
    label: 'Fibonacci',
    values: ['☕', '?', '1', '2', '3', '5', '8', '13'],
  },
  tshirt: {
    label: 'T-Shirt Sizes',
    values: ['☕', '?', 'XS', 'S', 'M', 'L', 'XL', 'XXL'],
  },
  powers: {
    label: 'Powers of 2',
    values: ['☕', '?', '1', '2', '4', '8', '16', '32', '64'],
  },
}

export const DEFAULT_DECK = 'fibonacci'

// Room limits
export const MAX_PARTICIPANTS = 50

// WebSocket message types (used in Phase 2 — defined here to keep frontend/backend in sync)
// Note: there is no JOIN_ROOM message — roomId/userName are query params on
// the $connect route (see backend/handlers/connect.js), not a client message.
export const WS_EVENTS = {
  // Client → Server
  VOTE:         'VOTE',
  REVEAL:       'REVEAL',
  RESET:        'RESET',
  UPDATE_STORY: 'UPDATE_STORY',
  REQUEST_ROOM_STATE: 'REQUEST_ROOM_STATE',

  // Server → Client
  ROOM_STATE:   'ROOM_STATE',
  PARTICIPANT_JOINED: 'PARTICIPANT_JOINED',
  PARTICIPANT_LEFT:   'PARTICIPANT_LEFT',
  VOTE_CAST:    'VOTE_CAST',
  VOTES_REVEALED: 'VOTES_REVEALED',
  ROUND_RESET:  'ROUND_RESET',
  STORY_UPDATED: 'STORY_UPDATED',
  ERROR:        'ERROR',
}

// WebSocket endpoint, baked in at build time from the Terraform-created
// API Gateway URL (see .github/workflows/deploy-sandbox.yml).
export const WS_ENDPOINT = import.meta.env.VITE_WS_ENDPOINT

// Room states
export const ROOM_STATUS = {
  VOTING:   'voting',
  REVEALED: 'revealed',
}
