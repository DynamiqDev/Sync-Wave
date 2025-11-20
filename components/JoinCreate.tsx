import React, { useState } from 'react';
import { useRoom } from '../context/RoomContext';
import { Radio, Users, PlayCircle } from 'lucide-react';

export const JoinCreate: React.FC = () => {
  const { createRoom, joinRoom } = useRoom();
  const [mode, setMode] = useState<'menu' | 'join' | 'create'>('menu');
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('');

  const handleCreate = () => {
    if (!name) return;
    createRoom(name);
  };

  const handleJoin = () => {
    if (!name || !roomId) return;
    joinRoom(roomId, name);
  };

  if (mode === 'menu') {
    return (
      <div className="flex flex-col gap-6 w-full max-w-md mx-auto p-8 bg-zinc-900/50 border border-zinc-800 rounded-2xl backdrop-blur-sm">
        <div className="text-center mb-4">
          <Radio className="w-16 h-16 text-cyan-500 mx-auto mb-4 animate-pulse" />
          <h1 className="text-3xl font-bold text-white tracking-tighter">SyncWAVE</h1>
          <p className="text-zinc-400 mt-2">Low-latency P2P Audio Synchronization</p>
        </div>
        
        <button 
          onClick={() => setMode('create')}
          className="group flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl font-semibold transition-all active:scale-95"
        >
          <PlayCircle className="w-6 h-6" />
          <span>Start a Frequency</span>
        </button>

        <button 
          onClick={() => setMode('join')}
          className="group flex items-center justify-center gap-3 p-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl font-semibold transition-all active:scale-95"
        >
          <Users className="w-6 h-6 text-cyan-400" />
          <span>Tune In</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto p-8 bg-zinc-900/50 border border-zinc-800 rounded-2xl backdrop-blur-sm">
       <button 
         onClick={() => setMode('menu')} 
         className="text-sm text-zinc-500 hover:text-white mb-6 flex items-center gap-2"
       >
         ← Back
       </button>

       <h2 className="text-2xl font-bold mb-6">
         {mode === 'create' ? 'Establish Frequency' : 'Tune In'}
       </h2>

       <div className="flex flex-col gap-4">
         <div>
            <label className="block text-xs uppercase font-mono text-zinc-500 mb-1">Callsign (Name)</label>
            <input 
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="DJ Name"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 focus:border-cyan-500 outline-none transition-colors"
            />
         </div>

         {mode === 'join' && (
           <div>
             <label className="block text-xs uppercase font-mono text-zinc-500 mb-1">Frequency (Room ID)</label>
             <input 
               type="text"
               value={roomId}
               onChange={(e) => setRoomId(e.target.value)}
               placeholder="ex: XC92K"
               className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 focus:border-cyan-500 outline-none transition-colors font-mono tracking-wider"
             />
           </div>
         )}

         <button 
           onClick={mode === 'create' ? handleCreate : handleJoin}
           className="mt-4 w-full p-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-colors"
         >
           {mode === 'create' ? 'Go Live' : 'Connect'}
         </button>
       </div>
    </div>
  );
};
