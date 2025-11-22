
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import Peer, { DataConnection, MediaConnection } from 'peerjs';
import { v4 as uuidv4 } from 'uuid';
import { RoomState, Track, User, TrackSource, SyncPacket, UserPermissions } from '../types';

interface RoomContextType {
  peerId: string | null;
  roomId: string | null;
  isHost: boolean;
  connected: boolean;
  users: User[];
  queue: Track[];
  roomState: RoomState;
  audioStream: MediaStream | null;
  me: User | null; // Current user object with permissions
  createRoom: (username: string) => void;
  joinRoom: (roomId: string, username: string) => void;
  leaveRoom: () => void;
  addToQueue: (track: Track) => void;
  playTrack: (track: Track) => void;
  skipTrack: () => void;
  updateSync: (isPlaying: boolean, time: number) => void;
  broadcastSeek: (time: number) => void;
  localStream: MediaStream | null;
  setLocalStream: (stream: MediaStream | null) => void;
  // Admin functions
  kickUser: (userId: string) => void;
  updateUserPermissions: (userId: string, permissions: UserPermissions) => void;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

const DEFAULT_PERMISSIONS: UserPermissions = {
  canPlay: false,
  canQueue: false,
  canSkip: false,
};

const HOST_PERMISSIONS: UserPermissions = {
  canPlay: true,
  canQueue: true,
  canSkip: true,
};

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('');
  const [isHost, setIsHost] = useState(false);
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [queue, setQueue] = useState<Track[]>([]);
  
