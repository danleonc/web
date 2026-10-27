import { useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { Avatar, Modal } from "../components";
import { plazaPeople } from "./data";
import type { PlazaInvitation } from "./data";
import type { PlazaPost } from "./data";
import { invitationSource } from "./invitations";
import { InvitationContext } from "./InvitationContext";
import type { Profile } from "../store";
export function InviteDialog({
  personId,
  postId,
  commentId,
  posts = [],
  blocked = [],
  onMeet,
  profile,
  onProfile,
  onClose,
  onSave,
}: {
  personId: string;
  postId: string;
  commentId?: string;
  posts?: PlazaPost[];
  blocked?: string[];
  onMeet?: (activityId: string) => void;
  profile: Profile | null;
  onProfile: () => void;
  onClose: () => void;
  onSave: (invitation: PlazaInvitation) => void;
}) {
  const [note, setNote] = useState("");
  const person = plazaPeople.find((p) => p.id === personId)!;
  const source = invitationSource(
    { personId, postId, commentId },
    posts,
    blocked,
  );
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
        <InvitationContext source={source} />
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
              onSave({
                personId,
                postId,
                note: note.trim(),
                ...(commentId ? { commentId } : {}),
              });
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
              placeholder={
                commentId
                  ? "Me gustó lo que comentaste sobre…"
                  : "Me dio curiosidad lo que compartiste sobre…"
              }
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
        {source && onMeet && (
          <div className="invitation-group-option">
            <p>También pueden descubrir este tema en un grupo pequeño.</p>
            <button
              type="button"
              className="button text"
              onClick={() => {
                onClose();
                onMeet(source.topic.activityId);
              }}
            >
              Ver encuentro relacionado <ArrowRight size={15} />
            </button>
            <span>La reserva la decide cada persona.</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
