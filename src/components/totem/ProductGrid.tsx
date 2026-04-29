import React from 'react';
import { Plus, Info, Edit3, Utensils } from 'lucide-react';
import type { MenuItem } from '@/lib/constants';

interface ProductGridProps {
  items: MenuItem[];
  ingredientsAvailable?: boolean;
  onAddToCart: (item: MenuItem) => void;
  onCustomize: (item: MenuItem) => void;
  onInfo: (item: MenuItem) => void;
}

const ProductGrid: React.FC<ProductGridProps> = ({ items, ingredientsAvailable = false, onAddToCart, onCustomize, onInfo }) => {
  const available = items.filter(i => i.available !== false).sort((a, b) => (a.sortOrder || 99) - (b.sortOrder || 99));

  if (available.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-lg font-medium p-8">
        Nessun prodotto in questa categoria
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 p-3 md:p-6 overflow-y-auto kiosk-scrollbar flex-1 pb-40">
      {available.map(item => {
        const hasDefaults = (item.defaultIngredients || []).length > 0;
        const isBase = item.isBaseProduct || false;
        
        return (
          <div key={item.id} className="bg-card rounded-[2rem] shadow-xl border-b-4 border-border flex flex-col overflow-hidden">
            {/* Product image */}
            <div 
              className="relative h-28 md:h-32 bg-secondary overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
              onClick={() => {
                if (isBase || hasDefaults) {
                  onCustomize(item);
                } else {
                  onAddToCart(item);
                }
              }}
            >
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.name}
                className="w-full h-full object-cover transition-transform duration-300"
                loading="eager"
                decoding="async"
                onError={(e) => {
                  console.warn('[IMG ERROR]', item.imageUrl);
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                <Utensils size={40} />
              </div>
            )}
            {item.description && (
              <button
                onClick={(e) => { e.stopPropagation(); onInfo(item); }}
                className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white px-2.5 py-1 rounded-full font-black text-[10px] tracking-widest flex items-center gap-1 z-10"
              >
                <Info size={12} /> INFO
              </button>
            )}
            </div>

            {/* Product info */}
            <div className="p-3 md:p-4 flex-1 flex flex-col gap-2">
              <h3 className="font-black italic text-base md:text-lg leading-tight text-center text-foreground">
                {item.name}
              </h3>
              
              <div className="flex flex-col gap-2 mt-auto pt-3 border-t border-border/50">
                <span className="font-black text-xl md:text-2xl italic text-primary text-center leading-none">
                  €{Number(item.price).toFixed(2)}
                </span>
                
                {isBase ? (
                  <button 
                    onClick={(e) => { e.preventDefault(); onCustomize(item); }}
                    className="w-full text-white py-2.5 rounded-full font-black italic text-sm uppercase shadow-md active:scale-95 bg-indigo-500"
                  >
                    CREA ORA
                  </button>
                ) : hasDefaults ? (
                  <div className="flex gap-2 w-full">
                    <button 
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAddToCart(item); }}
                      className="flex-[4] py-2.5 rounded-2xl font-black italic text-sm uppercase flex items-center justify-center gap-1.5 active:scale-95 bg-accent/20 text-accent-foreground"
                    >
                      <Plus size={18} /> AGGIUNGI
                    </button>
                    <button 
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCustomize(item); }}
                      className="flex-[1] py-2.5 rounded-2xl flex items-center justify-center active:scale-95 bg-kiosk-orange text-white"
                    >
                      <Edit3 size={18} />
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAddToCart(item); }}
                    className="w-full py-2.5 rounded-2xl font-black italic text-sm uppercase shadow-sm flex items-center justify-center gap-1.5 active:scale-95 bg-accent/20 text-accent-foreground"
                  >
                    <Plus size={18} /> AGGIUNGI
                  </button>
                )}
              </div>
            </div>
            
          </div>
        );
      })}
    </div>
  );
};

export default ProductGrid;
