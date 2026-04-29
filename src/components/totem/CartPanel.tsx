import React from "react";
import { Minus, Plus, Trash2, ShoppingBasket, Edit3 } from "lucide-react";
import type { CartItem } from "@/lib/constants";

interface CartPanelProps {
  cart: CartItem[];
  total: number;
  onUpdateQuantity: (cartId: number, delta: number) => void;
  onEdit: (item: CartItem) => void;
  onProceed: () => void;
  isSubmitting: boolean;
  menuItems?: any[];
}

const CartPanel: React.FC<CartPanelProps> = ({
  cart,
  total,
  onUpdateQuantity,
  onEdit,
  onProceed,
  isSubmitting,
  menuItems = [],
}) => {
  if (cart.length === 0) {
    return (
      <div className="w-full md:w-80 lg:w-96 bg-white border-l-[10px] border-amber-500 flex flex-col h-full uppercase">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-slate-400">
          <ShoppingBasket size={48} strokeWidth={1.5} />
          <p className="font-black italic text-lg text-slate-500">IL TUO ORDINE</p>
          <p className="text-sm text-center text-slate-400 normal-case">
            Seleziona i prodotti dal menu per aggiungerli qui
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full md:w-80 lg:w-96 bg-white border-l-[10px] border-amber-500 flex flex-col h-full uppercase relative">
      {/* HEADER */}
      <div className="p-3 md:p-6 border-b-4 border-slate-100 bg-[#fdfbf7] flex justify-between items-center">
        <div className="flex items-center gap-1 md:gap-3">
          <ShoppingBasket className="text-red-600 w-5 h-5 md:w-6 md:h-6" />
          <h2 className="text-base md:text-2xl font-black italic text-red-600">ORDINEtest</h2>
        </div>

        <span className="text-xs font-bold" style={{ color: "black" }}>
          {cart.reduce((s, i) => s + i.quantity, 0)} ART.
        </span>
      </div>

      {/* ITEMS */}
      <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-2 md:space-y-4 pb-40">
        {cart.map((item) => {
          const baseItem = menuItems.find((mi: any) => mi.id === item.id);

          const isEditable =
            baseItem &&
            (baseItem.isBaseProduct ||
              baseItem.defaultIngredients?.length > 0 ||
              baseItem.formats?.length > 0 ||
              baseItem.contpiattoDeptId);

          const isBaseProduct = baseItem?.isBaseProduct || false;

          return (
            <div
              key={item.cartId}
              className="bg-white rounded-xl md:rounded-[2rem] p-3 md:p-4 shadow-sm md:shadow-md border-l-[6px] md:border-l-[10px] border-amber-500 flex flex-col border border-slate-100"
            >
              <div className="flex justify-between items-start gap-2 w-full">
                {/* LEFT */}
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <span
                    className="text-sm md:text-lg leading-tight break-words whitespace-normal font-black italic"
                    style={{ color: "black" }}
                  >
                    {item.name}
                  </span>

                  {(item as any)._formato_scelto && (
                    <span className="text-[9px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded w-fit border border-amber-100">
                      📐 {(item as any)._formato_scelto}
                    </span>
                  )}

                  {(item as any)._contorni?.length > 0 && (
                    <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded w-fit border border-emerald-100">
                      🍟 {(item as any)._contorni.map((c: any) => (typeof c === "string" ? c : c.name)).join(", ")}
                    </span>
                  )}

                  {isEditable && (
                    <button
                      onClick={() => onEdit(item)}
                      className="text-blue-700 bg-blue-50 px-2 py-1 rounded-lg active:scale-90 transition-transform shadow-sm border border-blue-200 flex items-center gap-1 w-fit mt-1"
                    >
                      <Edit3 size={14} />
                      <span className="text-[10px] md:text-xs font-black">MODIFICA</span>
                    </button>
                  )}
                </div>

                {/* RIGHT */}
                <div className="flex flex-col items-end justify-between gap-3 shrink-0 ml-1">
                  <span className="text-red-600 text-sm md:text-xl leading-none font-black italic">
                    €{(item.price * item.quantity).toFixed(2)}
                  </span>

                  <div className="flex items-center gap-1 md:gap-2 bg-slate-200 p-1 rounded-full border-2 border-slate-400 shadow-inner">
                    {/* MINUS / DELETE */}
                    <button
                      onClick={() => onUpdateQuantity(item.cartId, -1)}
                      className="w-8 h-8 md:w-10 md:h-10 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md border-2 border-red-700 active:scale-90"
                    >
                      {item.quantity === 1 ? (
                        <Trash2 size={18} strokeWidth={3} />
                      ) : (
                        <Minus size={18} strokeWidth={4} />
                      )}
                    </button>

                    {/* NUMBER */}
                    <span className="text-base md:text-xl w-6 md:w-7 text-center font-black text-slate-900">
                      {item.quantity}
                    </span>

                    {/* PLUS */}
                    <button
                      onClick={() => onUpdateQuantity(item.cartId, 1)}
                      className="w-8 h-8 md:w-10 md:h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-md border-2 border-emerald-700 active:scale-90"
                    >
                      <Plus size={18} strokeWidth={4} />
                    </button>
                  </div>
                </div>
              </div>

              {/* CUSTOMIZATION */}
              {item.customization?.length > 0 && (
                <p className="text-[9px] md:text-[11px] text-amber-900 mt-2 italic font-bold leading-tight bg-amber-50 p-2 rounded-lg border border-amber-200 break-words whitespace-normal">
                  {isBaseProduct ? "COMPRENDE: " : "MODIFICHE: "}
                  {item.customization.map((c: any) => (typeof c === "object" ? c.name : c)).join(", ")}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* FOOTER */}
      <div className="absolute bottom-0 left-0 w-full bg-red-600 text-white p-3 md:p-8 z-50 shadow-2xl">
        <div className="flex justify-between items-end mb-3 md:mb-6">
          <span className="font-black text-[10px] md:text-xs opacity-90">TOTALE</span>
          <span className="text-2xl md:text-5xl font-black italic text-amber-400">€{total.toFixed(2)}</span>
        </div>

        <button
          onClick={onProceed}
          disabled={isSubmitting}
          className={`w-full py-3 md:py-6 rounded-full font-black text-lg md:text-3xl italic shadow-2xl active:scale-95 transition-transform ${
            isSubmitting ? "bg-slate-300 text-white" : "bg-white text-red-600 border-b-4 border-slate-200"
          }`}
        >
          {isSubmitting ? "INVIO..." : "ORDINA"}
        </button>
      </div>
    </div>
  );
};

export default CartPanel;
