
import React, { useEffect, useRef, useState } from 'react';
import ReactPlayer from 'react-player';
import { Play, Pause, SkipForward, Volume2, Lock } from 'lucide-react';
import { useRoom } from '../context/RoomContext';
import { TrackSource } from '../types';
import { Visualizer } from './Visualizer';

// Fix for ReactPlayer type mismatch where 'url' prop is not recognized in some TS environments
const ReactPlayerAny = ReactPlayer as any;

export const Player: React.FC = () => {
  const { roomState, isHost, updateSync, broadcastSeek, audioStream, setLocalStream, skipTrack, me } = useRoom();
  const { currentTrack, isPlaying, timestamp, lastUpdated } = roomState;

  // Refs
  // using any for playerRef to avoid strict type issues with the library export
  const playerRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // State
  const [volume, setVolume] = useState(0.8);
  const [localFileUrl, setLocalFileUrl] = useState<string | null>(null);
  const [urlTrackId, setUrlTrackId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  
  // Permissions
  const canPlay = me?.permissions.canPlay || false;
  const canSkip = me?.permissions.canSkip || false;
  
  // Web Audio API
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [elementSource, setElementSource] = useState<MediaElementAudioSourceNode | null>(null);
  const [streamSource, setStreamSource] = useState<MediaStreamAudioSourceNode | null>(null);

  // --- Audio Context Initialization ---
  useEffect(() => {
    if (!audioRef.current) return;

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    try {
      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(ctx.destination);
      setElementSource(source);
    } catch (e) {
      console.warn("Audio source creation failed", e);
    }
    setAudioContext(ctx);
    return () => { if (ctx.state !== 'closed') ctx.close(); };
  }, []);

  // --- Local File Object URL Handling (Host) ---
  useEffect(() => {
    if (isHost && currentTrack?.source === TrackSource.LOCAL && currentTrack.file) {
      const url = URL.createObjectURL(currentTrack.file);
      setLocalFileUrl(url);
      setUrlTrackId(currentTrack.id);
      return () => {
        URL.revokeObjectURL(url);
        setLocalFileUrl(null);
        setUrlTrackId(null);
      };
    } else {
      setLocalFileUrl(null);
      setUrlTrackId(null);
    }
  }, [currentTrack, isHost]);

  // --- Volume Control for Local Audio ---
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // --- Audio Source Management ---
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const isYouTube = currentTrack?.source === TrackSource.YOUTUBE;
    const isLocal = currentTrack?.source === TrackSource.LOCAL;

    if (isYouTube) {
        audio.pause();
        if (audio.src || audio.srcObject) {
            audio.removeAttribute('src');
            audio.srcObject = null;
            audio.load();
        }
        return;
    }

    if (isLocal) {
        if (isHost && localFileUrl) {
            if (urlTrackId === currentTrack?.id && audio.src !== localFileUrl) {
                audio.srcObject = null;
                audio.src = localFileUrl;
            }
        } else if (!isHost && audioStream) {
            if (audio.srcObject !== audioStream) {
                audio.removeAttribute('src');
                audio.srcObject = audioStream;
            }
        }
    }
  }, [currentTrack, localFileUrl, urlTrackId, audioStream, isHost]);

  // --- Playback State Management ---
  useEffect(() => {
      const audio = audioRef.current;
      if (!audio || currentTrack?.source === TrackSource.YOUTUBE) return;

      const attemptPlay = async () => {
          try {
              if (isPlaying && audio.paused) {
                 if (audio.readyState >= 2 || audio.srcObject) {
                    await audio.play();
                 }
              } else if (!isPlaying && !audio.paused) {
                  audio.pause();
              }
          } catch (error: any) {
              if (error.name !== 'AbortError' && error.name !== 'NotSupportedError') {
                  console.warn("Playback error:", error);
              }
          }
      };
      attemptPlay();
  }, [isPlaying, currentTrack, localFileUrl, audioStream]);


  // --- Host Streaming Logic ---
  useEffect(() => {
    if (!audioContext || !elementSource || !isHost || currentTrack?.source !== TrackSource.LOCAL) {
        return;
    }
    const dest = audioContext.createMediaStreamDestination();
    elementSource.connect(dest);
    setLocalStream(dest.stream);
    return () => {
      try { elementSource.disconnect(dest); } catch(e) { /* ignore */ }
      setLocalStream(null);
    };
  }, [localFileUrl, audioContext, elementSource, isHost, currentTrack, setLocalStream]);

  // --- Listener Visualizer Hookup ---
  useEffect(() => {
    if (isHost || !audioStream || !audioContext) return;
    if (streamSource) { try { streamSource.disconnect(); } catch(e) {} }
    const source = audioContext.createMediaStreamSource(audioStream);
    source.connect(audioContext.destination);
    setStreamSource(source);
    return () => { try { source.disconnect(); } catch(e) {} }
  }, [audioStream, audioContext, isHost]);


  // --- Sync Loop ---
  useEffect(() => {
    if (isHost) return; 

    const timeSincePacket = (Date.now() - lastUpdated) / 1000;
    const targetTime = timestamp + (isPlaying ? timeSincePacket : 0);
    const SYNC_THRESHOLD = 0.5; 

    if (currentTrack?.source === TrackSource.YOUTUBE && playerRef.current) {
      const current = playerRef.current.getCurrentTime?.() || 0;
      if (Math.abs(current - targetTime) > SYNC_THRESHOLD) {
        playerRef.current.seekTo(targetTime, 'seconds');
      }
    }
    
    if (currentTrack?.source === TrackSource.LOCAL && audioRef.current) {
       if (isPlaying && audioRef.current.paused && (audioRef.current.readyState >= 3 || audioRef.current.srcObject)) {
         audioRef.current.play().catch(() => {});
       } else if (!isPlaying && !audioRef.current.paused) {
         audioRef.current.pause();
       }
    }
  }, [roomState, isHost, isPlaying, timestamp, lastUpdated, currentTrack]);

  // --- Host Time Broadcast ---
  useEffect(() => {
    if (!isHost || !isPlaying) return;
    const interval = setInterval(() => {
      const time = getInternalTime();
      if (!isNaN(time)) updateSync(true, time);
    }, 1000);
    return () => clearInterval(interval);
  }, [isHost, isPlaying, updateSync]);

  // --- UI Progress Loop ---
  useEffect(() => {
      if (isSeeking) return;
      const updateUI = () => {
          let curr = 0;
          let dur = 0;
          if (isHost) {
              curr = getInternalTime();
              dur = getInternalDuration();
          } else {
              const latency = (Date.now() - lastUpdated) / 1000;
              curr = timestamp + (isPlaying ? latency : 0);
              dur = currentTrack?.duration || duration; 
          }
          if (!isNaN(curr)) setCurrentTime(curr);
          if (!isNaN(dur) && dur > 0) setDuration(dur);
      };
      const interval = setInterval(updateUI, 200);
      return () => clearInterval(interval);
  }, [isSeeking, isHost, currentTrack, isPlaying, timestamp, lastUpdated, duration]);

  // --- Helpers ---
  const getInternalTime = (): number => {
    if (currentTrack?.source === TrackSource.YOUTUBE && playerRef.current) return playerRef.current.getCurrentTime?.() || 0;
    if (currentTrack?.source === TrackSource.LOCAL && audioRef.current) return audioRef.current.currentTime || 0;
    return 0;
  };

  const getInternalDuration = (): number => {
     if (currentTrack?.source === TrackSource.YOUTUBE && playerRef.current) return playerRef.current.getDuration?.() || 0;
     if (currentTrack?.source === TrackSource.LOCAL && audioRef.current) return audioRef.current.duration || 0;
     return 0;
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds) || !isFinite(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // --- Event Handlers ---
  const handlePlayPause = () => {
    if (!canPlay) return;
    updateSync(!isPlaying, getInternalTime());
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!canPlay) return;
      setCurrentTime(parseFloat(e.target.value));
  };

  const handleSeekStart = () => {
      if (!canPlay) return;
      setIsSeeking(true);
  };

  const handleSeekEnd = () => {
      if (!canPlay) return;
      const time = currentTime;
      if (currentTrack?.source === TrackSource.YOUTUBE && playerRef.current) playerRef.current.seekTo(time, 'seconds');
      else if (currentTrack?.source === TrackSource.LOCAL && audioRef.current) audioRef.current.currentTime = time;
      broadcastSeek(time);
      setTimeout(() => setIsSeeking(false), 100);
  };

  const handleDuration = (dur: number) => { setDuration(dur); };

  const handleAudioError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
      const target = e.currentTarget;
      if (target.error && target.error.code !== 1 && !target.error.message.includes('aborted')) {
          console.error("Audio Error:", target.error);
      }
  };

  if (!currentTrack) {
    return (
      <div className="h-96 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/30 text-zinc-500">
        <p className="mt-4">Waiting for a signal...</p>
      </div>
    );
  }

  const activeVisualizerSource = isHost ? elementSource : streamSource;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl relative">
      
      {/* Visualizer Layer */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <Visualizer audioSource={activeVisualizerSource} context={audioContext} />
      </div>

      {/* Content Layer */}
      <div className="relative z-10 p-6 flex flex-col gap-4 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent h-full min-h-[400px] justify-end">
        
        {/* Track Info */}
        <div>
          <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-mono mb-2 border border-cyan-500/20">
            {currentTrack.source}
          </div>
          <h2 className="text-2xl font-bold text-white truncate leading-tight">{currentTrack.title}</h2>
          <p className="text-zinc-400 truncate">{currentTrack.artist}</p>
        </div>

        {/* YouTube Player */}
        <div className="absolute top-[-9999px] left-[-9999px]">
           {currentTrack.source === TrackSource.YOUTUBE && (
             <ReactPlayerAny
               ref={playerRef}
               key={currentTrack.id} 
               url={`https://www.youtube.com/watch?v=${currentTrack.url}`}
               playing={isPlaying}
               volume={volume}
               width="100%" 
               height="100%"
               onDuration={handleDuration}
               config={{ youtube: { playerVars: { disablekb: 1, start: Math.floor(timestamp), autoplay: 1, controls: 0 } } } as any} 
             />
           )}
        </div>

        <audio ref={audioRef} loop={false} crossOrigin="anonymous" className="hidden" onError={handleAudioError} onEnded={() => updateSync(false, 0)} />

        {/* Controls */}
        <div className="flex flex-col gap-4 mt-4">
          
          {/* Progress Bar */}
          <div className="flex items-center gap-3 text-xs font-mono text-zinc-400 w-full select-none">
            <span className="w-10 text-right">{formatTime(currentTime)}</span>
            <div className="relative flex-1 h-6 flex items-center group">
               <div className="absolute inset-0 h-1.5 my-auto bg-zinc-800/50 rounded-full overflow-hidden">
                   <div className={`h-full bg-cyan-500 ${isPlaying && !isSeeking ? 'animate-pulse' : ''}`} style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }} />
               </div>
               <input 
                  type="range" min={0} max={duration || 100} step="0.1" value={currentTime}
                  onChange={handleSeekChange} onMouseDown={handleSeekStart} onMouseUp={handleSeekEnd} onTouchStart={handleSeekStart} onTouchEnd={handleSeekEnd}
                  disabled={!canPlay}
                  className={`absolute inset-0 w-full h-full opacity-0 z-20 ${canPlay ? 'cursor-pointer' : 'cursor-not-allowed'}`}
               />
               {canPlay && (
                  <div className="absolute h-3 w-3 bg-white rounded-full shadow pointer-events-none transition-opacity duration-200 opacity-0 group-hover:opacity-100" style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`, transform: 'translate(-50%, 0)' }} />
               )}
            </div>
            <span className="w-10">{formatTime(duration)}</span>
          </div>

          <div className="flex items-center justify-between">
             <div className="flex items-center gap-4">
               <button 
                 className={`p-4 rounded-full transition-all active:scale-95 ${canPlay ? 'bg-white text-black hover:bg-zinc-200' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'}`}
                 onClick={handlePlayPause}
                 disabled={!canPlay}
               >
                 {isPlaying ? <Pause className="fill-current" /> : <Play className="fill-current ml-1" />}
               </button>
               
               <button 
                  className={`p-3 transition-colors ${canSkip ? 'text-zinc-400 hover:text-white' : 'text-zinc-700 cursor-not-allowed'}`}
                  onClick={skipTrack}
                  disabled={!canSkip}
                  title={canSkip ? "Skip" : "No skip permission"}
               >
                 {canSkip ? <SkipForward /> : <Lock size={20} />}
               </button>
             </div>

             <div className="flex items-center gap-2 text-zinc-400 bg-zinc-950/50 px-3 py-2 rounded-lg border border-zinc-800/50">
               <Volume2 size={16} />
               <input 
                 type="range" min="0" max="1" step="0.05" value={volume}
                 onChange={(e) => setVolume(parseFloat(e.target.value))}
                 className="w-20 accent-cyan-500 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
               />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
