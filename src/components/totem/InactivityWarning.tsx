import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface InactivityWarningProps {
  countdown: number;
  onDismiss: () => void;
}

const InactivityWarning: React.FC<InactivityWarningProps> = ({ countdown, onDismiss }) => {
  return (
    // ⚠️ NIENTE onClick sul background: il countdown si annulla SOLO con il bottone esplicito.
    <div className="fixed inset-0 z-[100] bg-background/90 backdrop-blur flex items-center justify-center animate-fade-in">
      <div className="text-center animate-scale-in">
        <AlertTriangle size={64} className="mx-auto text-primary mb-6" />
        <h2 className="text-3xl font-black text-foreground mb-4">SEI ANCORA LÌ?</h2>
        <p className="text-lg text-muted-foreground mb-6">L'ordine verrà annullato tra</p>
        <div className="text-7xl font-black text-primary mb-8">{countdown}</div>
        <button
          onClick={onDismiss}
          className="px-12 py-4 rounded-2xl kiosk-gradient font-black text-xl text-primary-foreground kiosk-shadow active:scale-95"
        >
          SÌ, CONTINUO!
        </button>
      </div>
    </div>
  );
};

export default InactivityWarning;
