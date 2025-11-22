
import React, { useEffect, useState } from 'react';
import { useRoom } from '../context/RoomContext';
import { Player } from './Player';
import { Queue } from './Queue';
import { UserList } from './UserList';
import { Copy, Check, Users, Wifi, Shield } from 'lucide-react';

export const Room: React.FC = () => {
  const { roomId, users, isHost, connected, me } = useRoom();
  const [copied, setCopied] = useState(false);
  const [showUserList, setShowUserList] = useState(false);

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
      <header className="px-6 py-4 border-b border-zinc-800/50 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`} />
            <span className="font-mono font-bold text-lg tracking-widest hidden sm:block">SyncWAVE</span>
          </div>

          <div className="flex items-center gap-2 bg-zinc-900 py-1.5 px-3 rounded-full border border-zinc-800">
             <span className="text-xs font-mono text-zinc-500">FREQ:</span>
             <span className="text-sm font-bold text-cyan-400 font-mono">{roomId}</span>
             <button onClick={copyId} className="ml-2 hover:text-white text-zinc-500">
               {copied ? <Check size={14} /> : <Copy size={14} />}
             </button>
          </div>

          <button 
            onClick={() => setShowUserList(true)}
            className="flex items-center gap-2 text-sm bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-full transition-colors border border-zinc-700"
          >
             <Users size={16} className="text-zinc-400" />
             <span className="font-bold text-white">{users.length}</span>
             {isHost && <Shield size={14} className="text-yellow-500 ml-1" />}
          </button>
        </div>
      </header>

      {/* User List Modal */}
      {showUserList && <UserList onClose={() => setShowUserList(false)} />}

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-6 max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Player (Takes up 2 cols on desktop) */}
        <div className="lg:col-span-2 space-y-6">
           <Player />
           
           {/* Info Box */}
           <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4 text-sm text-zinc-400">
              <h3 className="font-bold text-zinc-200 mb-2 flex items-center gap-2">
                <Wifi size={16} className="text-cyan-500" />
                Connection Status
              </h3>
              <p className="mb-2">
                {isHost 
                  ? "You are the HOST (Admin). You can kick users and assign DJ permissions via the User List." 
                  : "You are connected. Permissions are managed by the Host."}
              </p>
              {me && (
                <div className="flex gap-2 mt-2">
                   {me.permissions.canPlay && <span className="text-[10px] bg-green-900/30 text-green-400 px-2 py-0.5 rounded border border-green-900/50">PLAYBACK</span>}
                   {me.permissions.canQueue && <span className="text-[10px] bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded border border-blue-900/50">QUEUE</span>}
                   {me.permissions.canSkip && <span className="text-[10px] bg-purple-900/30 text-purple-400 px-2 py-0.5 rounded border border-purple-900/50">SKIP</span>}
                </div>
              )}
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
