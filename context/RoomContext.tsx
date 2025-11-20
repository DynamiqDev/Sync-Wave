import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import Peer, { DataConnection, MediaConnection } from 'peerjs';
import { v4 as uuidv4 } from 'uuid';
import { RoomState, Track, User, TrackSource, SyncPacket } from '../types';

interface RoomContextType {
  peerId: string | null;
  roomId: string | null;
  isHost: boolean;
  isDJ: boolean;
  connected: boolean;
  users: User[];
  queue: Track[];
  roomState: RoomState;
  audioStream: MediaStream | null;
  createRoom: (username: string) => void;
  joinRoom: (roomId: string, username: string) => void;
  addToQueue: (track: Track) => void;
  playTrack: (track: Track) => void;
  skipTrack: () => void;
  updateSync: (isPlaying: boolean, time: number) => void;
  broadcastSeek: (time: number) => void;
  localStream: MediaStream | null;
  setLocalStream: (stream: MediaStream | null) => void;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

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
  
  // Keep refs synced
  useEffect(() => { roomStateRef.current = roomState; }, [roomState]);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);

  const isDJ = isHost; 

  const initializePeer = useCallback((id: string | null = null) => {
    const newPeer = id ? new Peer(id) : new Peer();
    
    newPeer.on('open', (id) => {
      setPeerId(id);
      setConnected(true);
    });

    newPeer.on('connection', (conn) => {
      // Incoming Data Connection
      conn.on('data', (data: any) => handleIncomingData(data, conn));
      conn.on('open', () => {
         // Send initial state
         conn.send({ type: 'SYNC', payload: roomStateRef.current });
         conn.send({ type: 'QUEUE_UPDATE', payload: queueRef.current });
         connectionsRef.current.push(conn);

         // If we are currently streaming a local file, call the new user
         if (isHostRef.current && localStreamRef.current && roomStateRef.current.currentTrack?.source === TrackSource.LOCAL) {
             console.log("New user joined during playback, streaming to:", conn.peer);
             const call = newPeer.call(conn.peer, localStreamRef.current);
             mediaConnectionsRef.current.push(call);
         }
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
  }, []);

  const handleIncomingData = (data: any, conn: DataConnection) => {
    const packet = data as SyncPacket;
    switch (packet.type) {
      case 'SYNC':
        setRoomState(packet.payload);
        break;
      case 'QUEUE_UPDATE':
        setQueue(packet.payload);
        break;
    }
  };

  // Reactive effect to broadcast stream when it becomes available (track changes)
  useEffect(() => {
    if (isHost && localStream && peer && roomState.isPlaying) {
      console.log("Broadcasting new local stream to all peers");
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
    setUsers([{ id: 'host', name, isDJ: true, isHost: true }]);
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

  const broadcast = (packet: SyncPacket) => {
    connectionsRef.current.forEach(conn => {
      if (conn.open) conn.send(packet);
    });
  };

  const addToQueue = (track: Track) => {
    const newQueue = [...queue, track];
    setQueue(newQueue);
    broadcast({ type: 'QUEUE_UPDATE', payload: newQueue });
    
    if (!roomState.currentTrack) {
      playTrack(track);
    }
  };

  const playTrack = (track: Track) => {
    const newState: RoomState = {
      currentTrack: track,
      isPlaying: true,
      timestamp: 0,
      lastUpdated: Date.now(),
    };
    setRoomState(newState);
    broadcast({ type: 'SYNC', payload: newState });
    // Note: Player component updates localStream triggering broadcast effect
  };

  const skipTrack = () => {
    if (!isHost) return;
    const currentIndex = queue.findIndex(t => t.id === roomState.currentTrack?.id);
    if (currentIndex !== -1 && currentIndex < queue.length - 1) {
      playTrack(queue[currentIndex + 1]);
    }
  };

  const updateSync = (isPlaying: boolean, time: number) => {
    if (!isHost) return;
    const newState = { ...roomState, isPlaying, timestamp: time, lastUpdated: Date.now() };
    setRoomState(newState);
    broadcast({ type: 'SYNC', payload: newState });
  };

  const broadcastSeek = (time: number) => {
     if (!isHost) return;
     const newState = { ...roomState, timestamp: time, lastUpdated: Date.now() };
     setRoomState(newState);
     broadcast({ type: 'SYNC', payload: newState });
  }

  return (
    <RoomContext.Provider value={{
      peerId,
      roomId,
      isHost,
      isDJ,
      connected,
      users,
      queue,
      roomState,
      audioStream,
      createRoom,
      joinRoom,
      addToQueue,
      playTrack,
      skipTrack,
      updateSync,
      broadcastSeek,
      localStream,
      setLocalStream
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