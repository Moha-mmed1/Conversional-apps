import React from 'react';
import { Mic, MicOff, Activity, AlertCircle } from 'lucide-react';
import { useLiveGemini } from './hooks/useLiveGemini';
import Visualizer from './components/Visualizer';

const App: React.FC = () => {
  const { isConnected, isError, errorMessage, volume, connect, disconnect } = useLiveGemini();

  const handleToggle = () => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100 font-sans">
      
      {/* Header */}
      <header className="absolute top-6 left-6 flex items-center gap-2 opacity-80">
        <Activity className="w-6 h-6 text-blue-400" />
        <h1 className="text-xl font-bold tracking-tight">Gemini Live</h1>
      </header>

      {/* Main Content Area */}
      <main className="flex flex-col items-center gap-12 w-full max-w-md">
        
        {/* Status Text */}
        <div className="text-center space-y-2 h-16">
          {isError ? (
             <div className="flex items-center justify-center gap-2 text-red-400 bg-red-900/20 px-4 py-2 rounded-full">
               <AlertCircle className="w-4 h-4" />
               <span className="text-sm font-medium">{errorMessage}</span>
             </div>
          ) : (
            <>
              <h2 className={`text-2xl font-light transition-opacity duration-500 ${isConnected ? 'opacity-100' : 'opacity-50'}`}>
                {isConnected ? 'Listening...' : 'Ready to chat'}
              </h2>
              {isConnected && (
                <p className="text-sm text-slate-400 animate-pulse">
                  Say something to start the conversation
                </p>
              )}
            </>
          )}
        </div>

        {/* Visualizer Container */}
        <div className="relative flex items-center justify-center w-full aspect-square max-w-[320px]">
          <div className={`absolute inset-0 bg-blue-500/10 rounded-full blur-3xl transition-opacity duration-1000 ${isConnected ? 'opacity-100' : 'opacity-0'}`} />
          <Visualizer isActive={isConnected} volume={volume} />
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center gap-6 z-10">
          <button
            onClick={handleToggle}
            className={`
              relative group flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300 shadow-2xl
              ${isConnected 
                ? 'bg-red-500 hover:bg-red-600 shadow-red-900/50' 
                : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/50'
              }
            `}
            aria-label={isConnected ? "End conversation" : "Start conversation"}
          >
             {/* Ping animation ring when inactive to encourage click */}
            {!isConnected && (
              <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-20 animate-ping" />
            )}
            
            {isConnected ? (
              <MicOff className="w-8 h-8 text-white transition-transform group-hover:scale-110" />
            ) : (
              <Mic className="w-8 h-8 text-white transition-transform group-hover:scale-110" />
            )}
          </button>
          
          <span className="text-sm font-medium text-slate-500 uppercase tracking-widest">
            {isConnected ? 'Tap to End' : 'Tap to Start'}
          </span>
        </div>

      </main>

      {/* Footer Info */}
      <footer className="absolute bottom-6 text-xs text-slate-600 text-center max-w-sm">
        <p>Powered by Gemini 2.5 Flash Native Audio.</p>
        <p className="mt-1">Ensure your environment API key has Live API access enabled.</p>
      </footer>

    </div>
  );
};

export default App;