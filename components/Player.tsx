import React, { useEffect, useRef, useState } from 'react';
import ReactPlayer from 'react-player';
import { Play, Pause, SkipForward, Volume2 } from 'lucide-react';
import { useRoom } from '../context/RoomContext';
import { TrackSource } from '../types';
import { Visualizer } from './Visualizer';

export const Player: React.FC = () => {
  const { roomState, isDJ, updateSync, broadcastSeek, audioStream, setLocalStream, skipTrack } = useRoom();
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
  
  // Web Audio API
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [elementSource, setElementSource] = useState<MediaElementAudioSourceNode | null>(null);
  const [streamSource, setStreamSource] = useState<MediaStreamAudioSourceNode | null>(null);

  // --- Audio Context Initialization ---
  useEffect(() => {
    if (!audioRef.current) return;

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    // Ensure we only create the source once
    try {
      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(ctx.destination);
      setElementSource(source);
    } catch (e) {
      console.warn("Audio source creation failed", e);
    }
    
    setAudioContext(ctx);

    return () => {
      if (ctx.state !== 'closed') ctx.close();
    };
  }, []);

  // --- Local File Object URL Handling (Host) ---
  useEffect(() => {
    if (isDJ && currentTrack?.source === TrackSource.LOCAL && currentTrack.file) {
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
  }, [currentTrack, isDJ]);

  // --- Volume Control for Local Audio ---
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // --- Audio Source Management ---
  // This effect handles WHAT is playing (Src assignment), not IF it is playing.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const isYouTube = currentTrack?.source === TrackSource.YOUTUBE;
    const isLocal = currentTrack?.source === TrackSource.LOCAL;

    if (isYouTube) {
        // Completely reset audio element to stop any fetching
        audio.pause();
        if (audio.src || audio.srcObject) {
            audio.removeAttribute('src');
            audio.srcObject = null;
            audio.load(); // CRITICAL: Forces the browser to abort current fetch
        }
        return;
    }

    if (isLocal) {
        if (isDJ && localFileUrl) {
            // Host logic
            if (urlTrackId === currentTrack?.id && audio.src !== localFileUrl) {
                audio.srcObject = null;
                audio.src = localFileUrl;
            }
        } else if (!isDJ && audioStream) {
            // Listener logic
            if (audio.srcObject !== audioStream) {
                audio.removeAttribute('src');
                audio.srcObject = audioStream;
            }
        }
    }
  }, [currentTrack, localFileUrl, urlTrackId, audioStream, isDJ]);

  // --- Playback State Management ---
  // This effect handles Play/Pause triggers
  useEffect(() => {
      const audio = audioRef.current;
      if (!audio || currentTrack?.source === TrackSource.YOUTUBE) return;

      const attemptPlay = async () => {
          try {
              if (isPlaying && audio.paused) {
                 if (audio.readyState >= 2 || audio.srcObject) { // HAVE_CURRENT_DATA
                    await audio.play();
                 }
              } else if (!isPlaying && !audio.paused) {
                  audio.pause();
              }
          } catch (error: any) {
              // Ignore abort errors caused by rapid switching
              if (error.name !== 'AbortError' && error.name !== 'NotSupportedError') {
                  console.warn("Playback error:", error);
              }
          }
      };

      attemptPlay();

  }, [isPlaying, currentTrack, localFileUrl, audioStream]);


  // --- Host Streaming Logic ---
  useEffect(() => {
    if (!audioContext || !elementSource || !isDJ || currentTrack?.source !== TrackSource.LOCAL) {
        return;
    }
    
    const dest = audioContext.createMediaStreamDestination();
    elementSource.connect(dest);
    setLocalStream(dest.stream);

    return () => {
      try {
        elementSource.disconnect(dest);
      } catch(e) { /* ignore */ }
      setLocalStream(null);
    };
  }, [localFileUrl, audioContext, elementSource, isDJ, currentTrack, setLocalStream]);

  // --- Listener Visualizer Hookup ---
  useEffect(() => {
    if (isDJ || !audioStream || !audioContext) return;
    
    // Cleanup old source
    if (streamSource) {
        try { streamSource.disconnect(); } catch(e) {}
    }
    
    const source = audioContext.createMediaStreamSource(audioStream);
    source.connect(audioContext.destination);
    setStreamSource(source);

    return () => { try { source.disconnect(); } catch(e) {} }
  }, [audioStream, audioContext, isDJ]);


  // --- Sync Loop (Listeners) ---
  useEffect(() => {
    if (isDJ) return; 

    const latency = (Date.now() - lastUpdated) / 1000;
    const targetTime = timestamp + (isPlaying ? latency : 0);
    const SYNC_THRESHOLD = 2.5; 

    // Sync YouTube
    if (currentTrack?.source === TrackSource.YOUTUBE && playerRef.current) {
      const current = playerRef.current.getCurrentTime?.() || 0;
      if (Math.abs(current - targetTime) > SYNC_THRESHOLD) {
        playerRef.current.seekTo(targetTime, 'seconds');
      }
    }
    
    // Sync Local Audio (Re-align if drifted significantly)
    if (currentTrack?.source === TrackSource.LOCAL && audioRef.current) {
       // If we are supposed to be playing but audio is paused, force play
       if (isPlaying && audioRef.current.paused && (audioRef.current.readyState >= 3 || audioRef.current.srcObject)) {
         audioRef.current.play().catch(() => {});
       }
       
       // Only seek if not a live stream (Host file)
       // Note: P2P streams are live, seeking isn't really possible/necessary on the stream itself usually
       // but for the purpose of "Catch Up", we just rely on the stream being live.
    }
  }, [roomState, isDJ, isPlaying, timestamp, lastUpdated, currentTrack]);

  // --- Host Time Broadcast ---
  useEffect(() => {
    if (!isDJ || !isPlaying) return;
    
    const interval = setInterval(() => {
      const time = getInternalTime();
      if (!isNaN(time)) {
          updateSync(true, time);
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [isDJ, isPlaying, updateSync]);

  // --- UI Progress Loop ---
  useEffect(() => {
      if (isSeeking) return;

      const updateUI = () => {
          let curr = 0;
          let dur = 0;

          if (isDJ) {
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

      const interval = setInterval(updateUI, 250);
      return () => clearInterval(interval);
  }, [isSeeking, isDJ, currentTrack, isPlaying, timestamp, lastUpdated, duration]);

  // --- Helpers ---
  const getInternalTime = (): number => {
    if (currentTrack?.source === TrackSource.YOUTUBE && playerRef.current) {
       return playerRef.current.getCurrentTime?.() || 0;
    }
    if (currentTrack?.source === TrackSource.LOCAL && audioRef.current) {
      return audioRef.current.currentTime || 0;
    }
    return 0;
  };

  const getInternalDuration = (): number => {
     if (currentTrack?.source === TrackSource.YOUTUBE && playerRef.current) {
        return playerRef.current.getDuration?.() || 0;
     }
     if (currentTrack?.source === TrackSource.LOCAL && audioRef.current) {
        return audioRef.current.duration || 0;
     }
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
    if (!isDJ) return;
    updateSync(!isPlaying, getInternalTime());
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isDJ) return;
      const newTime = parseFloat(e.target.value);
      setCurrentTime(newTime);
  };

  const handleSeekStart = () => {
      if (!isDJ) return;
      setIsSeeking(true);
  };

  const handleSeekEnd = (e: React.MouseEvent | React.TouchEvent | React.KeyboardEvent) => {
      if (!isDJ) return;
      const time = currentTime;
      
      if (currentTrack?.source === TrackSource.YOUTUBE && playerRef.current) {
          playerRef.current.seekTo(time, 'seconds');
      } else if (currentTrack?.source === TrackSource.LOCAL && audioRef.current) {
          audioRef.current.currentTime = time;
      }
      
      broadcastSeek(time);
      setTimeout(() => setIsSeeking(false), 100);
  };

  const handleDuration = (dur: number) => {
      setDuration(dur);
  };

  const handleAudioError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
      const target = e.currentTarget;
      if (target.error) {
          // Suppress benign abort errors typical in React effect cycles
          if (target.error.code === 1 || target.error.message.includes('aborted')) {
              return; 
          }
          console.error("Audio Error:", target.error);
      }
  };

  if (!currentTrack) {
    return (
      <div className="h-96 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/30 text-zinc-500">
        <RadioIcon />
        <p className="mt-4">Waiting for a signal...</p>
      </div>
    );
  }

  const activeVisualizerSource = isDJ ? elementSource : streamSource;

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
             <ReactPlayer
               ref={playerRef}
               key={currentTrack.id} 
               url={`https://www.youtube.com/watch?v=${currentTrack.url}`}
               playing={isPlaying}
               volume={volume}
               width="100%" 
               height="100%"
               onDuration={handleDuration}
               config={{ 
                 youtube: { 
                   playerVars: { 
                     disablekb: 1,
                     start: Math.floor(timestamp),
                     autoplay: 1,
                     controls: 0
                   } 
                 }
               }} 
             />
           )}
        </div>

        {/* Hidden Audio Element for Local/Stream */}
        <audio 
            ref={audioRef}
            loop={false}
            crossOrigin="anonymous"
            className="hidden"
            onError={handleAudioError}
            onEnded={() => updateSync(false, 0)}
        />

        {/* Controls */}
        <div className="flex flex-col gap-4 mt-4">
          
          {/* Interactive Progress Bar */}
          <div className="flex items-center gap-3 text-xs font-mono text-zinc-400 w-full select-none">
            <span className="w-10 text-right">{formatTime(currentTime)}</span>
            
            <div className="relative flex-1 h-6 flex items-center group">
               {/* Background Track */}
               <div className="absolute inset-0 h-1.5 my-auto bg-zinc-800/50 rounded-full overflow-hidden">
                   <div 
                     className={`h-full bg-cyan-500 ${isPlaying && !isSeeking ? 'animate-pulse' : ''} transition-all duration-75 ease-linear`} 
                     style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                   />
               </div>

               {/* Range Input */}
               <input 
                  type="range" 
                  min={0} 
                  max={duration || 100}
                  step="0.1"
                  value={currentTime}
                  onChange={handleSeekChange}
                  onMouseDown={handleSeekStart}
                  onMouseUp={handleSeekEnd}
                  onTouchStart={handleSeekStart}
                  onTouchEnd={handleSeekEnd}
                  disabled={!isDJ}
                  className={`absolute inset-0 w-full h-full opacity-0 z-20 ${isDJ ? 'cursor-pointer' : 'cursor-not-allowed'}`}
               />
               
               {/* Visual Thumb */}
               {isDJ && (
                  <div 
                    className="absolute h-3 w-3 bg-white rounded-full shadow pointer-events-none transition-opacity duration-200 opacity-0 group-hover:opacity-100"
                    style={{ 
                        left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                        transform: 'translate(-50%, 0)'
                    }}
                  />
               )}
            </div>

            <span className="w-10">{formatTime(duration)}</span>
          </div>

          <div className="flex items-center justify-between">
             <div className="flex items-center gap-4">
               <button 
                 className={`p-4 rounded-full transition-all active:scale-95 ${isDJ ? 'bg-white text-black hover:bg-zinc-200' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'}`}
                 onClick={handlePlayPause}
                 disabled={!isDJ}
               >
                 {isPlaying ? <Pause className="fill-current" /> : <Play className="fill-current ml-1" />}
               </button>
               
               {isDJ && (
                 <button 
                    className="p-3 text-zinc-400 hover:text-white transition-colors"
                    onClick={skipTrack}
                    title="Skip to next track"
                 >
                   <SkipForward />
                 </button>
               )}
             </div>

             <div className="flex items-center gap-2 text-zinc-400 bg-zinc-950/50 px-3 py-2 rounded-lg border border-zinc-800/50">
               <Volume2 size={16} />
               <input 
                 type="range" 
                 min="0" max="1" step="0.05" 
                 value={volume}
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

const RadioIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse opacity-50"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/></svg>
);