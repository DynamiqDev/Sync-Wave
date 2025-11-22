
export enum TrackSource {
  YOUTUBE = 'YOUTUBE',
  LOCAL = 'LOCAL',
}

export interface Track {
  id: string;
  source: TrackSource;
  title: string;
  artist: string;
  url?: string; // For YouTube ID or Blob URL
  duration: number;
  addedBy: string;
  file?: File; // For local files (Host only)
}

export interface UserPermissions {
  canPlay: boolean;  // Play/Pause
  canQueue: boolean; // Add to queue
  canSkip: boolean;  // Skip tracks
}

export interface User {
  id: string;
  name: string;
  isHost: boolean;
  permissions: UserPermissions;
}

export interface RoomState {
  currentTrack: Track | null;
  isPlaying: boolean;
  timestamp: number; // Current seek time in seconds
  lastUpdated: number; // Date.now() when the state was broadcast
}

export interface SyncPacket {
  type: 'SYNC' | 'QUEUE_UPDATE' | 'REQUEST_SYNC' | 'BEAT_SYNC' | 'JOIN' | 'USER_LIST' | 'KICK';
  payload: any;
}
