import React, { useEffect, useState } from 'react';
import { useRoom } from '../context/RoomContext';
import { Player } from './Player';
import { Queue } from './Queue';
import { Copy, Check, Users, Wifi } from 'lucide-react';

export const Room: React.FC = () => {
  const { roomId, users, isHost, connected } = useRoom();
  const [copied, setCopied] = useState(false);

  // Wake Lock API
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch (err) {
        console.log('Wake Lock rejected', err);
      }
    };
    requestWakeLock();
    return () => {
      if (wakeLock) wakeLock.release();
    };
  }, []);

  const copyId = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col pb-8">
      {/* Header */}
      <header className="px-6 py-4 border-b border-zinc-800/50 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`} />
            <span className="font-mono font-bold text-lg tracking-widest">SyncWAVE</span>
          </div>

          <div className="flex items-center gap-2 bg-zinc-900 py-1.5 px-3 rounded-full border border-zinc-800">
             <span className="text-xs font-mono text-zinc-500">FREQ:</span>
             <span className="text-sm font-bold text-cyan-400 font-mono">{roomId}</span>
             <button onClick={copyId} className="ml-2 hover:text-white text-zinc-500">
               {copied ? <Check size={14} /> : <Copy size={14} />}
             </button>
          </div>

          <div className="flex items-center gap-2 text-sm text-zinc-400">
             <Users size={16} />
             <span>{users.length}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-6 max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Player (Takes up 2 cols on desktop) */}
        <div className="lg:col-span-2 space-y-6">
           <Player />
           
           {/* Info Box */}
           <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4 text-sm text-zinc-400">
              <h3 className="font-bold text-zinc-200 mb-2 flex items-center gap-2">
                <Wifi size={16} className="text-cyan-500" />
                Synchronization Status
              </h3>
              <p>
                {isHost 
                  ? "You are the HOST. Your playback controls the room. Streaming local audio requires this tab to stay open." 
                  : "You are a LISTENER. Playback is synchronized to the Host. Audio will auto-seek if you drift > 2s."}
              </p>
           </div>
        </div>

        {/* Right: Queue */}
        <div className="lg:col-span-1">
           <Queue />
        </div>

      </main>
    </div>
  );
};
