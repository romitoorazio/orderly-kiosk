import React from 'react';
import { WifiOff, AlertTriangle } from 'lucide-react';
import { useOffline } from '@/hooks/useOffline';

interface OfflineBannerProps {
  /** 'totem' blocks entirely, 'banner' shows a non-blocking warning */
  mode: 'totem' | 'banner';
  backendUrl?: string;
}

const OfflineBanner: React.FC<OfflineBannerProps> = ({ mode, backendUrl }) => {
  const { isOffline, status } = useOffline(backendUrl);

  if (!isOffline) return null;

  if (mode === 'totem') {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center uppercase z-[99999] fixed inset-0">
        <WifiOff size={80} className="text-red-500 mb-6 animate-pulse" />
        <h1 className="text-4xl md:text-6xl font-black italic text-white mb-4 tracking-tighter">TOTEM OFFLINE</h1>
        <p className="text-lg md:text-xl font-bold text-slate-400 mb-8">
          {status === 'degraded'
            ? 'La rete è presente ma i servizi non rispondono.'
            : 'La connessione di rete è assente.'}
        </p>
        <div className="bg-red-600 text-white p-6 md:p-8 rounded-3xl border-4 border-red-800 shadow-2xl">
          <p className="text-2xl md:text-4xl font-black italic tracking-widest">SI PREGA DI ORDINARE IN CASSA</p>
        </div>
      </div>
    );
  }

  // Banner mode for cassa/cucina
  const isDegraded = status === 'degraded';
  return (
    <div className={`${isDegraded ? 'bg-amber-500/10 border-amber-500' : 'bg-destructive/10 border-destructive'} border-b-2 px-4 py-2 flex items-center justify-center gap-3 z-[9999] relative`}>
      {isDegraded
        ? <AlertTriangle size={18} className="text-amber-500 animate-pulse flex-shrink-0" />
        : <WifiOff size={18} className="text-destructive animate-pulse flex-shrink-0" />
      }
      <span className={`${isDegraded ? 'text-amber-600' : 'text-destructive'} font-bold text-sm`}>
        {isDegraded
          ? 'SERVIZI NON RAGGIUNGIBILI — Rete presente ma Firebase non risponde'
          : 'CONNESSIONE ASSENTE — I dati potrebbero non essere aggiornati'}
      </span>
      <div className={`w-2 h-2 rounded-full ${isDegraded ? 'bg-amber-500' : 'bg-destructive'} animate-pulse flex-shrink-0`} />
    </div>
  );
};

export default OfflineBanner;
