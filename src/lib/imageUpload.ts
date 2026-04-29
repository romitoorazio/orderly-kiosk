import { ref, uploadBytes, getDownloadURL, type StorageError } from "firebase/storage";
import { signInAnonymously } from "firebase/auth";
import { storage, auth } from "./firebase";

export type UploadFolder = "products" | "ingredients" | "departments" | "business";

const MAX_FINAL_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_LONG_SIDE = 1600;
const QUALITY_WEBP = 0.82;
const QUALITY_JPEG = 0.85;
const UPLOAD_TIMEOUT_MS = 30_000;

const ACCEPTED_EXT_RE = /\.(jpg|jpeg|png|webp|heic|heif)$/i;
const ACCEPTED_MIME_RE = /^image\/(jpeg|png|webp|heic|heif)$/i;

const TOO_LARGE_MSG =
  "Immagine troppo grande. Riduci la foto o scegli un'immagine più leggera.";
const HEIC_FAIL_MSG =
  "Foto HEIC non convertibile. Imposta iPhone su Formati > Più compatibile oppure scegli una foto JPEG.";
const FORMAT_MSG =
  "Formato non supportato. Usa JPG, PNG, WebP, HEIC o HEIF.";
const CONVERSION_FAIL_MSG =
  "Conversione immagine fallita. Prova con una foto JPG più leggera.";

type FinalExt = "webp" | "jpg";
type FinalMime = "image/webp" | "image/jpeg";

interface ProcessedImage {
  blob: Blob;
  ext: FinalExt;
  mime: FinalMime;
}

function log(...args: unknown[]) {
  // eslint-disable-next-line no-console
  console.log("[imageUpload]", ...args);
}

function getExt(name: string): string {
  const m = name.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : "";
}

function isHeic(file: File): boolean {
  const t = (file.type || "").toLowerCase();
  if (t === "image/heic" || t === "image/heif") return true;
  const ext = getExt(file.name);
  return ext === "heic" || ext === "heif";
}

function isJpeg(file: File): boolean {
  const t = (file.type || "").toLowerCase();
  if (t === "image/jpeg" || t === "image/jpg") return true;
  const ext = getExt(file.name);
  return ext === "jpg" || ext === "jpeg";
}

function isWebp(file: File): boolean {
  const t = (file.type || "").toLowerCase();
  if (t === "image/webp") return true;
  return getExt(file.name) === "webp";
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e instanceof Error ? e : new Error("Impossibile decodificare l'immagine"));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), type, quality);
  });
}

async function dataUrlToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  try {
    const dataUrl = canvas.toDataURL("image/jpeg", QUALITY_JPEG);
    if (!dataUrl || !dataUrl.startsWith("data:image/")) return null;
    const res = await fetch(dataUrl);
    const b = await res.blob();
    return b && b.size > 0 ? b : null;
  } catch {
    return null;
  }
}

async function resizeImage(input: Blob): Promise<ProcessedImage> {
  log("resize start", { inputSize: input.size, inputType: input.type || "(vuoto)" });
  const img = await loadImage(input);
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;
  if (!naturalW || !naturalH) {
    throw new Error("Dimensioni immagine non valide");
  }
  const longSide = Math.max(naturalW, naturalH);
  const scale = longSide > MAX_LONG_SIDE ? MAX_LONG_SIDE / longSide : 1;
  const w = Math.max(1, Math.round(naturalW * scale));
  const h = Math.max(1, Math.round(naturalH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas non disponibile su questo dispositivo");
  ctx.drawImage(img, 0, 0, w, h);

  // 1) Try WebP — verifica MIME REALE
  const webp = await canvasToBlob(canvas, "image/webp", QUALITY_WEBP);
  if (webp && webp.type === "image/webp" && webp.size > 0) {
    log("resize done webp", { w, h, size: webp.size });
    return { blob: webp, ext: "webp", mime: "image/webp" };
  }

  // 2) Fallback JPEG via toBlob — verifica MIME REALE
  const jpeg = await canvasToBlob(canvas, "image/jpeg", QUALITY_JPEG);
  if (jpeg && jpeg.type === "image/jpeg" && jpeg.size > 0) {
    log("resize done jpeg(toBlob)", { w, h, size: jpeg.size });
    return { blob: jpeg, ext: "jpg", mime: "image/jpeg" };
  }

  // 3) Last resort: toDataURL → Blob (sempre JPEG)
  const fallback = await dataUrlToJpegBlob(canvas);
  if (!fallback) {
    throw new Error("Impossibile esportare l'immagine compressa");
  }
  log("resize done jpeg(dataURL)", { w, h, size: fallback.size });
  return { blob: fallback, ext: "jpg", mime: "image/jpeg" };
}

async function convertHeicToJpeg(file: File): Promise<Blob> {
  log("HEIC convert start", { name: file.name, size: file.size, type: file.type });
  const { default: heic2any } = await import("heic2any");
  const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  const blob = Array.isArray(result) ? result[0] : result;
  if (!blob || !(blob instanceof Blob) || blob.size === 0) {
    throw new Error("Conversione HEIC vuota");
  }
  log("HEIC convert done", { size: blob.size, type: blob.type });
  return blob;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`__TIMEOUT__:${label}`));
    }, ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function mapFirebaseError(err: unknown): string {
  if (err instanceof Error && err.message.startsWith("__TIMEOUT__")) {
    return "Upload non completato (timeout). Controlla la connessione e riprova.";
  }
  const code = (err as StorageError | undefined)?.code;
  switch (code) {
    case "storage/unauthorized":
      return "Upload non autorizzato. Controlla regole Firebase Storage.";
    case "storage/canceled":
      return "Upload annullato.";
    case "storage/retry-limit-exceeded":
      return "Connessione instabile, riprova.";
    case "storage/quota-exceeded":
      return "Spazio storage esaurito.";
    case "storage/unauthenticated":
      return "Sessione scaduta. Riapri la pagina e riprova.";
    default:
      if (code) return `Errore upload (${code}).`;
      return err instanceof Error ? err.message : "Errore upload sconosciuto.";
  }
}

