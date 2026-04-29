import React from 'react';
import { Gift, X } from 'lucide-react';

interface PromoModalProps {
  promoItem: any;
  promoPrice: number;
  message: string;
  onAccept: () => void;
  onDecline: () => void;
}

const PromoModal: React.FC<PromoModalProps> = ({ promoItem, promoPrice, message, onAccept, onDecline }) => {
  if (!promoItem) return null;

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 uppercase select-none animate-in fade-in">
      <div className="max-w-md w-full bg-white rounded-[3rem] overflow-hidden border-b-[12px] border-amber-500 shadow-2xl relative animate-in zoom-in-95">
        
        {/* Tasto Chiudi */}
        <button 
          onClick={onDecline} 
          className="absolute top-4 right-4 bg-white/80 backdrop-blur-md text-slate-800 p-3 rounded-full hover:bg-red-100 hover:text-red-600 transition-colors z-10 active:scale-90 shadow-sm border-2 border-white"
        >
          <X size={24} strokeWidth={3} />
        </button>

        {/* Immagine o Placeholder */}
        {promoItem.imageUrl ? (
          <div className="h-56 overflow-hidden bg-slate-100 relative">
            <img src={promoItem.imageUrl} alt={promoItem.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent"></div>
          </div>
        ) : (
          <div className="h-48 bg-amber-100 flex items-center justify-center">
             <Gift size={64} className="text-amber-400" />
          </div>
        )}

        <div className="p-6 md:p-8 text-center space-y-6 -mt-12 relative z-10">
          <div className="w-24 h-24 mx-auto rounded-full bg-red-600 border-[6px] border-white shadow-xl flex items-center justify-center">
            <Gift size={40} className="text-white" />
          </div>
          
          <div>
            <h2 className="text-3xl font-black italic text-red-600 tracking-tighter leading-none mb-2">OFFERTA SPECIALE!</h2>
            <p className="text-sm font-bold text-slate-600 leading-tight">{message || 'Aggiungi questo prodotto al tuo ordine!'}</p>
          </div>
          
          <div className="bg-amber-50 rounded-[2rem] p-5 border-4 border-amber-100 shadow-inner">
            <p className="font-black text-2xl text-slate-900 italic leading-none mb-3">{promoItem.name}</p>
            <div className="flex items-end justify-center gap-4">
              <span className="text-lg font-black text-slate-400 line-through decoration-red-500 decoration-4">
                €{Number(promoItem.price).toFixed(2)}
              </span>
              <span className="text-6xl font-black text-amber-500 italic tracking-tighter leading-none drop-shadow-sm">
                €{Number(promoPrice).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex gap-4 pt-2">
            <button 
              onClick={onDecline} 
              className="flex-1 py-5 rounded-full bg-slate-100 font-black italic text-slate-500 active:scale-95 transition-transform border-2 border-slate-200 text-lg hover:bg-slate-200"
            >
              NO GRAZIE
            </button>
            <button 
              onClick={onAccept} 
              className="flex-[1.5] py-5 rounded-full bg-emerald-500 font-black italic text-white shadow-xl active:scale-95 transition-transform border-b-[6px] border-emerald-700 text-xl hover:bg-emerald-400"
            >
              SÌ, LO VOGLIO!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromoModal;
