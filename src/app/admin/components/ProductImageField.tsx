"use client";

import { useRef, useState } from "react";
import { Image as ImageIcon, LoaderCircle, Trash2, Upload } from "lucide-react";

interface ProductImageFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

const MAX_IMAGE_BYTES = 450_000;

async function compressImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Chọn tệp ảnh hợp lệ.");
  if (file.size > 15 * 1024 * 1024) throw new Error("Ảnh gốc vượt quá 15 MB.");

  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = sourceUrl;
    await image.decode();

    const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Trình duyệt không thể xử lý ảnh.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.86, 0.74, 0.62, 0.5]) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      if (Math.ceil((base64.length * 3) / 4) <= MAX_IMAGE_BYTES) return dataUrl;
    }
    throw new Error("Ảnh vẫn lớn sau khi nén. Hãy chọn ảnh nhỏ hơn.");
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export default function ProductImageField({ id, value, onChange, label = "Ảnh sản phẩm" }: ProductImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const hasStoredImage = value.startsWith("data:image/") || /^\/api\/admin\/product-image\/\d+$/.test(value);

  async function handleFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      onChange(await compressImage(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể đọc ảnh.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <label htmlFor={`${id}-url`} className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600">
        <span>{label}</span>
        <span className="text-[10px] font-normal text-slate-400">Không bắt buộc</span>
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-emerald-600 hover:text-emerald-700 disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Tải ảnh lên
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
        <span className="text-[10px] text-slate-400">hoặc</span>
        <input
          id={`${id}-url`}
          type="text"
          value={hasStoredImage ? "Ảnh đã tải lên" : value}
          readOnly={hasStoredImage}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Dán URL ảnh công khai"
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-900 focus:border-emerald-600 focus:outline-none"
        />
        {value ? (
          <button type="button" onClick={() => { onChange(""); setError(""); }} title="Xóa ảnh" className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600">
            <Trash2 className="h-4 w-4" />
          </button>
        ) : <ImageIcon className="h-4 w-4 shrink-0 text-slate-300" />}
      </div>
      {value && (
        <div className="mt-2 flex items-center gap-2">
          <img src={value} alt="Xem trước ảnh sản phẩm" className="h-12 w-12 rounded-lg border border-slate-200 object-cover" />
          <p className="text-[10px] text-slate-500">Bot sẽ gửi ảnh này ở phần chi tiết sản phẩm.</p>
        </div>
      )}
      {error && <p role="alert" className="mt-1 text-[11px] text-rose-600">{error}</p>}
    </div>
  );
}
