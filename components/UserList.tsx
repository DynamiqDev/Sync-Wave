
import React, { useState } from 'react';
import { useRoom } from '../context/RoomContext';
import { X, Shield, ShieldCheck, Music2, ListMusic, SkipForward, Trash2, Check } from 'lucide-react';
import { UserPermissions } from '../types';

interface UserListProps {
  onClose: () => void;
}

export const UserList: React.FC<UserListProps> = ({ onClose }) => {
  const { users, me, isHost, kickUser, updateUserPermissions } = useRoom();
  const [editingUser, setEditingUser] = useState<string | null>(null);

  const togglePermission = (userId: string, currentPerms: UserPermissions, key: keyof UserPermissions) => {
    updateUserPermissions(userId, {
      ...currentPerms,
      [key]: !currentPerms[key]
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]">
        
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="text-cyan-500" />
            Room Members ({users.length})
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {users.map(user => {
            const isMe = user.id === me?.id;
            const isEditing = editingUser === user.id;
            const hasPerms = user.permissions.canPlay || user.permissions.canQueue || user.permissions.canSkip;

            return (
              <div key={user.id} className={`p-3 rounded-xl border ${isMe ? 'bg-cyan-950/30 border-cyan-800/50' : 'bg-zinc-950/50 border-zinc-800'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${user.isHost ? 'bg-yellow-600 text-yellow-100' : hasPerms ? 'bg-cyan-700 text-cyan-100' : 'bg-zinc-700 text-zinc-300'}`}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${isMe ? 'text-cyan-400' : 'text-white'}`}>
                          {user.name} {isMe && '(You)'}
                        </span>
                        {user.isHost && <ShieldCheck size={14} className="text-yellow-500" />}
                        {!user.isHost && hasPerms && <span className="text-[10px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded border border-cyan-500/30">DJ</span>}
                      </div>
                      <div className="text-xs text-zinc-500 font-mono">{user.id.substring(0, 6)}</div>
                    </div>
                  </div>

                  {isHost && !user.isHost && (
                    <div className="flex items-center gap-2">
                       <button 
                        onClick={() => setEditingUser(isEditing ? null : user.id)}
                        className={`p-2 rounded-lg transition-colors ${isEditing ? 'bg-cyan-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                        title="Manage Permissions"
                       >
                         <Shield size={16} />
                       </button>
                       <button 
                        onClick={() => { if(confirm(`Kick ${user.name}?`)) kickUser(user.id); }}
                        className="p-2 bg-red-900/20 text-red-500 rounded-lg hover:bg-red-900/40 transition-colors"
                        title="Kick User"
                       >
                         <Trash2 size={16} />
                       </button>
                    </div>
                  )}
                </div>

                {/* Permissions Editor */}
                {isEditing && isHost && !user.isHost && (
                  <div className="mt-3 pt-3 border-t border-zinc-800/50 grid grid-cols-3 gap-2">
                     <label className={`flex flex-col items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${user.permissions.canPlay ? 'bg-green-900/20 border-green-500/50 text-green-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}>
                        <Music2 size={18} />
                        <span className="text-[10px] font-bold uppercase">Playback</span>
                        <input 
                          type="checkbox" 
                          className="hidden"
                          checked={user.permissions.canPlay}
                          onChange={() => togglePermission(user.id, user.permissions, 'canPlay')}
                        />
                        {user.permissions.canPlay && <Check size={12} className="absolute top-1 right-1" />}
                     </label>

                     <label className={`flex flex-col items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${user.permissions.canQueue ? 'bg-blue-900/20 border-blue-500/50 text-blue-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}>
                        <ListMusic size={18} />
                        <span className="text-[10px] font-bold uppercase">Queue</span>
                        <input 
                          type="checkbox" 
                          className="hidden"
                          checked={user.permissions.canQueue}
                          onChange={() => togglePermission(user.id, user.permissions, 'canQueue')}
                        />
                     </label>

                     <label className={`flex flex-col items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${user.permissions.canSkip ? 'bg-purple-900/20 border-purple-500/50 text-purple-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}>
                        <SkipForward size={18} />
                        <span className="text-[10px] font-bold uppercase">Skip</span>
                        <input 
                          type="checkbox" 
                          className="hidden"
                          checked={user.permissions.canSkip}
                          onChange={() => togglePermission(user.id, user.permissions, 'canSkip')}
                        />
                     </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
