import { useRef, useState } from "react";
import { Camera, Trash2, Loader2, Link as LinkIcon } from "lucide-react";
import { uploadImageToStorage, type UploadFolder } from "@/lib/imageUpload";

interface Props {
  value: string;
  onChange: (url: string) => void;
  folder: UploadFolder;
  label?: string;
}

export default function ImageUploadField({ value, onChange, folder, label = "FOTO" }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-pick same file
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const url = await uploadImageToStorage(file, folder);
      onChange(url);
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err ?? "");
      const msg = raw && raw.trim().length > 0 ? raw : "Errore sconosciuto durante l'upload";
      setError(msg);
      console.error("[ImageUploadField] upload failed", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
        {label}
      </label>

      {value ? (
        <div className="relative inline-block">
          <img
            src={value}
            alt="anteprima"
            className="w-40 h-40 object-cover rounded-2xl border-2 border-slate-200 bg-slate-100"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
            }}
          />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full shadow-lg"
            title="Rimuovi immagine"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ) : (
        <div className="w-40 h-40 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400 text-xs">
          Nessuna immagine
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm shadow-md"
        >
          {uploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
          {uploading ? "Caricamento…" : "SCATTA / CARICA FOTO"}
        </button>
        <button
          type="button"
          onClick={() => setShowManual((v) => !v)}
          className="inline-flex items-center gap-2 px-3 py-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold"
          title="Inserisci URL manuale"
        >
          <LinkIcon size={14} />
          URL manuale
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
        onChange={handleFile}
        className="hidden"
      />

      {showManual && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://... oppure /uploads/..."
          className="w-full px-3 py-2 rounded-lg border-2 border-slate-200 text-sm"
        />
      )}

      {error && <p className="text-sm text-red-600 font-semibold">{error}</p>}
    </div>
  );
}
