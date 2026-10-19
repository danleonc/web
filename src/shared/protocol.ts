import type { Session } from "../room/engine";
export type SharedMessage = {
  id: string;
  clientId: string;
  senderId: string;
  name: string;
} & ({ type: "text"; text: string } | { type: "sticker"; stickerId: string });
export type SharedSnapshot = {
  type: "snapshot";
  me: string;
  roomKey: string;
  revision: number;
  now: number;
  session: Session;
  messages: SharedMessage[];
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
  | {
      type: "message";
      clientId: string;
      content:
        | { type: "text"; text: string }
        | { type: "sticker"; stickerId: string };
    };
