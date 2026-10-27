import type { Session } from "../room/engine";
import type { SafetyView, ConductReason, Choice } from "../safety/rules";
import type { ImageRef } from "../media/types";
export type SharedMessage = {
  id: string;
  replyTo?: string;
  clientId: string;
  senderId: string;
  name: string;
} & (
  | { type: "text"; text: string }
  | { type: "sticker"; stickerId: string }
  | { type: "image"; image: ImageRef }
);
export type SharedSnapshot = {
  type: "snapshot";
  me: string;
  roomKey: string;
  revision: number;
  now: number;
  session: Session;
  messages: SharedMessage[];
  safety: SafetyView;
  hiddenImages: string[];
};
export type SharedEvent =
  | SharedSnapshot
  | { type: "error"; code: string; message: string }
  | { type: "ack"; clientId: string };
export type SharedCommand =
  | { type: "start" | "extend" | "next-question" | "leave" }
  | { type: "respond"; status: "ready" | "pass" | "listen" | "pending" }
  | { type: "typing"; active: boolean }
  | { type: "block"; participantId: string }
  | { type: "open-removal"; targetId: string; reason: ConductReason }
  | { type: "removal-vote"; ballotId: string; choice: Choice }
  | {
      type: "message";
      clientId: string;
      content: { replyTo?: string } & (
        | { type: "text"; text: string }
        | { type: "sticker"; stickerId: string }
        | { type: "image"; image: ImageRef });
    };
