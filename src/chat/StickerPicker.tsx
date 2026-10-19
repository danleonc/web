import { useMemo, useState } from "react";
import { Clock3, Search, Send, Star, X } from "lucide-react";
import { Modal } from "../components";
import { normalizeSearch, stickerPacks, stickers } from "./stickers";
import type { Sticker, StickerPreferences } from "./stickers";

export function StickerPicker({
  preferences,
  onToggleFavorite,
  onSend,
  onClose,
}: {
  preferences: StickerPreferences;
  onToggleFavorite: (id: string) => void;
  onSend: (id: string) => void;
  onClose: () => void;
}) {
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Sticker | null>(null);
  const visible = useMemo(() => {
    const search = normalizeSearch(query.trim());
    const pool =
      category === "recent"
        ? preferences.recent.flatMap(
            (id) => stickers.find((s) => s.id === id) || [],
          )
        : stickers.filter(
            (s) =>
              category === "all" ||
              (category === "favorites"
                ? preferences.favorites.includes(s.id)
                : s.packId === category),
          );
    return pool.filter((s) =>
      normalizeSearch([s.label, s.packName, ...s.tags].join(" ")).includes(
        search,
      ),
    );
  }, [category, query, preferences]);
  return (
    <Modal title="Elige un sticker" wide onClose={onClose}>
      <div className="sticker-picker">
        <p className="sticker-intro">
          144 stickers propios · 12 colecciones. Elige uno y confirma antes de
          enviarlo.
        </p>
        <label className="sticker-search">
          <Search size={17} />
          <span className="sr-only">Buscar stickers</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busca una expresión: hola, abrazo, gatos…"
            autoComplete="off"
          />
          {query && (
            <button
              className="icon-button"
              aria-label="Limpiar búsqueda de stickers"
              onClick={() => setQuery("")}
            >
              <X size={15} />
            </button>
          )}
        </label>
        <div
          className="sticker-categories"
          aria-label="Colecciones de stickers"
        >
          <button
            className={category === "all" ? "chosen" : ""}
            aria-pressed={category === "all"}
            onClick={() => setCategory("all")}
          >
            Todos
          </button>
          <button
            className={category === "favorites" ? "chosen" : ""}
            aria-pressed={category === "favorites"}
            onClick={() => setCategory("favorites")}
          >
            <Star size={13} /> Favoritos
          </button>
          <button
            className={category === "recent" ? "chosen" : ""}
            aria-pressed={category === "recent"}
            onClick={() => setCategory("recent")}
          >
            <Clock3 size={13} /> Recientes
          </button>
          {stickerPacks.map((pack) => (
            <button
              key={pack.id}
              className={category === pack.id ? "chosen" : ""}
              aria-pressed={category === pack.id}
              onClick={() => setCategory(pack.id)}
            >
              {pack.name}
            </button>
          ))}
        </div>
        <p className="sticker-count" role="status">
          {visible.length}{" "}
          {visible.length === 1 ? "sticker disponible" : "stickers disponibles"}
        </p>
        <div className="sticker-results" aria-label="Stickers disponibles">
          {visible.length ? (
            <div className="sticker-grid">
              {visible.map((sticker) => (
                <div
                  className={`sticker-tile ${selected?.id === sticker.id ? "selected" : ""}`}
                  key={sticker.id}
                >
                  <button
                    className="sticker-choice"
                    aria-label={`Seleccionar sticker: ${sticker.label}`}
                    aria-pressed={selected?.id === sticker.id}
                    onClick={() => setSelected(sticker)}
                  >
                    <img
                      src={sticker.src}
                      alt=""
                      loading="lazy"
                      width="100"
                      height="96"
                    />
                    <span>{sticker.label}</span>
                  </button>
                  <button
                    className={`sticker-favorite ${preferences.favorites.includes(sticker.id) ? "saved" : ""}`}
                    aria-label={`${preferences.favorites.includes(sticker.id) ? "Quitar de favoritos" : "Agregar a favoritos"}: ${sticker.label}`}
                    aria-pressed={preferences.favorites.includes(sticker.id)}
                    onClick={() => onToggleFavorite(sticker.id)}
                  >
                    <Star
                      size={14}
                      fill={
                        preferences.favorites.includes(sticker.id)
                          ? "currentColor"
                          : "none"
                      }
                    />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="sticker-empty">
              <Star size={24} />
              <h3>
                {query
                  ? "No encontramos esa expresión"
                  : category === "favorites"
                    ? "Tus favoritos empiezan aquí"
                    : category === "recent"
                      ? "Aquí aparecerán los que envíes"
                      : "No hay stickers en esta colección"}
              </h3>
              <p>
                {category === "favorites" && !query
                  ? "Guarda un sticker con la estrella para tenerlo a mano."
                  : "Explora otra colección o cambia tu búsqueda."}
              </p>
              <button
                className="button secondary"
                onClick={() => {
                  setCategory("all");
                  setQuery("");
                }}
              >
                Explorar todos los stickers
              </button>
            </div>
          )}
        </div>
        <div className="sticker-preview" aria-label="Vista previa del sticker">
          {selected ? (
            <>
              <img
                src={selected.src}
                alt={`Vista previa: ${selected.label}`}
                width="64"
                height="61"
              />
              <div>
                <strong>{selected.label}</strong>
                <span>{selected.packName}</span>
              </div>
              <button
                className="button primary"
                onClick={() => onSend(selected.id)}
              >
                Enviar sticker <Send size={15} />
              </button>
            </>
          ) : (
            <p>
              Selecciona un sticker para ver la vista previa. Todavía no se
              enviará.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
