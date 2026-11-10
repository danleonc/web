import { useState } from "react";

type ImageItem = { id: string; createdAt: number };
export function OwnImages() {
  const [images, setImages] = useState<ImageItem[] | null>(null);
  const [page, setPage] = useState(0); const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function load(next: number) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/account/media?page=${next}`, { credentials: "same-origin" });
      if (!response.ok) throw Error();
      const result = await response.json() as { images: ImageItem[]; hasMore: boolean };
      setImages((current) => next === 1 ? result.images : [...(current || []), ...result.images]);
      setPage(next); setMore(result.hasMore);
    } catch { setError("No pudimos cargar tus imágenes. Inténtalo de nuevo."); }
    finally { setBusy(false); }
  }
  return <div>
    <p>Las imágenes propias de encuentros se descargan por separado mientras sigan disponibles para tu cuenta. No se incluyen las retiradas por moderación.</p>
    {images === null ? <button className="button secondary" disabled={busy} onClick={() => void load(1)}>Ver mis imágenes disponibles</button> : images.length === 0 ? <p>No hay imágenes propias disponibles para descargar.</p> : <ul>{images.map((item, index) => <li key={item.id}><a href={`/api/media/${item.id}`} download={`nexafia-imagen-${index + 1}.webp`}>Descargar imagen {index + 1}</a></li>)}</ul>}
    {more && <button className="button secondary" disabled={busy} onClick={() => void load(page + 1)}>Ver más imágenes</button>}
    {busy && <p role="status">Cargando imágenes…</p>}{error && <p role="alert">{error}</p>}
  </div>;
}
