import React, { useState } from 'react';
import { Lock, Delete, X } from 'lucide-react';

interface PinModalProps {
  onSuccess: () => void;
  onCancel: () => void;
  correctPin?: string; // If not provided, reads from Firestore settings
}

const PinModal: React.FC<PinModalProps> = ({ onSuccess, onCancel, correctPin }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const targetPin = String(correctPin || '1234').trim();
  const hasConfiguredPin = targetPin.length >= 4;
  const isDefaultPin = targetPin === '1234';

  const handleInput = (n: string) => {
    if (!hasConfiguredPin) return;
    const next = pin + n;
    if (next.length > targetPin.length) return;
    setError(false);
    setPin(next);
    if (next.length === targetPin.length) {
      if (next === targetPin) {
        setTimeout(() => onSuccess(), 120);
        return;
      }
      setError(true);
      setTimeout(() => { setPin(''); setError(false); }, 600);
    }
  };

  const pinDots = Array.from({ length: hasConfiguredPin ? targetPin.length : 4 }, (_, i) => i);

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur flex items-center justify-center animate-fade-in">
      <div className="text-center space-y-6">
        <Lock size={48} className="mx-auto text-primary" />
        <h2 className="text-2xl font-black text-foreground">ACCESSO RISERVATO</h2>
        {isDefaultPin && (
          <p className="max-w-sm text-sm font-bold text-amber-500">
            ⚠️ PIN di default (1234) attivo. Cambialo dal pannello Sicurezza o da VITE_ADMIN_PIN.
          </p>
        )}

        {/* PIN dots */}
        <div className="flex gap-4 justify-center">
          {pinDots.map(i => (
            <div key={i} className={`w-5 h-5 rounded-full transition-all ${
              i < pin.length ? (error ? 'bg-destructive animate-shake' : 'bg-primary') : 'bg-secondary'
            }`} />
          ))}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
            <button key={n} onClick={() => handleInput(String(n))} disabled={!hasConfiguredPin}
              className="w-20 h-16 rounded-2xl bg-card text-foreground text-2xl font-black active:scale-90 transition-transform hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed">
              {n}
            </button>
          ))}
          <button onClick={onCancel} className="w-20 h-16 rounded-2xl bg-destructive/20 text-destructive flex items-center justify-center active:scale-90">
            <X size={24} />
          </button>
          <button onClick={() => handleInput('0')} disabled={!hasConfiguredPin} className="w-20 h-16 rounded-2xl bg-card text-foreground text-2xl font-black active:scale-90 transition-transform disabled:opacity-40 disabled:cursor-not-allowed">0</button>
          <button onClick={() => setPin(pin.slice(0, -1))} disabled={!hasConfiguredPin} className="w-20 h-16 rounded-2xl bg-secondary text-foreground flex items-center justify-center active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed">
            <Delete size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PinModal;