  // Audio Streams
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);

  const [roomState, setRoomState] = useState<RoomState>({
    currentTrack: null,
    isPlaying: false,
    timestamp: 0,
    lastUpdated: Date.now(),
  });

  // Refs for mutable access in callbacks
  const connectionsRef = useRef<DataConnection[]>([]);
  const mediaConnectionsRef = useRef<MediaConnection[]>([]);
  const roomStateRef = useRef(roomState);
  const queueRef = useRef(queue);
  const localStreamRef = useRef(localStream);
  const isHostRef = useRef(isHost);
  const usersRef = useRef(users);
  
  // Keep refs synced
  useEffect(() => { roomStateRef.current = roomState; }, [roomState]);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  useEffect(() => { usersRef.current = users; }, [users]);

  const me = users.find(u => u.id === peerId) || null;

  const broadcast = useCallback((packet: SyncPacket) => {
    connectionsRef.current.forEach(conn => {
      if (conn.open) conn.send(packet);
    });
  }, []);

  const leaveRoom = useCallback(() => {
    // Close all connections
    connectionsRef.current.forEach(c => c.close());
    mediaConnectionsRef.current.forEach(c => c.close());
    if (peer) peer.destroy();

    // Reset State
    setPeer(null);
    setPeerId(null);
    setRoomId(null);
    setConnected(false);
    setUsers([]);
    setQueue([]);
    setLocalStream(null);
    setAudioStream(null);
    setRoomState({ currentTrack: null, isPlaying: false, timestamp: 0, lastUpdated: Date.now() });
    // Reload window to ensure clean slate (simplest for WebRTC cleanup)
    window.location.reload();
  }, [peer]);

  const handleIncomingData = useCallback((data: any, conn: DataConnection) => {
    const packet = data as SyncPacket;
    
    switch (packet.type) {
      case 'SYNC':
        // Overwrite lastUpdated with local time to fix clock skew
        setRoomState({ ...packet.payload, lastUpdated: Date.now() });
        break;
        
      case 'QUEUE_UPDATE':
        setQueue(packet.payload);
        if (isHostRef.current) broadcast(packet);
        break;
        
      case 'USER_LIST':
        setUsers(packet.payload);
        break;
        
      case 'KICK':
        alert("You have been kicked from the room by the host.");
        leaveRoom();
        break;

      case 'JOIN':
        if (isHostRef.current) {
            const newName = packet.payload.name;
            const newUser: User = {
                id: conn.peer,
                name: newName,
                isHost: false,
                permissions: DEFAULT_PERMISSIONS
            };
            
            if (!usersRef.current.find(u => u.id === newUser.id)) {
                const updatedUsers = [...usersRef.current, newUser];
                setUsers(updatedUsers);
                usersRef.current = updatedUsers;
                
                broadcast({ type: 'USER_LIST', payload: updatedUsers });

                setTimeout(() => {
                    conn.send({ type: 'SYNC', payload: roomStateRef.current });
                    conn.send({ type: 'QUEUE_UPDATE', payload: queueRef.current });
                    conn.send({ type: 'USER_LIST', payload: updatedUsers });
                }, 500);
            }
        }
        break;
    }
  }, [broadcast, leaveRoom]);

  const initializePeer = useCallback((id: string | null = null) => {
    const newPeer = id ? new Peer(id) : new Peer();
    
    newPeer.on('open', (id) => {
      setPeerId(id);
      setConnected(true);
    });

    newPeer.on('connection', (conn) => {
      conn.on('data', (data: any) => handleIncomingData(data, conn));
      conn.on('open', () => {
         connectionsRef.current.push(conn);
         // If Host streaming local file, call new user
         if (isHostRef.current && localStreamRef.current && roomStateRef.current.currentTrack?.source === TrackSource.LOCAL) {
             const call = newPeer.call(conn.peer, localStreamRef.current);
             mediaConnectionsRef.current.push(call);
         }
      });
      conn.on('close', () => {
        // Remove user on disconnect (if host)
        if (isHostRef.current) {
            const updatedUsers = usersRef.current.filter(u => u.id !== conn.peer);
            setUsers(updatedUsers);
            usersRef.current = updatedUsers;
            broadcast({ type: 'USER_LIST', payload: updatedUsers });
        }
        connectionsRef.current = connectionsRef.current.filter(c => c.peer !== conn.peer);
      });
    });

    newPeer.on('call', (call) => {
      call.answer(); 
      call.on('stream', (remoteStream) => {
        setAudioStream(remoteStream);
      });
    });

    setPeer(newPeer);
    return newPeer;
  }, [handleIncomingData, broadcast]);

  // Stream broadcast effect
  useEffect(() => {
    if (isHost && localStream && peer && roomState.isPlaying) {
      connectionsRef.current.forEach(conn => {
        const call = peer.call(conn.peer, localStream);
        mediaConnectionsRef.current.push(call);
      });
    }
  }, [localStream, isHost, roomState.isPlaying, peer]);

  const createRoom = (name: string) => {
    setUsername(name);
    setIsHost(true);
    const id = uuidv4().slice(0, 6).toUpperCase();
    initializePeer(id);
    setRoomId(id);
    // Host gets full permissions
    setUsers([{ id: id, name, isHost: true, permissions: HOST_PERMISSIONS }]);
  };

  const joinRoom = (id: string, name: string) => {
    setUsername(name);
    setIsHost(false);
    setRoomId(id);
    const p = initializePeer();
    
    p.on('open', (myId) => {
      const conn = p.connect(id);
      conn.on('open', () => {
        connectionsRef.current.push(conn);
        conn.send({ type: 'JOIN', payload: { name } });
      });
      conn.on('data', (data) => handleIncomingData(data, conn));
    });
  };

  // --- Admin Functions ---

  const kickUser = (userId: string) => {
    if (!isHost) return;
    
    const targetConn = connectionsRef.current.find(c => c.peer === userId);
    if (targetConn) {
        targetConn.send({ type: 'KICK', payload: {} });
        setTimeout(() => targetConn.close(), 500); // Give time to send packet
    }

    const updatedUsers = users.filter(u => u.id !== userId);
    setUsers(updatedUsers);
    broadcast({ type: 'USER_LIST', payload: updatedUsers });
  };

  const updateUserPermissions = (userId: string, newPermissions: UserPermissions) => {
    if (!isHost) return;

    const updatedUsers = users.map(u => 
        u.id === userId ? { ...u, permissions: newPermissions } : u
    );
    setUsers(updatedUsers);
    broadcast({ type: 'USER_LIST', payload: updatedUsers });
  };

  // --- Playback Functions (Check Permissions) ---

  const addToQueue = (track: Track) => {
    // Check permissions: Host or has canQueue
    if (!isHost && !me?.permissions.canQueue) return;

    const newQueue = [...queue, track];
    setQueue(newQueue);
    broadcast({ type: 'QUEUE_UPDATE', payload: newQueue });
    
    if (!roomState.currentTrack) {
      playTrack(track);
    }
  };

  const playTrack = (track: Track) => {
    if (!isHost && !me?.permissions.canPlay) return;

    const newState: RoomState = {
      currentTrack: track,
      isPlaying: true,
      timestamp: 0,
      lastUpdated: Date.now(),
    };
    setRoomState(newState);
    broadcast({ type: 'SYNC', payload: newState });
  };

  const skipTrack = () => {
    if (!isHost && !me?.permissions.canSkip) return;

    const currentIndex = queue.findIndex(t => t.id === roomState.currentTrack?.id);
    if (currentIndex !== -1 && currentIndex < queue.length - 1) {
      playTrack(queue[currentIndex + 1]);
    }
  };

  const updateSync = (isPlaying: boolean, time: number) => {
    if (!isHost && !me?.permissions.canPlay) return;
    const newState = { ...roomState, isPlaying, timestamp: time, lastUpdated: Date.now() };
    setRoomState(newState);
    broadcast({ type: 'SYNC', payload: newState });
  };

  const broadcastSeek = (time: number) => {
     if (!isHost && !me?.permissions.canPlay) return;
     const newState = { ...roomState, timestamp: time, lastUpdated: Date.now() };
     setRoomState(newState);
     broadcast({ type: 'SYNC', payload: newState });
  }

  return (
    <RoomContext.Provider value={{
      peerId, roomId, isHost, connected,
      users, queue, roomState, audioStream, me,
      createRoom, joinRoom, leaveRoom,
      addToQueue, playTrack, skipTrack,
      updateSync, broadcastSeek,
      localStream, setLocalStream,
      kickUser, updateUserPermissions
    }}>
      {children}
    </RoomContext.Provider>
  );
};

export const useRoom = () => {
  const context = useContext(RoomContext);
  if (!context) throw new Error('useRoom must be used within a RoomProvider');
  return context;
};
