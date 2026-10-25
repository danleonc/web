import { useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { Avatar, Modal } from "../components";
import { plazaPeople } from "./data";
import type { PlazaInvitation } from "./data";
import type { Profile } from "../store";
export function InviteDialog({
  personId,
  postId,
  profile,
  onProfile,
  onClose,
  onSave,
}: {
  personId: string;
  postId: string;
  profile: Profile | null;
  onProfile: () => void;
  onClose: () => void;
  onSave: (invitation: PlazaInvitation) => void;
}) {
  const [note, setNote] = useState("");
  const person = plazaPeople.find((p) => p.id === personId)!;
  return (
    <Modal title={`Un punto en común con ${person.name}`} onClose={onClose}>
      <div className="modal-content invitation-dialog">
        <div className="invitation-person">
          <Avatar name={person.name} index={plazaPeople.indexOf(person)} />
          <div>
            <strong>{person.name}</strong>
            <span>Persona de ejemplo · {person.description}</span>
          </div>
        </div>
        <p>
          Una conversación puede empezar con algo que compartieron. Tú eliges si
          quieres dar ese paso.
        </p>
        <div className="inline-notice">
          <LockKeyhole size={18} />
          <span>
            El contacto requiere aceptación de ambas personas. Esta maqueta
            guarda tu invitación en el navegador; nadie la recibe y no se simula
            una respuesta.
          </span>
        </div>
        {profile ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSave({ personId, postId, note: note.trim() });
              onClose();
            }}
          >
            <label className="field-label" htmlFor="invitation-note">
              Un mensaje para empezar <span className="muted">(opcional)</span>
            </label>
            <textarea
              id="invitation-note"
              className="text-input"
              rows={3}
              maxLength={180}
              placeholder="Me dio curiosidad lo que compartiste sobre…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="modal-actions">
              <button
                className="button secondary"
                type="button"
                onClick={onClose}
              >
                Ahora no
              </button>
              <button className="button primary" type="submit">
                Guardar invitación de prueba <ArrowRight size={16} />
              </button>
            </div>
          </form>
        ) : (
          <>
            <p>
              Prepara un perfil de prueba para guardar esta intención. Puedes
              elegir un alias y compartir solo lo que quieras.
            </p>
            <button
              className="button primary"
              onClick={() => {
                onClose();
                onProfile();
              }}
            >
              Preparar mi perfil <ArrowRight size={16} />
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
