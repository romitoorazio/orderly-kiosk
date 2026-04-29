export type PrinterDriverType = "browser" | "webusb" | "webserial" | "escpos-network" | "bluetooth" | "qz";
export type PrinterRole = "receipt" | "cassa" | "kitchen" | "bar" | "lab" | "counter" | "generic";
export type PaperWidth = 58 | 72 | 80 | "custom";

export type PrinterProfile = {
  id: string;
  name: string;
  enabled: boolean;
  role: PrinterRole;
  departmentId: string | null;
  connection: {
    driver: PrinterDriverType;
    host?: string;
    port?: number;
    vendorId?: string;
    productId?: string;
  };
  paper: {
    width: PaperWidth;
    customMm?: number;
  };
  copies: number;
  autoPrint: boolean;
  lastTest?: {
    at: any | null;
    ok: boolean;
    errorMessage?: string;
  };
  createdAt?: any;
  updatedAt?: any;
};

export type PrintPayload = {
  title: string;
  subtitle?: string;
  lines?: Array<{ label: string; value?: string | number }>;
  footer?: string;
};

export type PrintResult = { ok: boolean; error?: string };
