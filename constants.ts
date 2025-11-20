export const APP_NAME = "SyncWAVE";

export const THEME_COLORS = {
  primary: "#06b6d4", // Cyan 500
  secondary: "#8b5cf6", // Violet 500
  background: "#09090b", // Zinc 950
  surface: "#18181b", // Zinc 900
};

// Placeholder for PeerJS config - in production use your own TURN/STUN servers
export const PEER_CONFIG = {
  debug: 2,
};

export const DEFAULT_SYSTEM_INSTRUCTION = `
You are a music curator AI for SyncWAVE. 
Your goal is to suggest songs based on a vibe or a previous song.
Return ONLY JSON data.
`;
