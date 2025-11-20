import React, { useState } from 'react';
import { useRoom } from '../context/RoomContext';
import { Track, TrackSource } from '../types';
import { Plus, Music, FileAudio, Sparkles, Search, Loader2, Play } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { generatePlaylistSuggestions } from '../services/geminiService';

export const Queue: React.FC = () => {
  const { queue, addToQueue, playTrack, isDJ, currentTrack } = useRoom();
  const [tab, setTab] = useState<'queue' | 'add'>('queue');
  
  // Add Form State
  const [ytUrl, setYtUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleAddYouTube = () => {
    // Very basic YT ID extraction
    const idMatch = ytUrl.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
    if (idMatch) {
      const track: Track = {
        id: uuidv4(),
        source: TrackSource.YOUTUBE,
        title: `YouTube Track ${idMatch[1]}`,
        artist: 'Unknown Artist',
        url: idMatch[1],
        duration: 0,
        addedBy: 'DJ',
      };
      addToQueue(track);
      setYtUrl('');
      setTab('queue');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const track: Track = {
        id: uuidv4(),
        source: TrackSource.LOCAL,
        title: file.name.replace(/\.[^/.]+$/, ""),
        artist: 'Local File',
        duration: 0,
        addedBy: 'Host',
        file: file
      };
      addToQueue(track);
      setTab('queue');
    }
  };

  const handleAiSuggest = async () => {
    if (!currentTrack) return;
    setIsGenerating(true);
    const suggestions = await generatePlaylistSuggestions(currentTrack.title, 'party upbeat sync');
    setIsGenerating(false);
    
    // Automatically add first suggestion to queue for demo
    if (suggestions.length > 0) {
      addToQueue(suggestions[0]);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col h-[500px]">
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex gap-4">
          <button 
            onClick={() => setTab('queue')}
            className={`text-sm font-bold ${tab === 'queue' ? 'text-white' : 'text-zinc-500'}`}
          >
            QUEUE ({queue.length})
          </button>
          {isDJ && (
            <button 
              onClick={() => setTab('add')}
              className={`text-sm font-bold ${tab === 'add' ? 'text-cyan-400' : 'text-zinc-500'}`}
            >
              ADD TRACKS
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {tab === 'queue' ? (
          <>
             {queue.length === 0 && (
               <div className="text-center text-zinc-600 mt-10 text-sm">
                 Queue is empty.
               </div>
             )}
             {queue.map((track, i) => {
               const isActive = currentTrack?.id === track.id;
               return (
                 <div 
                   key={track.id} 
                   onClick={() => isDJ && playTrack(track)}
                   className={`flex items-center gap-3 p-3 rounded-lg border transition-all group ${
                     isActive 
                       ? 'bg-cyan-900/20 border-cyan-500/30' 
                       : 'bg-zinc-950/50 border-zinc-800/50 hover:border-zinc-700'
                   } ${isDJ ? 'cursor-pointer hover:bg-zinc-800/50' : ''}`}
                 >
                   <div className={`text-xs font-mono w-6 ${isActive ? 'text-cyan-400' : 'text-zinc-600'}`}>
                      {isActive ? <Play size={12} className="fill-current animate-pulse"/> : i + 1}
                   </div>
                   <div className="flex-1 min-w-0">
                     <div className={`text-sm font-medium truncate ${isActive ? 'text-cyan-200' : 'text-zinc-200'}`}>
                       {track.title}
                     </div>
                     <div className="text-xs text-zinc-500 truncate">{track.artist}</div>
                   </div>
                   <div className="text-xs text-zinc-600">
                      {track.source === TrackSource.YOUTUBE ? 'YT' : 'MP3'}
                   </div>
                 </div>
               );
             })}
          </>
        ) : (
          <div className="space-y-6 animate-in fade-in">
             {/* YouTube Input */}
             <div className="space-y-2">
               <label className="text-xs font-mono text-zinc-500 uppercase">Add via YouTube URL</label>
               <div className="flex gap-2">
                 <input 
                   value={ytUrl}
                   onChange={(e) => setYtUrl(e.target.value)}
                   placeholder="https://youtube.com/..."
                   className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:border-cyan-500 outline-none"
                 />
                 <button 
                   onClick={handleAddYouTube}
                   className="bg-zinc-800 hover:bg-zinc-700 p-2 rounded-lg transition-colors"
                 >
                   <Plus className="w-5 h-5 text-white" />
                 </button>
               </div>
             </div>

             {/* Local File Input */}
             <div className="space-y-2">
               <label className="text-xs font-mono text-zinc-500 uppercase">Stream Local File (P2P)</label>
               <label className="flex items-center justify-center gap-2 w-full p-4 border-2 border-dashed border-zinc-800 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition-colors">
                  <FileAudio className="w-5 h-5 text-cyan-500" />
                  <span className="text-sm text-zinc-400">Select MP3 File</span>
                  <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
               </label>
             </div>

             {/* AI Suggestion */}
             <div className="pt-4 border-t border-zinc-800">
                <button 
                  onClick={handleAiSuggest}
                  disabled={isGenerating || !currentTrack}
                  className="w-full py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-lg font-bold text-white shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isGenerating ? <Loader2 className="animate-spin w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                  <span>AI Suggest Next Track</span>
                </button>
                <p className="text-[10px] text-zinc-500 text-center mt-2">Powered by Gemini 2.5 Flash</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};