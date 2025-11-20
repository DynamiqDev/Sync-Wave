import React from 'react';
import { RoomProvider, useRoom } from './context/RoomContext';
import { JoinCreate } from './components/JoinCreate';
import { Room } from './components/Room';

const AppContent: React.FC = () => {
  const { roomId } = useRoom();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-cyan-500/30">
       {roomId ? <Room /> : (
         <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Ambient Blobs */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-cyan-900/20 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-violet-900/20 rounded-full blur-[100px] pointer-events-none"></div>
            
            <JoinCreate />
         </div>
       )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <RoomProvider>
      <AppContent />
    </RoomProvider>
  );
};

export default App;
