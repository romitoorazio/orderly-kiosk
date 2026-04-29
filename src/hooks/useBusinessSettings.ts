import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { APP_ID, db } from "@/lib/firebase";
import { BUSINESS } from "@/config/business";

export type BusinessTexts = {
  copyright: string;
  welcomeFooter: string;
  receiptThankYou: string;
  receiptPickupBeeper: string;
  receiptPickupMonitor: string;
  receiptPaidByCard: string;
  receiptPayAtCash: string;
};

export type BusinessSocials = {
  instagram: string;
  facebook: string;
};

export type BusinessTheme = {
  primary?: string;
  accent?: string;
  destructive?: string;
  background?: string;
  surface?: string;
  brandRed?: string;
  kioskBg?: string;
};

export type BusinessPlaceholders = {
  product?: string;
  ingredient?: string;
  department?: string;
};

export type BusinessSettings = {
  slug: string;
  name: string;
  tagline: string;
  storagePrefix: string;
  locale: string;
  currency: string;
  currencySymbol: string;
  logoUrl: string;
  faviconUrl?: string;
  socials: BusinessSocials;
  texts: BusinessTexts;
  theme: BusinessTheme;
  placeholders: BusinessPlaceholders;
};

export type BusinessSettingsFirestore = Partial<
  Omit<BusinessSettings, "socials" | "texts" | "theme" | "placeholders">
> & {
  socials?: Partial<BusinessSocials>;
  texts?: Partial<BusinessTexts>;
  theme?: Partial<BusinessTheme>;
  placeholders?: Partial<BusinessPlaceholders>;
};

export const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = {
  slug: BUSINESS.slug,
  name: BUSINESS.name,
  tagline: BUSINESS.tagline,
  storagePrefix: BUSINESS.storagePrefix,
  locale: BUSINESS.locale,
  currency: BUSINESS.currency,
  currencySymbol: BUSINESS.currencySymbol,
  logoUrl: BUSINESS.logoUrl,
  faviconUrl: undefined,
  socials: {
    instagram: BUSINESS.socials.instagram,
    facebook: BUSINESS.socials.facebook,
  },
  texts: {
    copyright: BUSINESS.texts.copyright,
    welcomeFooter: BUSINESS.texts.welcomeFooter,
    receiptThankYou: BUSINESS.texts.receiptThankYou,
    receiptPickupBeeper: BUSINESS.texts.receiptPickupBeeper,
    receiptPickupMonitor: BUSINESS.texts.receiptPickupMonitor,
    receiptPaidByCard: BUSINESS.texts.receiptPaidByCard,
    receiptPayAtCash: BUSINESS.texts.receiptPayAtCash,
  },
  theme: {},
  placeholders: {},
};

export const mergeBusinessSettings = (
  remote?: BusinessSettingsFirestore | null
): BusinessSettings => {
  if (!remote) return DEFAULT_BUSINESS_SETTINGS;

  return {
    ...DEFAULT_BUSINESS_SETTINGS,
    ...remote,
    socials: {
      ...DEFAULT_BUSINESS_SETTINGS.socials,
      ...(remote.socials || {}),
    },
    texts: {
      ...DEFAULT_BUSINESS_SETTINGS.texts,
      ...(remote.texts || {}),
    },
    theme: {
      ...DEFAULT_BUSINESS_SETTINGS.theme,
      ...(remote.theme || {}),
    },
    placeholders: {
      ...DEFAULT_BUSINESS_SETTINGS.placeholders,
      ...(remote.placeholders || {}),
    },
  };
};

export function useBusinessSettings(user?: unknown) {
  const [remoteSettings, setRemoteSettings] =
    useState<BusinessSettingsFirestore | null>(null);
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setRemoteSettings(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);

    const ref = doc(
      db,
      "artifacts",
      APP_ID,
      "public",
      "data",
      "settings",
      "business"
    );

    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        setRemoteSettings(
          snapshot.exists()
            ? (snapshot.data() as BusinessSettingsFirestore)
            : null
        );
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("[useBusinessSettings] settings/business error", err);
        setRemoteSettings(null);
        setLoading(false);
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    );

    return () => unsubscribe();
  }, [user]);

  const settings = useMemo(
    () => mergeBusinessSettings(remoteSettings),
    [remoteSettings]
  );

  return {
    settings,
    loading,
    error,
    isUsingFallback: !remoteSettings,
  };
}