import React, { useState, useEffect } from 'react';
import { Instagram, Facebook, Gift, ArrowLeft } from 'lucide-react';
import { addDoc, collection, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, APP_ID } from '@/lib/firebase';
import { useFirebaseAuth } from '@/hooks/useFirebaseAuth';
import { IG_LINK, FB_LINK } from '@/lib/constants';

const WheelGame: React.FC = () => {
  const { user } = useFirebaseAuth();
  // 🔥 Listener mirato su un solo doc settings/wheel — niente listener su orders/leads/menu.
  const [wheelSettings, setWheelSettings] = useState<any>({ active: true, gameType: 'slot', prizes: [] });
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'settings', 'wheel');
    const unsub = onSnapshot(ref, (s) => setWheelSettings((prev: any) => ({ ...prev, ...(s.data() || {}) })), (e) => console.error('[wheel]', e));
    return () => unsub();
  }, [user]);
  const isDemoMode = new URLSearchParams(window.location.search).get('mode') === 'demo';

  const [step, setStep] = useState<'name' | 'social' | 'playing' | 'result'>('name');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [socialUnlocked, setSocialUnlocked] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [slotSymbols, setSlotSymbols] = useState(['🍔', '🍕', '🍟']);
  const [hasPlayed, setHasPlayed] = useState(false);

  useEffect(() => {
    try {
      const last = localStorage.getItem('orazio_last_played');
      if (last && (Date.now() - parseInt(last)) < 7 * 24 * 60 * 60 * 1000) setHasPlayed(true);
    } catch { /* */ }
  }, []);

  const handleSocialClick = (platform: 'ig' | 'fb') => {
    window.open(platform === 'ig' ? IG_LINK : FB_LINK, '_blank');
    setSocialUnlocked(true);
  };

  const triggerWin = async () => {
    setSpinning(true);
    const prizes = (wheelSettings.prizes || []).filter((p: any) => !p.stock || p.stock > 0);
    if (prizes.length === 0) prizes.push({ name: 'Nessun premio', weight: 1 });

    const totalWeight = prizes.reduce((s: number, p: any) => s + Number(p.weight || 1), 0);
    let rand = Math.random() * totalWeight;
    let selected = prizes[0];
    for (const p of prizes) {
      if (rand < Number(p.weight || 1)) { selected = p; break; }
      rand -= Number(p.weight || 1);
    }
    const isLoss = String(selected.name).toUpperCase().includes('NESSUN') || String(selected.name).toUpperCase().includes('RIPROVA');
    const code = 'ORAZIO-' + Math.random().toString(36).substr(2, 4).toUpperCase();

    // Animate slot
    if (wheelSettings.gameType === 'slot') {
      const emojis = ['🍔', '🍕', '🍟', '🍺', '🍖', '🌭'];
      const interval = setInterval(() => {
        setSlotSymbols([emojis[Math.floor(Math.random() * 6)], emojis[Math.floor(Math.random() * 6)], emojis[Math.floor(Math.random() * 6)]]);
      }, 100);

      setTimeout(async () => {
        clearInterval(interval);
        setSpinning(false);
        setSlotSymbols(isLoss ? ['🍔', '🍕', '🍟'] : ['🎉', '🎉', '🎉']);
        const winData = { name, phone: 'SBLOCCO SOCIAL', prize: selected.name, code, timestamp: Date.now(), redeemed: false, isLoss };
        setResult(winData);
        setStep('result');
        if (!isDemoMode) {
          try { localStorage.setItem('orazio_last_played', Date.now().toString()); } catch { /* */ }
          if (!isLoss && selected.stock > 0) {
            const newPrizes = wheelSettings.prizes.map((p: any) => p.name === selected.name ? { ...p, stock: p.stock - 1 } : p);
            await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'settings', 'wheel'), { ...wheelSettings, prizes: newPrizes });
          }
          await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'leads'), winData);
        }
      }, 2500);
    } else {
      setTimeout(async () => {
        setSpinning(false);
        const winData = { name, phone: 'SBLOCCO SOCIAL', prize: selected.name, code, timestamp: Date.now(), redeemed: false, isLoss };
        setResult(winData);
        setStep('result');
        if (!isDemoMode) {
          try { localStorage.setItem('orazio_last_played', Date.now().toString()); } catch { /* */ }
          await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'leads'), winData);
        }
      }, 1500);
    }
  };

  const startGame = () => {
    if (!name.trim()) { setError('Inserisci il tuo nome!'); return; }
    setError('');
    setStep('social');
  };

  if (hasPlayed && step === 'name') {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <Gift size={64} className="text-primary mb-4" />
        <h2 className="text-2xl font-black text-foreground mb-2">HAI GIÀ GIOCATO!</h2>
        <p className="text-muted-foreground">Puoi rigiocare tra 7 giorni.</p>
        <button onClick={() => window.location.href = '/'} className="mt-6 px-8 py-3 rounded-xl bg-secondary text-foreground font-bold">TORNA AL MENU</button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col items-center justify-center p-6 overflow-hidden">
      {step === 'name' && (
        <div className="text-center space-y-6 animate-scale-in max-w-sm w-full">
          <Gift size={64} className="mx-auto text-primary" />
          <h1 className="text-3xl font-black text-foreground">GIOCA E VINCI!</h1>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Il tuo nome"
            className="w-full p-4 rounded-2xl bg-card text-foreground font-bold text-center text-lg border border-border" />
          {error && <p className="text-destructive font-bold text-sm">{error}</p>}
          <button onClick={startGame} className="w-full py-4 rounded-2xl kiosk-gradient font-black text-xl text-primary-foreground kiosk-shadow active:scale-[0.98]">
            INIZIA
          </button>
        </div>
      )}

      {step === 'social' && (
        <div className="text-center space-y-6 animate-scale-in max-w-sm w-full">
          <h2 className="text-2xl font-black text-foreground">SEGUICI SUI SOCIAL</h2>
          <p className="text-muted-foreground">Segui almeno un profilo per sbloccare il gioco!</p>
          <div className="flex gap-4 justify-center">
            <button onClick={() => handleSocialClick('ig')} className="p-6 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-500 text-white active:scale-95 transition-transform">
              <Instagram size={40} />
            </button>
            <button onClick={() => handleSocialClick('fb')} className="p-6 rounded-2xl bg-blue-600 text-white active:scale-95 transition-transform">
              <Facebook size={40} />
            </button>
          </div>
          {socialUnlocked && (
            <button onClick={() => { setStep('playing'); triggerWin(); }}
              className="w-full py-4 rounded-2xl kiosk-gradient-green font-black text-xl text-accent-foreground kiosk-shadow animate-bounce active:scale-[0.98]">
              🎰 GIOCA ORA!
            </button>
          )}
        </div>
      )}

      {step === 'playing' && (
        <div className="text-center space-y-8 animate-fade-in">
          {wheelSettings.gameType === 'slot' && (
            <div className="flex gap-4 justify-center">
              {slotSymbols.map((sym, i) => (
                <div key={i} className={`w-24 h-24 rounded-2xl bg-card flex items-center justify-center text-5xl kiosk-shadow ${spinning ? 'animate-bounce' : ''}`}>
                  {sym}
                </div>
              ))}
            </div>
          )}
          {wheelSettings.gameType !== 'slot' && (
            <div className="w-32 h-32 mx-auto rounded-full kiosk-gradient animate-spin flex items-center justify-center">
              <Gift size={48} className="text-primary-foreground" />
            </div>
          )}
          <p className="text-xl font-black text-foreground animate-pulse">ATTENDERE...</p>
        </div>
      )}

      {step === 'result' && result && (
        <div className="text-center space-y-6 animate-scale-in max-w-sm w-full">
          <div className={`text-6xl ${result.isLoss ? '' : 'animate-bounce'}`}>{result.isLoss ? '😔' : '🎉'}</div>
          <h2 className="text-3xl font-black text-foreground">{result.isLoss ? 'PECCATO!' : 'HAI VINTO!'}</h2>
          <p className="text-xl font-bold text-primary">{result.prize}</p>
          {!result.isLoss && (
            <div className="bg-card rounded-2xl p-4 border border-primary">
              <p className="text-xs text-muted-foreground">Il tuo codice:</p>
              <p className="text-2xl font-black text-primary">{result.code}</p>
              <p className="text-xs text-muted-foreground mt-2">Mostra questo codice alla cassa</p>
            </div>
          )}
          <button onClick={() => window.location.href = '/'} className="w-full py-4 rounded-2xl bg-secondary font-bold text-foreground">
            TORNA AL MENU
          </button>
        </div>
      )}
    </div>
  );
};

export default WheelGame;
