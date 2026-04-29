import React, { useMemo, useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { ArrowLeft, Minus, Plus, Send, Trash2 } from "lucide-react";
import { APP_ID, db } from "@/lib/firebase";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useFirestoreData } from "@/hooks/useFirestoreData";
import { usePayment, buildOrderPayload } from "@/hooks/usePayment";
import { DEPARTMENTS_FALLBACK } from "@/lib/constants";
import type { CartItem } from "@/lib/constants";

type WaiterCartItem = CartItem & { imageUrl?: string };

const CameriereView: React.FC = () => {
  const { user } = useFirebaseAuth();
  const data = useFirestoreData(user);
  const { flags } = useFeatureFlags();
  const payment = usePayment({ isDemoMode: false, onOrderComplete: () => {}, onPlayDing: () => {} });

  const tables = flags.waiter.tables?.length ? flags.waiter.tables : ["1", "2", "3", "4", "5", "6"];
  const [table, setTable] = useState<string>(tables[0] || "1");
  const [activeDept, setActiveDept] = useState<string>("");
  const [cart, setCart] = useState<WaiterCartItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [lastOrder, setLastOrder] = useState<string | null>(null);

  const departments = useMemo(() => {
    const all = (data.departments?.length ? data.departments : DEPARTMENTS_FALLBACK).filter((d: any) => d.available !== false);
    const visible = flags.waiter.visibleDepartmentIds || [];
    return visible.length ? all.filter((d: any) => visible.includes(d.id)) : all;
  }, [data.departments, flags.waiter.visibleDepartmentIds]);

  const currentDept = activeDept || departments[0]?.id || "";
  const products = useMemo(() => data.menuItems.filter((p: any) => p.available !== false && p.departmentId === currentDept), [data.menuItems, currentDept]);
  const total = cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);

  const addToCart = (item: any) => {
    setCart((prev) => {
      const existing = prev.find((x) => x.id === item.id);
      if (existing) return prev.map((x) => x.id === item.id ? { ...x, quantity: x.quantity + 1 } : x);
      return [...prev, {
        cartId: Date.now(),
        signature: `${item.id}-${Date.now()}`,
        id: item.id,
        name: item.name,
        price: Number(item.price || 0),
        customization: [],
        selectedIngredients: item.defaultIngredients || [],
        defaultIngredients: item.defaultIngredients || [],
        quantity: 1,
        paid: false,
        imageUrl: item.imageUrl,
      }];
    });
  };

  const changeQty = (id: string, delta: number) => {
    setCart((prev) => prev.flatMap((item) => {
      if (item.id !== id) return [item];
      const quantity = item.quantity + delta;
      return quantity <= 0 ? [] : [{ ...item, quantity }];
    }));
  };

  const sendOrder = async () => {
    if (!flags.waiter.canCreateOrders) return alert("Creazione ordini cameriere disattivata da Admin.");
    if (!table) return alert("Seleziona un tavolo.");
    if (cart.length === 0) return alert("Carrello vuoto.");
    setSubmitting(true);
    try {
      // Ordine tavolo: numero ordine atomico, ma niente beeper fisico.
      const assignment = await payment.generateAtomicOrderAssignment({ ...flags.beepers, enabled: false, autoAssign: false });
      const payload = buildOrderPayload(cart, {
        method: "cash",
        isMobile: false,
        isDemo: false,
        num: assignment.orderNumber,
        total,
        beeperNumber: null,
        beepersEnabled: false,
      });
      const orderData = {
        ...payload,
        mode: "table",
        tableNumber: table,
        waiterId: user?.uid || "waiter",
        origine: "cameriere",
        sourceLabel: `CAMERIERE · TAVOLO ${table}`,
        note: `Tavolo ${table}`,
      };
      const ref = await addDoc(collection(db, "artifacts", APP_ID, "public", "data", "orders"), orderData);
      setLastOrder(String(assignment.orderNumber));
      setCart([]);
      alert(`Ordine tavolo ${table} inviato. Numero #${assignment.orderNumber}`);
      console.log("[Cameriere] ordine creato", ref.id);
    } catch (e: any) {
      console.error("[Cameriere] sendOrder failed", e);
      alert(`Errore invio ordine: ${e?.message || e}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans uppercase">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 p-4 flex items-center justify-between gap-3 shadow-sm">
        <a href="/hub" className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500"><ArrowLeft /></a>
        <div>
          <h1 className="text-2xl font-black italic tracking-tight">Cameriere</h1>
          <p className="text-xs font-bold text-slate-500">Ordini da tavolo tablet/mobile</p>
        </div>
        <button onClick={sendOrder} disabled={submitting || cart.length === 0} className="px-5 py-3 rounded-2xl bg-indigo-600 text-white font-black flex items-center gap-2 disabled:opacity-40"><Send size={18} /> Invia</button>
      </header>

      <main className="grid lg:grid-cols-[260px_1fr_360px] gap-4 p-4">
        <section className="space-y-4">
          <div className="bg-white rounded-[2rem] p-5 border border-slate-200 shadow-sm">
            <label className="text-xs font-black text-slate-500 tracking-widest">TAVOLO</label>
            <div className="grid grid-cols-3 gap-2 mt-3">
              {tables.map((t) => <button key={t} onClick={() => setTable(t)} className={`h-14 rounded-2xl font-black ${table === t ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}>{t}</button>)}
            </div>
          </div>
          <div className="bg-white rounded-[2rem] p-5 border border-slate-200 shadow-sm">
            <label className="text-xs font-black text-slate-500 tracking-widest">REPARTI</label>
            <div className="space-y-2 mt-3">
              {departments.map((dept: any) => <button key={dept.id} onClick={() => setActiveDept(dept.id)} className={`w-full p-4 rounded-2xl text-left font-black ${currentDept === dept.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>{dept.name}</button>)}
            </div>
          </div>
        </section>

        <section className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 content-start">
          {products.map((item: any) => (
            <button key={item.id} onClick={() => addToCart(item)} className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden text-left active:scale-[0.98] transition">
              <div className="aspect-video bg-slate-100 overflow-hidden">
                {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" /> : null}
              </div>
              <div className="p-4">
                <h3 className="font-black text-slate-900 leading-tight">{item.name}</h3>
                <p className="text-2xl font-black text-indigo-600 mt-2">€{Number(item.price || 0).toFixed(2)}</p>
              </div>
            </button>
          ))}
        </section>

        <aside className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-5 h-fit sticky top-24">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-black italic">Tavolo {table}</h2>
              {lastOrder && <p className="text-xs font-bold text-emerald-600">Ultimo ordine #{lastOrder}</p>}
            </div>
            <button onClick={() => setCart([])} className="text-red-500"><Trash2 size={20} /></button>
          </div>
          <div className="space-y-3 max-h-[55vh] overflow-auto pr-1">
            {cart.length === 0 && <p className="text-sm font-bold text-slate-400 text-center py-8">Carrello vuoto</p>}
            {cart.map((item) => (
              <div key={item.id} className="bg-slate-50 rounded-2xl p-3 flex items-center justify-between gap-2">
                <div className="min-w-0"><h4 className="font-black truncate">{item.name}</h4><p className="text-xs font-bold text-slate-500">€{Number(item.price).toFixed(2)}</p></div>
                <div className="flex items-center gap-2">
                  <button onClick={() => changeQty(item.id, -1)} className="w-9 h-9 rounded-xl bg-white border"><Minus size={16} className="mx-auto" /></button>
                  <span className="font-black w-5 text-center">{item.quantity}</span>
                  <button onClick={() => changeQty(item.id, 1)} className="w-9 h-9 rounded-xl bg-white border"><Plus size={16} className="mx-auto" /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-200 mt-5 pt-5 flex justify-between items-center">
            <span className="text-sm font-black text-slate-500">TOTALE</span>
            <span className="text-3xl font-black text-slate-900">€{total.toFixed(2)}</span>
          </div>
          <button onClick={sendOrder} disabled={submitting || cart.length === 0} className="w-full mt-4 py-5 rounded-2xl bg-indigo-600 text-white font-black text-lg disabled:opacity-40">INVIA A REPARTO</button>
        </aside>
      </main>
    </div>
  );
};

export default CameriereView;