async function ensureAuth(): Promise<void> {
  if (auth.currentUser) return;
  log("no current user, attempting anonymous sign-in");
  try {
    const cred = await signInAnonymously(auth);
    log("anonymous sign-in ok", { uid: cred.user?.uid });
  } catch (e) {
    log("anonymous sign-in failed", e);
    throw new Error("Sessione scaduta. Riapri la pagina e riprova.");
  }
}

export async function uploadImageToStorage(
  file: File,
  folder: UploadFolder,
): Promise<string> {
  const tStart = performance.now();
  const ext0 = getExt(file.name);
  log("file selected", {
    name: file.name,
    type: file.type || "(vuoto)",
    size: file.size,
    ext: ext0 || "(nessuna)",
    folder,
  });

  // 1) Validazione formato
  const mimeOk = file.type ? ACCEPTED_MIME_RE.test(file.type) : false;
  const extOk = ACCEPTED_EXT_RE.test(file.name);
  if (!mimeOk && !extOk) {
    throw new Error(FORMAT_MSG);
  }

  // 2) Auth con fallback anonymous
  await ensureAuth();

  // 3) Pipeline
  const heic = isHeic(file);
  let processed: ProcessedImage;

  if (heic) {
    let jpegFromHeic: Blob;
    try {
      jpegFromHeic = await convertHeicToJpeg(file);
    } catch (e) {
      log("HEIC conversion failed", e);
      throw new Error(HEIC_FAIL_MSG);
    }
    try {
      processed = await resizeImage(jpegFromHeic);
    } catch (e) {
      log("HEIC resize failed", e);
      // Mai upload .heic originale
      throw new Error(HEIC_FAIL_MSG);
    }
  } else {
    try {
      processed = await resizeImage(file);
    } catch (e) {
      log("resize failed, evaluating fallback", e);
      // Fallback originale: SOLO output .webp o .jpg
      if (isJpeg(file)) {
        if (file.size >= MAX_FINAL_BYTES) {
          throw new Error(TOO_LARGE_MSG);
        }
        processed = { blob: file, ext: "jpg", mime: "image/jpeg" };
        log("fallback original jpeg", { size: file.size });
      } else if (isWebp(file)) {
        if (file.size >= MAX_FINAL_BYTES) {
          throw new Error(TOO_LARGE_MSG);
        }
        processed = { blob: file, ext: "webp", mime: "image/webp" };
        log("fallback original webp", { size: file.size });
      } else {
        // PNG (o qualsiasi altro): mai upload originale
        log("fallback blocked: source is PNG or unsupported");
        throw new Error(CONVERSION_FAIL_MSG);
      }
    }
  }

  // 4) Guard finale 10MB
  if (processed.blob.size >= MAX_FINAL_BYTES) {
    log("blocked: final blob too large", { size: processed.blob.size });
    throw new Error(TOO_LARGE_MSG);
  }

  // 5) Upload con timeout — path SEMPRE .webp o .jpg
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${processed.ext}`;
  const path = `uploads/${folder}/${name}`;
  const storageRef = ref(storage, path);

  try {
    log("upload start", { path, size: processed.blob.size, mime: processed.mime });
    const tUp = performance.now();
    await withTimeout(
      uploadBytes(storageRef, processed.blob, { contentType: processed.mime }),
      UPLOAD_TIMEOUT_MS,
      "uploadBytes",
    );
    const url = await withTimeout(
      getDownloadURL(storageRef),
      UPLOAD_TIMEOUT_MS,
      "getDownloadURL",
    );
    log("upload done", {
      uploadMs: Math.round(performance.now() - tUp),
      totalMs: Math.round(performance.now() - tStart),
      path,
      url,
    });
    return url;
  } catch (err) {
    const code = (err as StorageError | undefined)?.code;
    log("upload error", { code, err });
    throw new Error(mapFirebaseError(err));
  }
}
