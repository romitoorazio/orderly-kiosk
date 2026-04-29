import { Utensils, Pizza, Ham, Candy, Flame, Beer, Star, ChefHat, Layers } from 'lucide-react';
import { BUSINESS } from '@/config/business';

export const LOGO_URL = BUSINESS.logoUrl;
export const COPYRIGHT_TEXT = BUSINESS.texts.copyright;
export const IG_LINK = BUSINESS.socials.instagram;
export const FB_LINK = BUSINESS.socials.facebook;

export const INACTIVITY_LIMIT = 50;   // secondi
export const COUNTDOWN_LIMIT = 10;    // secondi
export const DEFAULT_BACKEND_URL = '/api/sumup';
const PLACEHOLDER_BACKEND_HOSTS = ['your-app-controller.vercel.app'];

export const resolveBackendUrl = (backendUrl?: string, origin?: string) => {
  const fallback = origin ? `${origin}${DEFAULT_BACKEND_URL}` : DEFAULT_BACKEND_URL;
  const trimmed = backendUrl?.trim();

  if (!trimmed) return fallback;
  if (/your-app-controller/i.test(trimmed)) return fallback;

  try {
    const parsed = new URL(trimmed, origin || 'http://localhost');
    if (PLACEHOLDER_BACKEND_HOSTS.includes(parsed.host)) return fallback;
    if (!['http:', 'https:'].includes(parsed.protocol) && !trimmed.startsWith('/')) return fallback;
    return origin && trimmed.startsWith('/') ? `${origin}${trimmed}` : trimmed;
  } catch {
    return fallback;
  }
};

export const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Utensils, Pizza, Ham, Candy, Flame, Beer, Star, ChefHat, Layers
};

export const DEPARTMENTS_FALLBACK = [
  { id: 'panineria', name: 'PANINERIA', iconName: 'Utensils', color: 'bg-amber-500', imageUrl: 'https://images.unsplash.com/photo-1550507992-eb63ffee0847?q=80&w=600&auto=format&fit=crop', sortOrder: 1 },
  { id: 'focacceria', name: 'FOCACCERIA', iconName: 'Pizza', color: 'bg-red-600', imageUrl: 'https://images.unsplash.com/photo-1573823707769-39a3fd61b9af?q=80&w=600&auto=format&fit=crop', sortOrder: 2 },
  { id: 'rosticceria', name: 'ROSTICCERIA', iconName: 'Ham', color: 'bg-orange-600', imageUrl: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?q=80&w=600&auto=format&fit=crop', sortOrder: 3 },
  { id: 'bibite', name: 'BIBITE', iconName: 'Beer', color: 'bg-blue-600', imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?q=80&w=600&auto=format&fit=crop', sortOrder: 4 },
  { id: 'grigliate', name: 'GRIGLIATE', iconName: 'Flame', color: 'bg-red-800', imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=600&auto=format&fit=crop', sortOrder: 5 },
  { id: 'crepes', name: 'CREPES', iconName: 'Candy', color: 'bg-pink-600', imageUrl: 'https://images.unsplash.com/photo-1519676867240-f03562e64548?q=80&w=600&auto=format&fit=crop', sortOrder: 6 },
  { id: 'offerte', name: 'OFFERTE MENU', iconName: 'Star', color: 'bg-emerald-600', imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=600&auto=format&fit=crop', sortOrder: 7 },
];

export type Department = {
  id: string;
  name: string;
  iconName: string;
  color: string;
  imageUrl?: string;
  sortOrder: number;
  available?: boolean;
};

export type MenuItemFormat = {
  name: string;
  price: number;
};

export type MenuItem = {
  id: string;
  name: string;
  price: number;
  departmentId: string;
  imageUrl?: string;
  description?: string;
  defaultIngredients?: string[];
  available?: boolean;
  sortOrder?: number;
  formats?: MenuItemFormat[];
  contpiattoDeptId?: string;
  isBaseProduct?: boolean;
  isSpecial?: boolean;
};

export type CartItem = {
  cartId: number;
  signature: string;
  id: string;
  name: string;
  price: number;
  customization: string[];
  selectedIngredients: string[];
  defaultIngredients: string[];
  quantity: number;
  paid: boolean;
  _formato_scelto?: string;
  _contorni?: string[];
};

export type Order = {
  id: string;
  number: string;
  orderNumber?: string | number;
  beeperNumber?: string | number | null;
  beepersEnabled?: boolean;
  items: CartItem[];
  total: number;
  timestamp: any;
  clientTimestamp?: number;
  status: string;
  type: string;
  note?: string;
  noteImg?: string;
  origine: string;
  printed?: boolean | string;
  paid?: boolean;
  printSignal?: number;
  forcedCash?: boolean;
  checkoutId?: string;
  paymentStatus?: string;
  paymentVerifiedAt?: any;
  syncError?: boolean;
  manualCheckRequired?: boolean;
  isMobile?: boolean;
  print?: any;
  isReprint?: boolean;
  fallbackFromOrderId?: string | null;
};

export type Ingredient = {
  id: string;
  name: string;
  category?: string;
  extraPrice?: number;
  imageUrl?: string;
  sortOrder?: number;
};