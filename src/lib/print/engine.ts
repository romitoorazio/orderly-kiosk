import type { PrintPayload, PrinterDriverType, PrinterProfile, PrintResult } from "./types";

export const DRIVER_LABELS: Record<PrinterDriverType, string> = {
  browser: "Browser / finestra stampa",
  webusb: "WebUSB ESC/POS",
  webserial: "WebSerial ESC/POS",
  "escpos-network": "Rete IP / bridge locale",
  bluetooth: "Bluetooth ESC/POS",
  qz: "QZ Tray",
};

export const DRIVER_STATUS: Record<PrinterDriverType, "ready" | "beta"> = {
  browser: "ready",
  webusb: "beta",
  webserial: "beta",
  "escpos-network": "beta",
  bluetooth: "beta",
  qz: "beta",
};

export function getPaperWidthMm(printer: Pick<PrinterProfile, "paper">): number {
  if (printer.paper.width === "custom") return Number(printer.paper.customMm || 80);
  return Number(printer.paper.width || 80);
}

export function renderPrintHtml(payload: PrintPayload, printer: PrinterProfile): string {
  const width = getPaperWidthMm(printer);
  const lineRows = (payload.lines || [])
    .map((line) => {
      const value = line.value === undefined || line.value === null ? "" : String(line.value);
      return `<div class="row"><span>${escapeHtml(line.label)}</span><strong>${escapeHtml(value)}</strong></div>`;
    })
    .join("");

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<title>Test stampa</title>
<style>
  @page { size: ${width}mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { width: ${width}mm; margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #111; }
  .ticket { padding: 4mm 2mm; }
  h1 { font-size: 17px; margin: 0 0 6px; text-align: center; text-transform: uppercase; }
  .subtitle { font-size: 11px; text-align: center; margin-bottom: 8px; }
  .hr { border-top: 1px dashed #111; margin: 8px 0; }
  .row { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; padding: 3px 0; }
  .row strong { text-align: right; }
  .footer { text-align: center; font-size: 10px; margin-top: 8px; }
</style>
</head>
<body>
  <div class="ticket">
    <h1>${escapeHtml(payload.title)}</h1>
    ${payload.subtitle ? `<div class="subtitle">${escapeHtml(payload.subtitle)}</div>` : ""}
    <div class="hr"></div>
    ${lineRows}
    <div class="hr"></div>
    <div class="footer">${escapeHtml(payload.footer || "Stampa test completata")}</div>
  </div>
<script>window.onload = () => { setTimeout(() => window.print(), 150); };</script>
</body>
</html>`;
}

export async function printWithProfile(payload: PrintPayload, printer: PrinterProfile): Promise<PrintResult> {
  if (!printer.enabled) return { ok: false, error: "Stampante disattivata" };

  const driver = printer.connection?.driver || "browser";
  if (driver !== "browser") {
    return {
      ok: false,
      error: `${DRIVER_LABELS[driver]} non è ancora disponibile: richiede driver/bridge in una fase successiva. Usa Browser per ora.`,
    };
  }

  if (typeof window === "undefined") return { ok: false, error: "Stampa disponibile solo nel browser" };

  const html = renderPrintHtml(payload, printer);
  const popup = window.open("", "_blank", "width=420,height=720");
  if (!popup) return { ok: false, error: "Popup bloccato dal browser. Consenti popup per stampare il test." };

  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  return { ok: true };
}

export function buildTestPrintPayload(printer: PrinterProfile): PrintPayload {
  return {
    title: "TEST STAMPANTE",
    subtitle: printer.name,
    lines: [
      { label: "Ruolo", value: printer.role },
      { label: "Reparto", value: printer.departmentId || "nessuno" },
      { label: "Driver", value: printer.connection.driver },
      { label: "Carta", value: `${getPaperWidthMm(printer)}mm` },
      { label: "Copie", value: printer.copies || 1 },
      { label: "Auto print", value: printer.autoPrint ? "ON" : "OFF" },
    ],
    footer: "Se leggi questo ticket, la stampa browser funziona.",
  };
}

function escapeHtml(value: string): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
