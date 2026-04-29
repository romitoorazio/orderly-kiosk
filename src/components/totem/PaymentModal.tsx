import React, { useEffect, useState } from 'react';
import { X, CreditCard, Banknote, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

interface PaymentModalProps {
  step: string | null;
  total: number;
  errorDetail: string;
  onSelectMethod: (method: 'cash' | 'card') => void;
  onCancel: () => void;
  onCancelPolling: () => void;
  isBackendOffline?: boolean;
  // 🧪 [POS TEST] info diagnostiche
  checkoutId?: string | null;
  pollAttempts?: number;
  lastStatus?: string | null;
  pollStartedAt?: number | null;
  // 🆕 Switch a contanti durante processing
  onSwitchToCash?: () => void;
}

type StatusKind = 'pending' | 'success' | 'failed' | 'cancelled';

const statusFromLast = (last?: string | null): StatusKind => {
  const s = String(last || '').toUpperCase();
  if (s === 'SUCCESS' || s === 'SUCCESSFUL' || s === 'PAID' || s === 'CAPTURED') return 'success';
  if (s === 'FAILED' || s === 'DECLINED') return 'failed';
  if (s === 'CANCELLED' || s === 'CANCELED') return 'cancelled';
  return 'pending';
};

const STATUS_META: Record<StatusKind, { emoji: string; label: string; bg: string; text: string; border: string }> = {
  pending:   { emoji: '🟡', label: 'IN ATTESA SUL POS...',  bg: 'bg-amber-50',    text: 'text-amber-700',    border: 'border-amber-300' },
  success:   { emoji: '🟢', label: 'PAGAMENTO COMPLETATO', bg: 'bg-emerald-50',  text: 'text-emerald-700',  border: 'border-emerald-300' },
  failed:    { emoji: '🔴', label: 'PAGAMENTO FALLITO',    bg: 'bg-red-50',      text: 'text-red-700',      border: 'border-red-300' },
  cancelled: { emoji: '⚠️', label: 'ANNULLATO',            bg: 'bg-slate-100',   text: 'text-slate-700',    border: 'border-slate-300' },
};

const PaymentModal: React.FC<PaymentModalProps> = ({
  step, total, errorDetail, onSelectMethod, onCancel, onCancelPolling, isBackendOffline,
  checkoutId, pollAttempts = 0, lastStatus, pollStartedAt, onSwitchToCash
}) => {
  const [, force] = useState(0);
  useEffect(() => {
    if (step !== 'processing') return;
    const t = setInterval(() => force(x => x + 1), 1000);
    return () => clearInterval(t);
  }, [step]);

  if (!step) return null;

  const elapsedSec = pollStartedAt ? Math.floor((Date.now() - pollStartedAt) / 1000) : 0;
  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
  const ss = String(elapsedSec % 60).padStart(2, '0');
  const kind = statusFromLast(lastStatus);
  const meta = STATUS_META[kind];

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-950/95 backdrop-blur-sm flex items-center justify-center animate-in fade-in uppercase p-4">
      <div className="max-w-lg w-full mx-auto bg-white rounded-[3rem] p-6 md:p-8 border-b-[15px] border-emerald-500 shadow-2xl relative animate-in zoom-in-95">
        
        {step === 'selection' && (
          <div className="space-y-4">
            <button onClick={onCancel} className="absolute top-6 right-6 text-slate-400 hover:text-red-600 hover:bg-slate-100 p-2 rounded-full transition-colors z-10">
              <X size={28} />
            </button>
            <h2 className="text-3xl font-black text-slate-900 text-center mb-4 italic tracking-tighter mt-4 uppercase">
              COME VUOI PAGARE?
            </h2>
            <p className="text-center text-4xl font-black text-red-600 mb-8 italic uppercase">
              €{total.toFixed(2)}
            </p>

            <button
              onClick={() => onSelectMethod('card')}
              className="w-full p-6 rounded-3xl bg-white border-4 border-emerald-500 hover:bg-emerald-50 transition-all flex items-center gap-6 active:scale-95 shadow-lg group uppercase"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <CreditCard size={32} className="text-white" />
              </div>
              <div className="text-left uppercase">
                <p className="text-2xl font-black text-slate-900 italic leading-none uppercase">CARTA / POS</p>
                <p className="text-sm font-bold text-slate-500 mt-1 uppercase">Paga subito in autonomia</p>
              </div>
            </button>

            <button
              onClick={() => onSelectMethod('cash')}
              className="w-full p-6 rounded-3xl bg-slate-50 border-4 border-slate-200 hover:bg-slate-100 transition-all flex items-center gap-6 active:scale-95 shadow-md group mt-4 uppercase"
            >
              <div className="w-16 h-16 rounded-2xl bg-slate-200 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <Banknote size={32} className="text-slate-600" />
              </div>
              <div className="text-left uppercase">
                <p className="text-2xl font-black text-slate-900 italic leading-none uppercase">CONTANTI</p>
                <p className="text-sm font-bold text-slate-500 mt-1 uppercase">Paga in cassa al ritiro</p>
              </div>
            </button>
          </div>
        )}

        {step === 'processing' && (
          <div className="text-center space-y-5 py-4 uppercase">
            {/* Icona POS animata */}
            <div className="relative w-24 h-24 mx-auto">
              <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-60" />
              <div className="relative w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center shadow-xl">
                {kind === 'success'
                  ? <CheckCircle2 size={56} className="text-white" />
                  : kind === 'failed'
                    ? <X size={56} className="text-white" />
                    : <Loader2 size={56} className="text-white animate-spin" />}
              </div>
            </div>

            <h2 className="text-3xl md:text-4xl font-black text-slate-900 italic tracking-tighter uppercase leading-tight">
              INSERIRE CARTA SUL POS
            </h2>
            <p className="text-base font-bold text-slate-500 uppercase">SEGUI LE ISTRUZIONI SUL TERMINALE</p>

            {/* Badge status semaforo */}
            <div className={`mx-auto inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 ${meta.bg} ${meta.text} ${meta.border} font-black text-sm`}>
              <span className="text-base leading-none">{meta.emoji}</span>
              <span>{meta.label}</span>
            </div>

            {/* Importo */}
            <p className="text-3xl font-black text-red-600 italic uppercase">€{total.toFixed(2)}</p>

            {/* Hint timeout intelligente */}
            {elapsedSec >= 25 && elapsedSec < 45 && (
              <div className="mx-auto max-w-sm bg-amber-50 border-2 border-amber-200 rounded-2xl p-3 text-amber-800 text-xs font-bold normal-case">
                💡 Se il cliente non paga, usa <strong>ANNULLA</strong> o <strong>CONTANTI</strong>.
              </div>
            )}
            {elapsedSec >= 45 && (
              <div className="mx-auto max-w-sm bg-amber-100 border-2 border-amber-400 rounded-2xl p-3 text-amber-900 text-sm font-black flex items-center gap-2 justify-center">
                <AlertTriangle size={18} />
                <span className="normal-case">Attesa lunga: meglio annullare o passare ai contanti.</span>
              </div>
            )}

            {/* 🧪 [POS TEST] Pannello diagnostico */}
            <div className="mt-2 mx-auto max-w-sm bg-slate-50 border-2 border-slate-200 rounded-2xl p-3 text-left normal-case">
              <p className="text-[11px] font-mono text-slate-500 uppercase font-black mb-1">[POS TEST]</p>
              <p className="text-xs font-mono text-slate-700 break-all">
                <strong>Checkout:</strong> {checkoutId || '—'}
              </p>
              <p className="text-xs font-mono text-slate-700">
                <strong>Status:</strong> {lastStatus || 'PENDING'}
              </p>
              <p className="text-xs font-mono text-slate-700">
                <strong>Polling:</strong> {pollAttempts}/60
              </p>
              <p className="text-xs font-mono text-slate-700">
                <strong>Tempo:</strong> {mm}:{ss}
              </p>
            </div>

            {/* Pulsanti azione: ANNULLA + CONTANTI */}
            <div className="space-y-3 pt-2">
              <button
                onClick={onCancelPolling}
                className="w-full px-8 py-5 rounded-full bg-red-600 text-white font-black italic text-2xl active:scale-95 transition-transform border-b-8 border-red-800 shadow-xl uppercase"
              >
                ANNULLA PAGAMENTO
              </button>
              {onSwitchToCash && (
                <button
                  onClick={onSwitchToCash}
                  className="w-full px-8 py-4 rounded-full bg-slate-100 text-slate-800 font-black italic text-xl active:scale-95 transition-transform border-4 border-slate-300 uppercase flex items-center justify-center gap-3"
                >
                  <Banknote size={24} />
                  PAGA IN CONTANTI
                </button>
              )}
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className="text-center space-y-6 py-8 uppercase">
            <div className="w-24 h-24 mx-auto rounded-full bg-red-100 border-4 border-red-200 flex items-center justify-center mb-6 uppercase">
              <X size={50} className="text-red-600" />
            </div>
            <h2 className="text-3xl font-black text-red-600 italic tracking-tighter uppercase">PAGAMENTO FALLITO</h2>
            <p className="text-lg font-bold text-slate-600 px-4 uppercase">{errorDetail || 'Si è verificato un errore.'}</p>

            {/* 🧪 [POS TEST] Pannello diagnostico errore */}
            {(checkoutId || lastStatus) && (
              <div className="mx-auto max-w-sm bg-slate-50 border-2 border-slate-200 rounded-2xl p-3 text-left normal-case">
                <p className="text-[11px] font-mono text-slate-500 uppercase font-black mb-1">[POS TEST]</p>
                {checkoutId && (
                  <p className="text-xs font-mono text-slate-700 break-all"><strong>Checkout:</strong> {checkoutId}</p>
                )}
                {lastStatus && (
                  <p className="text-xs font-mono text-slate-700"><strong>Ultimo status:</strong> {lastStatus}</p>
                )}
                <p className="text-xs font-mono text-slate-700"><strong>Tentativi:</strong> {pollAttempts}</p>
              </div>
            )}

            <div className="space-y-3">
              <button onClick={onCancel} className="px-8 py-4 w-full rounded-full bg-slate-800 text-white font-black italic text-2xl active:scale-95 transition-transform border-b-8 border-slate-900 shadow-xl uppercase">
                RIPROVA
              </button>
              {onSwitchToCash && (
                <button
                  onClick={onSwitchToCash}
                  className="w-full px-8 py-4 rounded-full bg-slate-100 text-slate-800 font-black italic text-xl active:scale-95 transition-transform border-4 border-slate-300 uppercase flex items-center justify-center gap-3"
                >
                  <Banknote size={24} />
                  PAGA IN CONTANTI
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentModal;
