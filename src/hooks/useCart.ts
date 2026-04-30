import { useState, useEffect, useCallback } from "react";
import type { CartItem, MenuItem } from "@/lib/constants";
import { enrichCartItemRouting } from "@/lib/orderRouting";

const CART_KEY = "orazio_cart_session";

export function useCart() {
  // SSR-safe: stato iniziale vuoto, idratazione dopo mount
  const [cart, setCart] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const saved = sessionStorage.getItem(CART_KEY);
      if (saved) setCart(JSON.parse(saved));
    } catch {
      /* noop */
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
      }
    } catch (e) {
      console.warn("Cart save error", e);
    }
  }, [cart, hydrated]);

  const addToCart = useCallback(
    (item: MenuItem, customIngredients: string[] = [], qty = 1) => {
      const signature = `${item.id || item.name}|${customIngredients
        .slice()
        .sort()
        .join(",")}`;
      setCart((prev) => {
        const idx = prev.findIndex((c) => c.signature === signature);
        if (idx >= 0) {
          const newCart = [...prev];
          newCart[idx] = {
            ...newCart[idx],
            quantity: newCart[idx].quantity + qty,
          };
          return newCart;
        }
        return [
          ...prev,
          enrichCartItemRouting({
            cartId: Date.now() + Math.random(),
            signature,
            id: item.id || String(Date.now()),
            name: item.name,
            price: Number(item.price),
            customization: customIngredients,
            selectedIngredients:
              (item as any).selectedIngredients || item.defaultIngredients || [],
            defaultIngredients: item.defaultIngredients || [],
            quantity: qty,
            paid: false,
            departmentId: (item as any).departmentId || (item as any).department || "",
            productionDeptIds: (item as any).productionDeptIds || (item as any).destinationDeptIds || [],
          }),
        ];
      });
    },
    [],
  );

  const updateQuantity = useCallback((cartId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.cartId === cartId
            ? { ...c, quantity: Math.max(0, c.quantity + delta) }
            : c,
        )
        .filter((c) => c.quantity > 0),
    );
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  return { cart, setCart, addToCart, updateQuantity, clearCart, total };
}
