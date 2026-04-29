import React, { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Plus, Minus, Layers, Info, X, Check } from "lucide-react";

interface CustomizerModalProps {
  item: any;
  ingredients: any[];
  initialSelected: string[];
  initialFormatName?: string | null;
  initialContorniNames?: string[];
  initialCottura?: string;
  contorni: any[];
  onCancel: () => void;
  onConfirm: (
    selectedIds: string[],
    extraPrice: number,
    selectedFormat: any | null,
    selectedContorni: any[],
    cottura: string | undefined
  ) => void;
}

const CustomizerModal: React.FC<CustomizerModalProps> = ({
  item,
  ingredients,
  initialSelected,
  initialFormatName,
  initialContorniNames,
  initialCottura,
  contorni,
  onCancel,
  onConfirm,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    (initialSelected || []).map(id => String(id))
  );
  
  const [cottura, setCottura] = useState<string | undefined>(
    initialCottura || (item?.requiresCottura ? "Media" : undefined)
  );
  const [selectedFormat, setSelectedFormat] = useState<any | null>(null);
  const [selectedContorni, setSelectedContorni] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'carni' | 'condimenti' | 'piatto'>('carni');
  const [infoModalItem, setInfoModalItem] = useState<any>(null);

  useEffect(() => {
    if (item?.formats?.length > 0) {
      const found = item.formats.find((f: any) => f.name === initialFormatName) || item.formats[0];
      setSelectedFormat(found);
    }
    if (contorni?.length > 0 && initialContorniNames && initialContorniNames.length > 0) {
      const found = contorni.filter((c: any) => initialContorniNames.includes(c.name));
      setSelectedContorni(found);
    }
  }, [item, initialFormatName, initialContorniNames, contorni]);

  const ingSort = (a: any, b: any) =>
    (a.sortOrder || 0) - (b.sortOrder || 0) || String(a.name || '').localeCompare(String(b.name || ''));
  const carniPool = ingredients
    .filter(ing => ing.category?.toUpperCase().includes('CARN') || ing.category?.toUpperCase().includes('SALUM'))
    .sort(ingSort);
  const condimentiPool = ingredients
    .filter(ing => !ing.category?.toUpperCase().includes('CARN') && !ing.category?.toUpperCase().includes('SALUM'))
    .sort(ingSort);

  const ingredientCounts = useMemo(() => {
    return selectedIds.reduce((acc, id) => {
      acc[id] = (acc[id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [selectedIds]);

  const addItem = (rawId: string | number) => {
    setSelectedIds(prev => [...prev, String(rawId)]);
  };

  const removeItem = (rawId: string | number) => {
    const id = String(rawId);
    setSelectedIds(prev => {
      const idx = prev.lastIndexOf(id);
      if (idx > -1) {
        const copy = [...prev];
        copy.splice(idx, 1);
        return copy;
      }
      return prev;
    });
  };

  const extraPrice = useMemo(() => {
    let extra = 0;
    const defaultCounts: Record<string, number> = {};
    (item.defaultIngredients || []).forEach((id: any) => {
      const sId = String(id);
      defaultCounts[sId] = (defaultCounts[sId] || 0) + 1;
    });

    Object.keys(ingredientCounts).forEach(id => {
      const extraQty = ingredientCounts[id] - (defaultCounts[id] || 0);
      if (extraQty > 0) {
        const ing = ingredients.find(i => String(i.id) === id);
        if (ing) {
          extra += (Number(ing.price || ing.extraPrice) || 0) * extraQty;
        }
      }
    });
    
    if (selectedFormat) extra += (Number(selectedFormat.extraPrice) || 0);
    selectedContorni.forEach(c => extra += (Number(c.price) || 0));
    return extra;
  }, [ingredientCounts, item.defaultIngredients, ingredients, selectedFormat, selectedContorni]);

  const currentTotal = Number(item.price) + extraPrice;

  const renderIngredientCard = (ing: any) => {
    const strId = String(ing.id);
    const count = ingredientCounts[strId] || 0;
    const isDefault = (item.defaultIngredients || []).map(String).includes(strId);
    const isAvailable = ing.available !== false;

    return (
      <div 
        key={strId} 
        // FIX: Rimosso "count === 0" così ogni click sulla foto/card intera aggiunge sempre un ingrediente
        onClick={() => isAvailable && addItem(strId)} 
        className={`rounded-2xl border-4 p-3 text-center transition-all relative flex flex-col ${!isAvailable ? 'opacity-40 grayscale cursor-not-allowed' : 'cursor-pointer'} ${count > 0 ? 'border-amber-500 bg-amber-50 shadow-md scale-[1.02]' : 'border-slate-200 bg-white hover:border-amber-300'}`}
      >
        <div className="flex-1 relative">
          {isDefault && (
            <span className="absolute -top-2 -left-2 bg-slate-800 text-white text-[9px] font-black px-2 py-1 rounded-md z-30 shadow-md uppercase">
              DI BASE
            </span>
          )}
          
          <div className="aspect-square bg-slate-100 rounded-xl mb-3 overflow-hidden relative border-2 border-slate-50">
            {ing.imageUrl ? <img src={ing.imageUrl} className="w-full h-full object-cover pointer-events-none" /> : <Layers className="m-auto mt-4 text-slate-300" size={32} />}
            
            {count > 1 && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10 animate-in zoom-in-50">
                <span className="text-white text-5xl font-black italic drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">
                  {count}X
                </span>
              </div>
            )}

            <button 
              onClick={(e) => { e.stopPropagation(); setInfoModalItem(ing); }} 
              className="absolute top-2 right-2 bg-blue-600/90 text-white p-2 rounded-xl shadow-md border-2 border-blue-400 hover:bg-blue-500 active:scale-90 transition-all z-20 flex items-center gap-1"
            >
              <Info size={16} strokeWidth={3} />
              <span className="font-black text-[10px] tracking-wider hidden sm:block">INFO</span>
            </button>
          </div>
          
          <div className="p-1 flex flex-col items-center">
            <span className="font-black italic text-slate-800 tracking-tighter leading-tight line-clamp-2" style={{ fontSize: 'clamp(12px, 1.5vw, 16px)' }}>{ing.name}</span>
            {Number(ing.price || ing.extraPrice) > 0 && <p className="font-black text-red-600 mt-1 italic leading-none text-sm">+ €{Number(ing.price || ing.extraPrice).toFixed(2)}</p>}
          </div>
        </div>
        
        <div className="mt-3 pt-3 border-t-2 border-slate-200/50 flex items-center justify-center gap-3 w-full h-12">
          {count > 0 ? (
            <>
              <button onClick={(e) => { e.stopPropagation(); removeItem(strId); }} className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center active:scale-90 shadow-sm border border-red-200 hover:bg-red-200 transition-colors z-10 shrink-0">
                <Minus size={20} strokeWidth={3}/>
              </button>
              <span className="font-black text-2xl w-8 text-center text-slate-900 shrink-0">{count}</span>
              <button onClick={(e) => { e.stopPropagation(); addItem(strId); }} className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center active:scale-90 shadow-sm border border-emerald-200 hover:bg-emerald-200 transition-colors z-10 shrink-0">
                <Plus size={20} strokeWidth={3}/>
              </button>
            </>
          ) : (
            <button className="w-full h-10 rounded-full bg-slate-100 text-slate-600 font-black text-xs flex items-center justify-center gap-1 active:scale-95 shadow-sm border border-slate-300 hover:bg-slate-200 transition-colors z-10">
              <Plus size={16} strokeWidth={3}/> AGGIUNGI
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#fdfbf7] uppercase animate-in slide-in-from-right overflow-hidden w-full relative z-10">
      
      {/* HEADER ROSSO ALLA ORAZIO */}
      <div className="bg-red-600 text-white p-4 md:p-6 flex justify-between items-center border-b-4 border-amber-500 shrink-0 shadow-md">
        <div className="flex items-center gap-4">
          <button onClick={onCancel} className="bg-white/20 p-3 rounded-full active:scale-90 transition-transform hover:bg-white/30">
            <ArrowLeft size={28} />
          </button>
          <h2 className="text-3xl md:text-5xl font-black italic tracking-tighter drop-shadow-md truncate max-w-[250px] md:max-w-[500px]">
            {item.name}
          </h2>
        </div>
        {!item.isBaseProduct && (
          <div className="text-right">
            <p className="text-xs font-black text-red-200 mb-1 tracking-widest leading-none">PREZZO</p>
            <p className="text-3xl md:text-4xl font-black text-amber-400 italic leading-none">€ {currentTotal.toFixed(2)}</p>
          </div>
        )}
      </div>

      {/* BARRA COTTURA / FORMATI */}
      <div className="flex flex-wrap gap-6 items-center p-4 md:p-6 bg-slate-100 border-b-2 border-slate-200 shrink-0 shadow-inner">
        {item.requiresCottura && (
          <div className="space-y-1">
            <h3 className="text-[10px] font-black text-slate-500 tracking-widest uppercase">COTTURA</h3>
            <div className="flex gap-2">
              {["Media", "Ben Cotta", "Al Sangue"].map((c) => (
                <button key={c} onClick={() => setCottura(c)} className={`px-4 py-2 rounded-xl font-black text-xs border-2 transition-all ${cottura === c ? 'border-amber-500 bg-amber-100 text-amber-700 shadow-md' : 'border-slate-300 bg-white text-slate-500 hover:border-amber-200'}`}>{c}</button>
              ))}
            </div>
          </div>
        )}
        {item.formats?.length > 0 && (
          <div className="space-y-1">
            <h3 className="text-[10px] font-black text-slate-500 tracking-widest uppercase">FORMATO</h3>
            <div className="flex gap-2">
              {item.formats.map((f: any) => (
                <button key={f.name} onClick={() => setSelectedFormat(f)} className={`px-4 py-2 rounded-xl font-black text-xs border-2 transition-all ${selectedFormat?.name === f.name ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md' : 'border-slate-300 bg-white text-slate-500 hover:border-blue-200'}`}>{f.name}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* TABS MOBILE */}
      <div className="flex bg-white shadow-md z-10 shrink-0 border-b-2 border-slate-200 lg:hidden">
        <button onClick={() => setActiveTab('carni')} className={`flex-1 p-4 font-black text-xs ${activeTab === 'carni' ? 'bg-red-50 text-red-600 border-b-4 border-red-600' : 'text-slate-400 hover:bg-slate-50'}`}>🥩 CARNI</button>
        <button onClick={() => setActiveTab('condimenti')} className={`flex-1 p-4 font-black text-xs ${activeTab === 'condimenti' ? 'bg-amber-50 text-amber-600 border-b-4 border-amber-500' : 'text-slate-400 hover:bg-slate-50'}`}>🧀 CONDIMENTI</button>
        {contorni?.length > 0 && <button onClick={() => setActiveTab('piatto')} className={`flex-1 p-4 font-black text-xs ${activeTab === 'piatto' ? 'bg-emerald-50 text-emerald-600 border-b-4 border-emerald-600' : 'text-slate-400 hover:bg-slate-50'}`}>🍟 CONTORNI</button>}
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-[#fdfbf7]">
        <div className={`w-full lg:w-1/2 lg:border-r-4 lg:border-slate-200 overflow-y-auto pb-40 ${activeTab === 'carni' ? 'block' : 'hidden lg:block'}`}>
          <div className="hidden lg:block sticky top-0 bg-white p-4 border-b-4 border-red-600 z-10 text-center font-black italic text-xl text-red-600 shadow-sm uppercase">1. CARNI E SALUMI</div>
          <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {carniPool.map(renderIngredientCard)}
          </div>
        </div>

        <div className={`w-full lg:w-1/2 overflow-y-auto pb-40 ${activeTab !== 'carni' ? 'block' : 'hidden lg:block'}`}>
          <div className="hidden lg:block sticky top-0 bg-[#fdfbf7] p-4 border-b-4 border-amber-500 z-10 text-center font-black italic text-xl text-red-600 shadow-sm uppercase">2. CONDIMENTI E SALSE</div>
          <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {condimentiPool.map(renderIngredientCard)}
          </div>
        </div>
      </div>

      {/* FOOTER CONFERMA */}
      <div className="p-4 md:p-6 bg-white border-t-4 border-slate-200 flex items-center justify-center gap-6 shadow-[0_-10px_25px_rgba(0,0,0,0.1)] z-50 shrink-0">
        <button onClick={onCancel} className="text-slate-400 font-black text-sm md:text-xl uppercase tracking-widest hover:text-slate-600 transition-colors">ANNULLA</button>
        <button 
          onClick={() => onConfirm(selectedIds, extraPrice, selectedFormat, selectedContorni, cottura)} 
          disabled={item.requiresCottura && !cottura}
          className={`px-8 md:px-16 py-5 md:py-6 rounded-full font-black text-xl md:text-3xl italic active:scale-95 shadow-2xl transition-all uppercase tracking-tighter flex items-center gap-3 ${item.requiresCottura && !cottura ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-500'}`}
        >
          {item.requiresCottura && !cottura ? "DEVI SELEZIONARE LA COTTURA" : "CONFERMA E AGGIUNGI"} 
          {(!item.requiresCottura || cottura) && <Check size={32} strokeWidth={4} />}
        </button>
      </div>

      {/* POPUP INFO INGREDIENTE MIGLIORATO */}
      {infoModalItem && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[2000] flex items-center justify-center p-6 uppercase" onClick={() => setInfoModalItem(null)}>
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 border-b-[15px] border-blue-500 shadow-2xl text-center relative animate-in zoom-in-90" onClick={e => e.stopPropagation()}>
            <button onClick={() => setInfoModalItem(null)} className="absolute top-6 right-6 bg-slate-100 p-2 rounded-full text-slate-500 hover:text-red-600 transition-colors">
              <X size={24} />
            </button>
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-blue-200">
               <Info size={40} className="text-blue-600" />
            </div>
            <h2 className="text-3xl font-black italic mb-4 text-slate-900 leading-tight tracking-tighter">{infoModalItem.name}</h2>
            {infoModalItem.description ? (
              <p className="text-lg font-bold text-slate-600 mb-6 leading-tight lowercase first-letter:uppercase">
                {infoModalItem.description}
              </p>
            ) : (
              <p className="text-lg font-bold text-slate-400 mb-6 italic leading-tight">
                Nessuna descrizione disponibile per questo ingrediente.
              </p>
            )}
            <div className="bg-blue-50 p-6 rounded-2xl border-4 border-blue-100 text-left">
              <p className="text-blue-800 font-black mb-2 text-sm tracking-widest">DETTAGLI / ALLERGENI</p>
              <p className="text-blue-900 font-medium text-sm leading-snug lowercase first-letter:uppercase">
                {infoModalItem.ingredients || infoModalItem.allergens || "Per informazioni dettagliate su allergeni e origine, rivolgersi al personale di sala."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomizerModal;
