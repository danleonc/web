import { useEffect, useState } from "react";
import { EyeOff, Flag, Maximize2 } from "lucide-react";
import { Modal } from "../components";
import { getImage } from "./local";
import { validImageRef } from "./types";
import type { ImageRef } from "./types";
const key = "afinia.hidden-images.v1";
function hiddenIds(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value)
      ? value.filter((x) => typeof x === "string").slice(-200)
      : [];
  } catch {
    return [];
  }
}
export function clearHiddenImages() {
  localStorage.removeItem(key);
  window.dispatchEvent(new Event("afinia-image-visibility"));
}
export function ImageView({
  image,
  shared = false,
  removed = false,
  onReport,
}: {
  image: ImageRef;
  shared?: boolean;
  removed?: boolean;
  onReport?: () => void;
}) {
  const [src, setSrc] = useState("");
  const [extension, setExtension] = useState("webp");
  const [unavailable, setUnavailable] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hidden, setHidden] = useState(() => hiddenIds().includes(image.id));
  useEffect(() => {
    const update = () => setHidden(hiddenIds().includes(image.id));
    window.addEventListener("afinia-image-visibility", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("afinia-image-visibility", update);
      window.removeEventListener("storage", update);
    };
  }, [image.id]);
  useEffect(() => {
    setUnavailable(false);
    setSrc("");
    if (!validImageRef(image) || hidden || removed) {
      setSrc("");
      setExpanded(false);
      return;
    }
    if (shared) {
      setExtension("webp");
      setSrc(`/api/media/${image.id}`);
      return;
    }
    let cancelled = false;
    let objectUrl = "";
    void getImage(image.id)
      .then((blob) => {
        if (cancelled) return;
        if (!blob) {
          setUnavailable(true);
          return;
        }
        setExtension(
          blob.type === "image/jpeg"
            ? "jpg"
            : blob.type === "image/png"
              ? "png"
              : "webp",
        );
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => setUnavailable(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image.id, shared, hidden, removed]);
  function hide(value: boolean) {
    setHidden(value);
    setExpanded(false);
    try {
      const ids = hiddenIds().filter((id) => id !== image.id);
      localStorage.setItem(
        key,
        JSON.stringify(value ? [...ids, image.id].slice(-200) : ids),
      );
      window.dispatchEvent(new Event("afinia-image-visibility"));
    } catch {}
  }
  if (removed)
    return (
      <p className="image-placeholder">Imagen retirada de la conversación.</p>
    );
  if (hidden)
    return (
      <div className="image-placeholder">
        <EyeOff size={18} />
        <span>Ocultaste esta imagen.</span>
        <button
          type="button"
          className="button text"
          onClick={() => hide(false)}
        >
          Volver a mostrar
        </button>
      </div>
    );
  return (
    <div className="shared-image">
      {src && !unavailable ? (
        <button
          type="button"
          className="image-thumbnail"
          aria-label="Ampliar imagen compartida"
          onClick={() => setExpanded(true)}
        >
          <img
            src={src}
            alt={image.description || "Imagen compartida, sin descripción"}
            loading="lazy"
            onError={() => setUnavailable(true)}
          />
          <span>
            <Maximize2 size={13} /> Ampliar
          </span>
        </button>
      ) : (
        <p className="small-text muted">
          {unavailable
            ? "Esta imagen ya no está disponible en este navegador o no tienes acceso."
            : "Cargando imagen…"}
        </p>
      )}
      <div className="image-actions">
        <button type="button" onClick={() => hide(true)}>
          <EyeOff size={13} /> Ocultar imagen
        </button>
        {onReport && (
          <button type="button" onClick={onReport}>
            <Flag size={13} /> Reportar imagen
          </button>
        )}
      </div>
      {expanded && (
        <Modal
          title="Imagen compartida"
          wide
          onClose={() => setExpanded(false)}
        >
          <div className="modal-content expanded-image">
            <img
              src={src}
              alt={image.description || "Imagen compartida, sin descripción"}
            />
            {image.description && <p>{image.description}</p>}
            <div className="modal-actions">
              <a
                className="button secondary"
                href={src}
                download={`afinia-imagen.${extension}`}
              >
                Descargar imagen
              </a>
              <button
                type="button"
                className="button secondary"
                onClick={() => hide(true)}
              >
                Ocultar imagen
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
