import type { ReactNode } from "react";
import { Bell, BellOff, CheckCheck, ArrowRight } from "lucide-react";
import { Modal } from "../components";
import type { useNotices } from "./useNotices";
export function ThreadWatch({ following, muted, onToggle }: { following: boolean; muted: boolean; onToggle: () => void }) {
  return <div className="thread-watch">
    <span>{muted ? "Avisos silenciados para esta conversación" : following ? "Sigues las nuevas respuestas" : "Puedes seguir esta conversación"}</span>
    <button className="button text" onClick={onToggle}>{muted ? <Bell size={16} /> : following ? <BellOff size={16} /> : <Bell size={16} />}{muted ? "Reactivar avisos" : following ? "Silenciar conversación" : "Avisarme de nuevas respuestas"}</button>
  </div>;
}
export function NoticeCenter({ notices, signedIn, activeRoom, onAccess, onClose, onOpen, children }: {
  notices: ReturnType<typeof useNotices>;
  signedIn: boolean;
  activeRoom: boolean;
  onAccess: () => void;
  onClose: () => void;
  onOpen: (postId: string, commentId: string) => void;
  children?: ReactNode;
}) {
  return <Modal title="Notificaciones" wide onClose={onClose}>
    <div className="notice-center">
      <p className="notice-scope">La Plaza todavía es una maqueta local. Aquí puedes preparar tus preferencias y probar avisos identificados como ejemplo; no llegan interacciones de otras personas.</p>
      {!signedIn ? <div className="notice-empty"><Bell size={25} aria-hidden="true" /><h3>Entra para seguir tus conversaciones.</h3><button className="button primary" onClick={onAccess}>Ir al acceso</button></div> : <>
        <div className="notice-section-head"><h3>Actividad</h3>{notices.unread > 0 && <button className="button text" onClick={notices.readAll}><CheckCheck size={16} />Marcar todo como leído</button>}</div>
        {notices.visible.length ? <ul className="notice-list">{notices.visible.map(({ item, post, comment }) => <li key={`${item.postId}/${item.commentId}`} className={item.read ? "" : "notice-unread"}>
          <button className="notice-open" disabled={activeRoom} onClick={() => onOpen(post.id, comment.id)} aria-label={`Abrir aviso sobre ${post.title}`}>
            <span className="notice-kind">{item.example ? "Aviso de ejemplo" : "Nueva respuesta"}{!item.read && <span className="notice-dot" aria-label="Sin leer" />}</span>
            <strong>{post.title}</strong>
            <span>{item.example ? "Comentario preescrito de " : "Respuesta de "}{comment.author}. {comment.stickerId ? "Sticker" : comment.image ? "Imagen" : "Texto"}.</span>
            <span className="notice-link">Ver conversación <ArrowRight size={14} /></span>
          </button>
          <button className="button text" onClick={() => notices.toggle(post.id)} aria-label={`${notices.scope.muted.includes(post.id) ? "Reactivar avisos de" : "Silenciar avisos de"} ${post.title}`}>{notices.scope.muted.includes(post.id) ? <Bell size={15} /> : <BellOff size={15} />}{notices.scope.muted.includes(post.id) ? "Reactivar" : "Silenciar"}</button>
        </li>)}</ul> : <div className="notice-empty"><Bell size={25} aria-hidden="true" /><p>No tienes avisos nuevos.</p><span>Publicar o responder activa los avisos de esa conversación. Tus propias respuestas no generan notificaciones.</span></div>}
        {activeRoom && <p className="small-text muted">Puedes abrir la publicación al salir del encuentro.</p>}
        <section className="notice-following" aria-label="Conversaciones que sigues"><h3>Conversaciones que sigues</h3>{notices.watched.length ? <ul>{notices.watched.map(post => <li key={post.id}><span><strong>{post.title}</strong><small>{notices.scope.muted.includes(post.id) ? "Silenciada" : "Avisos activados"}</small></span><button className="button text" onClick={() => notices.toggle(post.id)} aria-label={`${notices.scope.muted.includes(post.id) ? "Reactivar avisos de" : "Silenciar avisos de"} ${post.title}`}>{notices.scope.muted.includes(post.id) ? <Bell size={17} /> : <BellOff size={17} />}{notices.scope.muted.includes(post.id) ? "Reactivar" : "Silenciar"}</button></li>)}</ul> : <p className="small-text muted">También puedes activar avisos desde el detalle de una publicación.</p>}</section>
        <details className="notice-demo"><summary>Probar las notificaciones de la maqueta</summary><p>La prueba sigue una conversación de ejemplo y crea un aviso local sobre un comentario preescrito. No publica una respuesta.</p><button className="button secondary" disabled={!notices.canExample} onClick={notices.example}>Probar un aviso de ejemplo</button>{!notices.canExample && <p>Los ejemplos disponibles ya se probaron o están silenciados. Puedes limpiar los avisos o reactivar una conversación.</p>}{notices.scope.items.length > 0 && <button className="button text" onClick={notices.clear}>Limpiar avisos</button>}</details>
      </>}
      {children}
    </div>
  </Modal>;
}
