import { useEffect, useState } from "react";
import { ImagePlus } from "lucide-react";
import { Modal } from "../components";
import { prepareImage } from "./local";
import type { ImageRef } from "./types";
export function ImagePicker({
  onClose,
  onChoose,
  label = "Compartir imagen",
}: {
  onClose: () => void;
  onChoose: (image: ImageRef, blob: Blob) => Promise<boolean | void>;
  label?: string;
}) {
  const [prepared, setPrepared] = useState<{
    image: ImageRef;
    blob: Blob;
  } | null>(null);
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!prepared) return;
    const value = URL.createObjectURL(prepared.blob);
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [prepared]);
  return (
    <Modal
      title="Una imagen también puede abrir una conversación."
      onClose={onClose}
    >
      <form
        className="modal-content image-picker"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!prepared || busy) return;
          setBusy(true);
          setError("");
          try {
            const result = await onChoose(
              { ...prepared.image, description: description.trim() },
              prepared.blob,
            );
            if (result !== false) onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo compartir.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          JPG, PNG o WebP, hasta 5 MB y 16 megapíxeles. Se reduce a 1280 píxeles
          y hasta 350 KB, sin conservar metadatos de ubicación.
        </p>
        <label className="image-file-label">
          <ImagePlus size={20} /> Elegir imagen
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setBusy(true);
              setError("");
              try {
                setPrepared(await prepareImage(file));
              } catch (e) {
                setPrepared(null);
                setError(
                  e instanceof Error
                    ? e.message
                    : "No se pudo abrir la imagen.",
                );
              } finally {
                setBusy(false);
                e.target.value = "";
              }
            }}
          />
        </label>
        {url && prepared && (
          <div className="image-preview">
            <img src={url} alt="Vista previa de tu imagen" />
            <span>
              {Math.ceil(prepared.blob.size / 1024)} KB · imagen comprimida
            </span>
          </div>
        )}
        <label className="field-label" htmlFor="image-description">
          Descripción de la imagen{" "}
          <span>(opcional, ayuda a la accesibilidad)</span>
        </label>
        <input
          id="image-description"
          className="text-input"
          maxLength={180}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Por ejemplo: un cuaderno con mi primer dibujo…"
        />
        <p className="small-text muted">
          Comparte solo imágenes que puedas difundir y que respeten las normas.
          El contenido sigue siendo denunciable aunque incluya una descripción.
        </p>
        {error && (
          <p className="shared-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button className="button secondary" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" disabled={!prepared || busy}>
            {busy ? "Preparando…" : label}
          </button>
        </div>
      </form>
    </Modal>
  );
}
