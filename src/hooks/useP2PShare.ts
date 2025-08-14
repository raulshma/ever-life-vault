import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from "y-protocols/awareness";
import { supabase } from "@/integrations/supabase/client";
import {
  encryptData,
  decryptData,
  generateIV,
  base64ToArrayBuffer,
  uint8ArrayToBase64,
  base64ToUint8Array,
  arrayBufferToBase64,
  generateAesKey,
  exportAesKeyToBase64,
  importAesKeyFromBase64,
} from "@/lib/crypto";

type SignalMessage =
  | { t: "hello"; from: string }
  | { t: "offer"; from: string; to: string; sdp: string }
  | { t: "answer"; from: string; to: string; sdp: string }
  | { t: "ice"; from: string; to: string; candidate: any };

export type P2PShareOptions = {
  shareId: string;
  maxPeers: number;
  encryptionKey?: CryptoKey | null;
  debug?: boolean;
  enabled?: boolean;
};

export type P2PShareState = {
  connectedPeerIds: string[];
  participants: number;
  isRoomFull: boolean;
  isReady: boolean;
  error?: string;
  text: string;
  effectiveMaxPeers: number;
  isWithinCapacity: boolean;
  presencePeerIds: string[];
  typingPeerIds: string[];
  remoteCursors: { peerId: string; x: number; y: number; name?: string; color?: string; ts: number }[];
  isHost: boolean;
  roomLocked: boolean;
  kicked: boolean;
  chatMessages: { id: string; from: string; text: string; ts: number }[];
  /**
   * True when the room is locked and this client is not the host. In this state we do not
   * track presence or attempt to join, and the UI should present a blocked message.
   */
  blockedByLock?: boolean;
  /** True if the host ended the room. Hook will auto-leave when set. */
  ended?: boolean;
  /** Allowed actions for this client as resolved from room permissions */
  allowedActions?: string[];
};

type PeerRecord = {
  pc: RTCPeerConnection;
  dc?: RTCDataChannel;
};

// When participant count grows, switch to star topology where the host relays
// data to reduce full-mesh overhead. This threshold can be tuned.
const STAR_THRESHOLD = 5;
// Backpressure guard for slow peers: skip sends when the DC buffer is large
const MAX_BUFFERED_AMOUNT = 750_000; // ~0.75MB

function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:global.stun.twilio.com:3478"] },
  ];
  const turnUrls = (import.meta as any).env?.VITE_TURN_URL as string | undefined;
  const turnUsername = (import.meta as any).env?.VITE_TURN_USERNAME as string | undefined;
  const turnCredential = (import.meta as any).env?.VITE_TURN_CREDENTIAL as string | undefined;
  if (turnUrls && turnUsername && turnCredential) {
    const urlList = turnUrls.split(",").map((u) => u.trim()).filter(Boolean);
    if (urlList.length) {
      servers.push({ urls: urlList, username: turnUsername, credential: turnCredential });
    }
  }
  return servers;
}

export function useP2PShare({ shareId, maxPeers, encryptionKey, debug, enabled = true }: P2PShareOptions) {
  const [state, setState] = useState<P2PShareState>({
    connectedPeerIds: [],
    participants: 0,
    isRoomFull: false,
    isReady: false,
    text: "",
    effectiveMaxPeers: maxPeers,
    isWithinCapacity: false,
    presencePeerIds: [],
    typingPeerIds: [],
    remoteCursors: [],
    isHost: false,
    roomLocked: false,
    kicked: false,
    chatMessages: [],
    ended: false,
  });

  const myPeerId = useMemo(() => crypto.randomUUID(), []);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const peersRef = useRef<Map<string, PeerRecord>>(new Map());
  const latestTextRef = useRef<string>("");
  const broadcastTimerRef = useRef<number | null>(null);
  const isClosingRef = useRef(false);
  const didTrackRef = useRef(false);
  const effectiveMaxRef = useRef<number>(maxPeers);
  const withinCapacityRef = useRef<boolean>(false);
  const typingTimeoutRef = useRef<number | null>(null);
  const typingPeersRef = useRef<Set<string>>(new Set());
  const lastSeenRef = useRef<Map<string, number>>(new Map());
  const restartAttemptsRef = useRef<Map<string, number>>(new Map());
  const heartbeatIntervalRef = useRef<number | null>(null);
  const permissionsIntervalRef = useRef<number | null>(null);
  const roomLockedRef = useRef<boolean>(false);
  const ydocRef = useRef<any | null>(null);
  const ytextRef = useRef<any | null>(null);
  const awarenessRef = useRef<Awareness | null>(null);
  const cursorRafRef = useRef<number | null>(null);
  const lastCursorSentAtRef = useRef<number>(0);
  const denylistRef = useRef<Set<string>>(new Set());
  const hostIdRef = useRef<string | null>(null);
  const isHostRef = useRef<boolean>(false);
  const createdByUserIdRef = useRef<string | null>(null);
  const myUserIdRef = useRef<string | null>(null);
  const myDisplayNameRef = useRef<string>("Guest");
  const myColorRef = useRef<string>("hsl(var(--muted-foreground))");
  const participantsRef = useRef<number>(0);
  const encryptionKeyRef = useRef<CryptoKey | null>(encryptionKey ?? null);
  const allowedActionsRef = useRef<Set<string>>(new Set());
  // Dedup cache for chat messages to avoid double rendering when both P2P and Realtime deliver the same payload
  const chatSeenIdsRef = useRef<Set<string>>(new Set());
  const chatSeenQueueRef = useRef<string[]>([]);
  const rememberChatId = useCallback((id: string): boolean => {
    if (!id) return true;
    if (chatSeenIdsRef.current.has(id)) return false;
    chatSeenIdsRef.current.add(id);
    chatSeenQueueRef.current.push(id);
    // Trim to a bounded size to prevent unbounded memory growth
    if (chatSeenQueueRef.current.length > 2048) {
      const old = chatSeenQueueRef.current.shift();
      if (old) chatSeenIdsRef.current.delete(old);
    }
    return true;
  }, []);
  // keep ref in sync with prop
  useEffect(() => { encryptionKeyRef.current = encryptionKey ?? null; }, [encryptionKey]);

  // Utility: pick stable color from id
  const pickColorFromId = useCallback((id: string): string => {
    const palette = [
      'hsl(var(--destructive))',
      'hsl(var(--warning))',
      'hsl(var(--success))',
      'hsl(var(--info))',
      'hsl(var(--accent))',
      'hsl(var(--primary))',
    ];
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i) | 0;
    const idx = Math.abs(hash) % palette.length;
    return palette[idx];
  }, []);

  const log = useCallback(
    (...args: any[]) => {
      if (debug) console.log("[P2PShare]", ...args);
    },
    [debug]
  );

  const teardownPeer = useCallback((peerId: string) => {
    const rec = peersRef.current.get(peerId);
    if (!rec) return;
    try {
      rec.dc?.close();
    } catch {}
    try {
      rec.pc.close();
    } catch {}
    peersRef.current.delete(peerId);
    lastSeenRef.current.delete(peerId);
    setState((s) => ({
      ...s,
      connectedPeerIds: Array.from(peersRef.current.keys()),
    }));
  }, []);

  const isRoomAtCapacity = useCallback(() => {
    let presenceCount = 0;
    try {
      const stateObj = channelRef.current?.presenceState?.() as Record<string, unknown> | undefined;
      presenceCount = stateObj ? Object.keys(stateObj).length : 0;
    } catch {}
    // Fallback to at least my connection plus current P2P peers if presence isn't ready
    const connectedCount = new Set<string>([myPeerId, ...Array.from(peersRef.current.keys())]).size;
    const effectiveCount = Math.max(presenceCount, connectedCount);
    // Strictly greater than max indicates overflow; allow the last seat to connect
    return effectiveCount > (effectiveMaxRef.current || maxPeers);
  }, [maxPeers, myPeerId]);

  const sendEncrypted = useCallback(
    async (dc: RTCDataChannel, payload: any) => {
      // Backpressure: avoid overwhelming slow peers
      try {
        if (dc.bufferedAmount > MAX_BUFFERED_AMOUNT) {
          return;
        }
      } catch {}
      const key = encryptionKeyRef.current;
      if (!key) {
        dc.send(JSON.stringify(payload));
        return;
      }
      const iv = generateIV();
      const plaintext = JSON.stringify(payload);
      const { encryptedData, authTag } = await encryptData(plaintext, key, iv);
      const msg = {
        e: 1,
        d: arrayBufferToBase64(encryptedData),
        i: uint8ArrayToBase64(iv),
        a: uint8ArrayToBase64(authTag),
      } as const;
      dc.send(JSON.stringify(msg));
    },
    []
  );

  const isStarActive = useCallback(() => {
    return participantsRef.current >= STAR_THRESHOLD;
  }, []);

  const relayFromHost = useCallback(async (payload: any, excludePeerId?: string) => {
    // Only host relays in star mode
    if (!isHostRef.current || !isStarActive()) return;
    const relayed = { ...payload, relay: true };
    for (const [pid, rec] of peersRef.current.entries()) {
      if (pid === excludePeerId) continue;
      if (rec.dc && rec.dc.readyState === "open") {
        try {
          await sendEncrypted(rec.dc, relayed);
        } catch {}
      }
    }
  }, [isStarActive, sendEncrypted]);

  // Helper: recompute remote cursors from awareness states and push into React state
  const computeAndSetRemoteCursors = useCallback(() => {
    try {
      const awareness = awarenessRef.current as any;
      const map: Map<number, any> = (awareness?.getStates?.() ?? awareness?.states ?? new Map());
      const now = Date.now();
      const cursors: { peerId: string; x: number; y: number; name?: string; color?: string; ts: number }[] = [];
      map.forEach((st: any) => {
        const user = st?.user as { peerId?: string; name?: string; color?: string } | undefined;
        const cursor = st?.cursor as { x?: number; y?: number; ts?: number } | undefined;
        const peerId = user?.peerId;
        const x = Number(cursor?.x);
        const y = Number(cursor?.y);
        const ts = Number(cursor?.ts) || 0;
        if (!peerId || peerId === myPeerId) return;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        if (now - ts > 3000) return; // stale
        cursors.push({ peerId, x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)), name: user?.name, color: user?.color, ts });
      });
      cursors.sort((a, b) => (a.peerId < b.peerId ? -1 : 1));
      setState((s) => ({ ...s, remoteCursors: cursors }));
    } catch {}
  }, [myPeerId]);

  const sendWithRetry = useCallback(
    async (event: string, payload: any, attempt: number = 0): Promise<void> => {
      const channel = channelRef.current as any;
      if (!channel) return;
      try {
        await channel.send({ type: "broadcast", event, payload });
      } catch (e) {
        const next = attempt + 1;
        if (next > 3) return;
        const delay = Math.min(2000, 200 * Math.pow(2, attempt));
        await new Promise((r) => setTimeout(r, delay));
        return sendWithRetry(event, payload, next);
      }
    },
    []
  );

  const decodeIncoming = useCallback(
    async (raw: string): Promise<any | null> => {
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return null;
        if (!("e" in parsed)) return parsed; // plaintext
        const key = encryptionKeyRef.current;
        if (!key) return null; // encrypted but we lack key
        const decrypted = await decryptData(
          base64ToArrayBuffer((parsed as any).d),
          key,
          base64ToUint8Array((parsed as any).i),
          base64ToUint8Array((parsed as any).a)
        );
        return JSON.parse(decrypted);
      } catch (e) {
        log("decodeIncoming error", e);
        return null;
      }
    },
    [log]
  );

  const broadcastLocalText = useCallback(() => {
    if (broadcastTimerRef.current) {
      window.clearTimeout(broadcastTimerRef.current);
      broadcastTimerRef.current = null;
    }
    broadcastTimerRef.current = window.setTimeout(async () => {
      const text = latestTextRef.current;
      const payload = { type: "text", text, ts: Date.now(), from: myPeerId } as const;
      // Star mode: non-host sends only to host
      if (isStarActive() && !isHostRef.current) {
        const hostId = hostIdRef.current;
        const rec = hostId ? peersRef.current.get(hostId) : undefined;
        if (rec?.dc && rec.dc.readyState === "open") {
          await sendEncrypted(rec.dc, payload);
        }
      } else {
        for (const rec of peersRef.current.values()) {
          if (rec.dc && rec.dc.readyState === "open") {
            await sendEncrypted(rec.dc, payload);
          }
        }
      }
      // Realtime fallback: only if we are within capacity
      if (channelRef.current && withinCapacityRef.current) {
        try {
          const channel = channelRef.current as any;
          const stateObj = channel.presenceState?.() as Record<string, any[]> | undefined;
          const entries = Object.entries(stateObj || {}) as Array<[string, any[]]>;
          const ordered = entries
            .map(([key, metas]) => {
              let ja = Number.POSITIVE_INFINITY;
              for (const m of (metas || [])) {
                const v = Number(m?.joinedAt ?? m?.joined_at ?? Number.POSITIVE_INFINITY);
                if (v < ja) ja = v;
              }
              return { key, ja };
            })
            .sort((a, b) => (a.ja === b.ja ? (a.key < b.key ? -1 : 1) : a.ja - b.ja));
          const allow = ordered.slice(0, effectiveMaxRef.current || 2).map((x) => x.key);
          const wrapped = { type: "text", text, ts: Date.now(), from: myPeerId, allow } as const;
          if (encryptionKeyRef.current) {
            const iv = generateIV();
            const plaintext = JSON.stringify(wrapped);
            const { encryptedData, authTag } = await encryptData(plaintext, encryptionKeyRef.current, iv);
            const msg = {
              e: 1,
              d: arrayBufferToBase64(encryptedData),
              i: uint8ArrayToBase64(iv),
              a: uint8ArrayToBase64(authTag),
            } as const;
            await channel.send({ type: "broadcast", event: "text", payload: msg });
          } else {
            await channel.send({ type: "broadcast", event: "text", payload: wrapped });
          }
        } catch {}
      }
    }, 120);
  }, [sendEncrypted]);

  const broadcastTypingInternal = useCallback(
    async (isTyping: boolean) => {
      // P2P
      const payload = { type: "typing", isTyping, from: myPeerId, ts: Date.now() } as const;
      if (isStarActive() && !isHostRef.current) {
        const hostId = hostIdRef.current;
        const rec = hostId ? peersRef.current.get(hostId) : undefined;
        if (rec?.dc && rec.dc.readyState === "open") {
          try { await sendEncrypted(rec.dc, payload); } catch {}
        }
      } else {
        for (const rec of peersRef.current.values()) {
          if (rec.dc && rec.dc.readyState === "open") {
            try { await sendEncrypted(rec.dc, payload); } catch {}
          }
        }
      }
      // Fallback via Realtime within capacity
      if (channelRef.current && withinCapacityRef.current) {
        const channel = channelRef.current as any;
        const stateObj = channel.presenceState?.() as Record<string, any[]> | undefined;
        const entries = Object.entries(stateObj || {}) as Array<[string, any[]]>;
        const ordered = entries
          .map(([key, metas]) => {
            let ja = Number.POSITIVE_INFINITY;
            for (const m of metas || []) {
              const v = Number(m?.joinedAt ?? m?.joined_at ?? Number.POSITIVE_INFINITY);
              if (v < ja) ja = v;
            }
            return { key, ja };
          })
          .sort((a, b) => (a.ja === b.ja ? (a.key < b.key ? -1 : 1) : a.ja - b.ja));
       const allow = ordered.slice(0, effectiveMaxRef.current || 2).map((x) => x.key);
       const wrapped = { type: "typing", isTyping, ts: Date.now(), from: myPeerId, allow } as const;
       if (encryptionKeyRef.current) {
        const iv = generateIV();
        const plaintext = JSON.stringify(wrapped);
         const { encryptedData, authTag } = await encryptData(plaintext, encryptionKeyRef.current, iv);
        const msg = { e: 1, d: arrayBufferToBase64(encryptedData), i: uint8ArrayToBase64(iv), a: uint8ArrayToBase64(authTag) } as const;
        await sendWithRetry("text", msg);
      } else {
        await sendWithRetry("text", wrapped);
      }
      }
    },
    [myPeerId, sendEncrypted, sendWithRetry]
  );

  const setText = useCallback(
    (next: string) => {
      // Gating: guests require 'edit'
      if (!isHostRef.current) {
        const hasEdit = allowedActionsRef.current.has('edit');
        if (!hasEdit) return; // drop local edits when not allowed
      }
      // Prefer CRDT (Yjs) edits when available; fall back to legacy text broadcast otherwise
      const ytext = ytextRef.current as any;
      if (ytext) {
        const curr = ytext.toString();
        if (next !== curr) {
          ytext.delete(0, curr.length);
          ytext.insert(0, next);
        }
        // React state mirrors Yjs text via observer; still update local cache immediately
        latestTextRef.current = next;
      } else {
        latestTextRef.current = next;
        setState((s) => ({ ...s, text: next }));
        broadcastLocalText();
      }
      // typing indicator (throttled)
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
      void broadcastTypingInternal(true);
      typingTimeoutRef.current = window.setTimeout(() => {
        void broadcastTypingInternal(false);
        typingTimeoutRef.current = null;
      }, 1000);
    },
    [broadcastLocalText, broadcastTypingInternal]
  );

  const handleDataMessage = useCallback(
    async (ev: MessageEvent) => {
      const payload = await decodeIncoming(typeof ev.data === "string" ? ev.data : "");
      if (!payload || typeof payload !== "object") return;
      if ((payload as any).type === "rekey") {
        try {
          const b64 = (payload as any).k as string | undefined;
          if (b64) {
            const key = await importAesKeyFromBase64(b64, true);
            encryptionKeyRef.current = key;
            // telemetry: rekey
            try { void supabase.from("live_share_events" as any).insert({ room_id: shareId, event: "rekey", peer_id: myPeerId, encryption_enabled: true }); } catch {}
          }
        } catch {}
        return;
      }
      // Identify sender peer by matching datachannel
      let senderPeerId: string | undefined;
      for (const [pid, rec] of peersRef.current.entries()) {
        if (rec.dc === (ev.target as any)) { senderPeerId = pid; break; }
      }
      if ((payload as any).type === "y") {
        try {
          const uB64 = (payload as any).u as string;
          if (uB64) {
            const update = Uint8Array.from(atob(uB64), (c) => c.charCodeAt(0));
            const ydoc = ydocRef.current;
            if (ydoc) Y.applyUpdate(ydoc, update);
          }
        } catch {}
        // Host relays Y updates in star mode
        if (!('relay' in (payload as any)) && isHostRef.current && isStarActive()) {
          await relayFromHost({ ...(payload as any), from: (payload as any).from ?? senderPeerId }, senderPeerId);
        }
        return;
      }
      if ((payload as any).type === "aw") {
        try {
          const uB64 = (payload as any).u as string;
          if (uB64) {
            const update = Uint8Array.from(atob(uB64), (c) => c.charCodeAt(0));
            const aw = awarenessRef.current;
            if (aw) applyAwarenessUpdate(aw, update, "remote");
          }
        } catch {}
        if (!('relay' in (payload as any)) && isHostRef.current && isStarActive()) {
          await relayFromHost({ ...(payload as any), from: (payload as any).from ?? senderPeerId }, senderPeerId);
        }
        return;
      }
      if ((payload as any).type === "ping") {
        // Respond with pong to keepalive
        const from = (payload as any).from as string | undefined;
        const rec = from ? peersRef.current.get(from) : undefined;
        try {
          if (rec?.dc && rec.dc.readyState === "open") {
            await sendEncrypted(rec.dc, { type: "pong", ts: Date.now() });
          }
        } catch {}
        return;
      }
      if ((payload as any).type === "pong") {
        // Update heartbeat timestamp for the peer whose channel delivered the pong
        for (const [pid, rec] of peersRef.current.entries()) {
          if (rec.dc === (ev.target as any)) {
            lastSeenRef.current.set(pid, Date.now());
            break;
          }
        }
        return;
      }
      if ((payload as any).type === "text") {
        const incomingText = (payload as any).text as string;
        // Apply remote text only if it differs to avoid echo loops
        if (incomingText !== latestTextRef.current) {
          latestTextRef.current = incomingText;
          setState((s) => ({ ...s, text: incomingText }));
        }
        if (!('relay' in (payload as any)) && isHostRef.current && isStarActive()) {
          await relayFromHost({ ...(payload as any), from: (payload as any).from ?? senderPeerId }, senderPeerId);
        }
      }
      if ((payload as any).type === "typing") {
        const from = (payload as any).from as string | undefined;
        const isTyping = Boolean((payload as any).isTyping);
        if (from) {
          if (isTyping) typingPeersRef.current.add(from);
          else typingPeersRef.current.delete(from);
          setState((s) => ({ ...s, typingPeerIds: Array.from(typingPeersRef.current) }));
        }
        if (!('relay' in (payload as any)) && isHostRef.current && isStarActive()) {
          await relayFromHost({ ...(payload as any), from: (payload as any).from ?? senderPeerId }, senderPeerId);
        }
      }
      if ((payload as any).type === "chat") {
        const from = (payload as any).from as string | undefined;
        const text = (payload as any).text as string | undefined;
        const ts = Number((payload as any).ts) || Date.now();
        // Prefer stable id if present; otherwise derive a deterministic key from content to dedup
        const incomingId = String((payload as any).id ?? `${from ?? ""}:${ts}:${text ?? ""}`);
        if (text && from && rememberChatId(incomingId)) {
          const msg = { id: incomingId, from, text, ts };
          setState((s) => ({ ...s, chatMessages: [...s.chatMessages, msg] }));
        }
        if (!('relay' in (payload as any)) && isHostRef.current && isStarActive()) {
          await relayFromHost({ ...(payload as any), from: (payload as any).from ?? senderPeerId }, senderPeerId);
        }
      }
    },
    [decodeIncoming, isStarActive, relayFromHost, rememberChatId]
  );

  const handleBroadcastText = useCallback(
    async (rawPayload: any) => {
      try {
        let decoded: any = rawPayload;
        if (rawPayload && typeof rawPayload === "object" && "e" in rawPayload) {
          if (!encryptionKeyRef.current) return; // Encrypted but we lack key
          const decrypted = await decryptData(
            base64ToArrayBuffer((rawPayload as any).d),
            encryptionKeyRef.current,
            base64ToUint8Array((rawPayload as any).i),
            base64ToUint8Array((rawPayload as any).a)
          );
          decoded = JSON.parse(decrypted);
        }
        if (!decoded || typeof decoded !== "object") return;
        if ((decoded as any).type === "rekey") {
          try {
            const b64 = (decoded as any).k as string | undefined;
            if (b64) {
              const key = await importAesKeyFromBase64(b64, true);
              encryptionKeyRef.current = key;
              try { void supabase.from("live_share_events" as any).insert({ room_id: shareId, event: "rekey", peer_id: myPeerId, encryption_enabled: true }); } catch {}
            }
          } catch {}
          return;
        }
        if ((decoded as any).type === "y") {
          if (!withinCapacityRef.current) return;
          const uB64 = (decoded as any).u as string;
          if (uB64) {
            try {
              const update = Uint8Array.from(atob(uB64), (c) => c.charCodeAt(0));
              const ydoc = ydocRef.current;
              if (ydoc) Y.applyUpdate(ydoc, update);
            } catch {}
          }
          return;
        }
        if ((decoded as any).type === "aw") {
          if (!withinCapacityRef.current) return;
          const uB64 = (decoded as any).u as string;
          if (uB64) {
            try {
              const update = Uint8Array.from(atob(uB64), (c) => c.charCodeAt(0));
              const aw = awarenessRef.current;
              if (aw) applyAwarenessUpdate(aw, update, "remote");
            } catch {}
          }
          return;
        }
        if ((decoded as any).type === "text") {
          const allow = (decoded as any).allow as string[] | undefined;
          if (Array.isArray(allow) && !allow.includes(myPeerId)) return;
          const incomingText = (decoded as any).text as string;
          if (incomingText !== latestTextRef.current) {
            latestTextRef.current = incomingText;
            setState((s) => ({ ...s, text: incomingText }));
          }
          return;
        }
        if ((decoded as any).type === "typing") {
          const from = (decoded as any).from as string | undefined;
          const isTyping = Boolean((decoded as any).isTyping);
          const allow = (decoded as any).allow as string[] | undefined;
          if (from && (!Array.isArray(allow) || allow.includes(myPeerId))) {
            if (isTyping) typingPeersRef.current.add(from);
            else typingPeersRef.current.delete(from);
            setState((s) => ({ ...s, typingPeerIds: Array.from(typingPeersRef.current) }));
          }
          return;
        }
        if ((decoded as any).type === "chat") {
          const allow = (decoded as any).allow as string[] | undefined;
          if (Array.isArray(allow) && !allow.includes(myPeerId)) return;
          const from = (decoded as any).from as string | undefined;
          const text = (decoded as any).text as string | undefined;
          const ts = Number((decoded as any).ts) || Date.now();
          const incomingId = String((decoded as any).id ?? `${from ?? ""}:${ts}:${text ?? ""}`);
          if (text && from && rememberChatId(incomingId)) {
            const msg = { id: incomingId, from, text, ts };
            setState((s) => ({ ...s, chatMessages: [...s.chatMessages, msg] }));
          }
          return;
        }
      } catch (e) {
        log("handleBroadcastText error", e);
      }
    },
    [log, myPeerId, rememberChatId]
  );

  const createPeer = useCallback(
    (remoteId: string) => {
      if (peersRef.current.has(remoteId)) return peersRef.current.get(remoteId)!;
      const pc = new RTCPeerConnection({ iceServers: buildIceServers() });
      const record: PeerRecord = { pc };
      peersRef.current.set(remoteId, record);

      pc.onconnectionstatechange = () => {
        log("pc state", remoteId, pc.connectionState);
        if (pc.connectionState === "connected") {
          restartAttemptsRef.current.set(remoteId, 0);
          lastSeenRef.current.set(remoteId, Date.now());
        }
        if (["disconnected", "failed"].includes(pc.connectionState)) {
          const attempts = restartAttemptsRef.current.get(remoteId) || 0;
          if (attempts < 3) {
            restartAttemptsRef.current.set(remoteId, attempts + 1);
            const delay = Math.min(2000, 300 * Math.pow(2, attempts));
            setTimeout(() => {
              void performIceRestart(remoteId);
            }, delay);
          } else {
            teardownPeer(remoteId);
          }
        }
        if (pc.connectionState === "closed") {
          teardownPeer(remoteId);
        }
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          const msg: SignalMessage = { t: "ice", from: myPeerId, to: remoteId, candidate: e.candidate };
          void sendWithRetry("signal", msg);
        }
      };

      // Improve connectivity when direct candidates fail
      try {
        pc.getTransceivers?.().forEach((t) => {
          try {
            // Ensure data direction
            if (t?.direction && t.direction !== "inactive") return;
          } catch {}
        });
      } catch {}

      pc.ondatachannel = (ev) => {
        record.dc = ev.channel;
        record.dc.onmessage = handleDataMessage;
        record.dc.onopen = async () => {
          setState((s) => ({ ...s, connectedPeerIds: Array.from(peersRef.current.keys()) }));
          // Send current CRDT state upon establishing the channel to ensure initial sync
          try {
            const ydoc = ydocRef.current as any;
            if (ydoc) {
              const update = Y.encodeStateAsUpdate(ydoc);
              const uB64 = btoa(String.fromCharCode(...update));
              await sendEncrypted(record.dc!, { type: "y", u: uB64, ts: Date.now() });
            } else {
              await sendEncrypted(record.dc!, { type: "text", text: latestTextRef.current, ts: Date.now() });
            }
          } catch {}
          lastSeenRef.current.set(remoteId, Date.now());
        };
        record.dc.onclose = () => teardownPeer(remoteId);
      };

      setState((s) => ({ ...s, connectedPeerIds: Array.from(peersRef.current.keys()) }));
      return record;
    },
    [handleDataMessage, log, myPeerId, teardownPeer]
  );

  const createOffer = useCallback(
    async (remoteId: string) => {
      const rec = createPeer(remoteId);
      if (!rec.dc) {
        rec.dc = rec.pc.createDataChannel("text");
        rec.dc.onmessage = handleDataMessage;
        rec.dc.onopen = async () => {
          setState((s) => ({ ...s, connectedPeerIds: Array.from(peersRef.current.keys()) }));
          // Send current CRDT state upon establishing the channel to ensure initial sync
          try {
            const ydoc = ydocRef.current as any;
            if (ydoc) {
              const update = Y.encodeStateAsUpdate(ydoc);
              const uB64 = btoa(String.fromCharCode(...update));
              await sendEncrypted(rec.dc!, { type: "y", u: uB64, ts: Date.now() });
            } else {
              await sendEncrypted(rec.dc!, { type: "text", text: latestTextRef.current, ts: Date.now() });
            }
          } catch {}
          lastSeenRef.current.set(remoteId, Date.now());
        };
        rec.dc.onclose = () => teardownPeer(remoteId);
      }
      const offer = await rec.pc.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
      await rec.pc.setLocalDescription(offer);
      const msg: SignalMessage = {
        t: "offer",
        from: myPeerId,
        to: remoteId,
        sdp: JSON.stringify(rec.pc.localDescription),
      };
      void sendWithRetry("signal", msg);
    },
    [createPeer, handleDataMessage, myPeerId, teardownPeer]
  );

  const performIceRestart = useCallback(
    async (remoteId: string) => {
      const rec = createPeer(remoteId);
      try {
        const offer = await rec.pc.createOffer({ iceRestart: true });
        await rec.pc.setLocalDescription(offer);
        const msg: SignalMessage = {
          t: "offer",
          from: myPeerId,
          to: remoteId,
          sdp: JSON.stringify(rec.pc.localDescription),
        };
        await sendWithRetry("signal", msg);
      } catch (e) {
        log("performIceRestart error", e);
      }
    },
    [createPeer, log, myPeerId, sendWithRetry]
  );

  const handleSignal = useCallback(
    async (msg: SignalMessage) => {
      if (msg.from === myPeerId) return;
      if ("to" in msg && msg.to !== myPeerId) return;
      if (msg.t === "hello") {
        // In star mode, only the host responds to hellos by initiating offers
        if (isStarActive() && !isHostRef.current) {
          return;
        }
        // Enforce room capacity from our own view; ignore new peers if full
        if (isRoomAtCapacity() || roomLockedRef.current || denylistRef.current.has(msg.from)) {
          log("ignoring hello from", msg.from, "room at capacity");
          return;
        }
        // Existing peers always initiate offer upon hello to ensure connection establishment
        await createOffer(msg.from);
        return;
      }
      if (msg.t === "offer") {
        if ((isRoomAtCapacity() || roomLockedRef.current || denylistRef.current.has(msg.from)) && !peersRef.current.has(msg.from)) {
          log("ignoring offer from", msg.from, "room at capacity");
          return;
        }
        // In star mode, non-hosts accept offers only from the host
        if (isStarActive() && !isHostRef.current) {
          const hostId = hostIdRef.current;
          if (hostId && msg.from !== hostId) {
            log("ignoring non-host offer from", msg.from);
            return;
          }
        }
        const rec = createPeer(msg.from);
        const desc = JSON.parse(msg.sdp);
        await rec.pc.setRemoteDescription(desc);
        const answer = await rec.pc.createAnswer();
        await rec.pc.setLocalDescription(answer);
        const resp: SignalMessage = {
          t: "answer",
          from: myPeerId,
          to: msg.from,
          sdp: JSON.stringify(rec.pc.localDescription),
        };
        void sendWithRetry("signal", resp);
        return;
      }
      if (msg.t === "answer") {
        const rec = createPeer(msg.from);
        const desc = JSON.parse(msg.sdp);
        await rec.pc.setRemoteDescription(desc);
        return;
      }
      if (msg.t === "ice") {
        // In star mode, non-hosts process ICE only from host
        if (isStarActive() && !isHostRef.current) {
          const hostId = hostIdRef.current;
          if (hostId && msg.from !== hostId) return;
        }
        const rec = createPeer(msg.from);
        try {
          await rec.pc.addIceCandidate(msg.candidate);
        } catch (e) {
          log("addIceCandidate error", e);
        }
      }
    },
    [createOffer, createPeer, log, myPeerId, sendWithRetry, isStarActive]
  );

  const leave = useCallback(async () => {
    isClosingRef.current = true;
    try {
      // If I am the host, broadcast end and cleanup server-side
      if (isHostRef.current) {
        try {
          await sendWithRetry("room", { end: true, fromUserId: myUserIdRef.current });
        } catch {}
        try {
          const { data: sess } = await supabase.auth.getSession();
          const uid = sess?.session?.user?.id ?? null;
          if (uid && myUserIdRef.current === uid) {
            try { await (supabase as any).rpc("end_live_share", { _id: shareId }); } catch {}
          }
        } catch {}
      }
      for (const id of Array.from(peersRef.current.keys())) teardownPeer(id);
      await channelRef.current?.untrack();
      await channelRef.current?.unsubscribe();
    } catch {}
    channelRef.current = null;
    setState((s) => ({ ...s, connectedPeerIds: [], participants: 0, isRoomFull: false }));
  }, [sendWithRetry, shareId, teardownPeer]);

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase.channel(`share:${shareId}`, {
      config: {
        // Ask server to ack broadcasts for reliability per Supabase docs
        broadcast: { ack: true },
        presence: { key: myPeerId },
      },
    });
    channelRef.current = channel as any;

    channel.on("broadcast", { event: "signal" }, ({ payload }) => {
      handleSignal(payload as SignalMessage);
    });

    // Listen to text broadcasts but apply allowlist and capacity checks client-side.
    channel.on("broadcast", { event: "text" }, ({ payload }) => {
      handleBroadcastText(payload);
    });
    // CRDT broadcasts
    channel.on("broadcast", { event: "y" }, ({ payload }) => {
      handleBroadcastText(payload);
    });
    channel.on("broadcast", { event: "aw" }, ({ payload }) => {
      handleBroadcastText(payload);
    });
    channel.on("broadcast", { event: "key" }, ({ payload }) => {
      handleBroadcastText(payload);
    });
    // Room control
    channel.on("broadcast", { event: "room" }, ({ payload }) => {
      try {
        const p = payload as any;
        if (!p || typeof p !== "object") return;
        // Only honor room-control messages from the creator; if creator unknown, ignore
        const fromUserId = (p as any).fromUserId as string | undefined;
        if (!createdByUserIdRef.current) return;
        if (!fromUserId || fromUserId !== createdByUserIdRef.current) return;
        if (Object.prototype.hasOwnProperty.call(p, "locked")) {
          roomLockedRef.current = Boolean(p.locked);
          setState((s) => ({ ...s, roomLocked: roomLockedRef.current }));
        }
        if (Object.prototype.hasOwnProperty.call(p, "end") && p.end) {
          setState((s) => ({ ...s, ended: true }));
          void leave();
          return;
        }
        if (Array.isArray((p as any).kick)) {
          const ids = (p as any).kick as string[];
          for (const id of ids) denylistRef.current.add(id);
          if (ids.includes(myPeerId)) {
            setState((s) => ({ ...s, kicked: true }));
            void leave();
          }
        }
      } catch {}
    });

    channel.on("presence", { event: "sync" }, async () => {
      const stateObj = channel.presenceState() as Record<string, any[]> | undefined;
      const peerIds = Object.keys(stateObj || {});

      // Determine host: the peer whose presence meta.userId equals the room creator
      let hostId: string | null = null;
      let hostJoinedAt = Number.POSITIVE_INFINITY;
      let hostMax: number | null = null;
      const creatorId = createdByUserIdRef.current;
      if (stateObj && creatorId) {
        for (const [key, metas] of Object.entries(stateObj)) {
          const arr = Array.isArray(metas) ? metas : [];
          for (const m of arr) {
            const userId = (m as any)?.userId as string | undefined;
            if (userId !== creatorId) continue;
            const ja = Number(m?.joinedAt ?? (m as any)?.joined_at ?? Number.POSITIVE_INFINITY);
            const mMax = Number((m as any)?.maxPeersLocal ?? (m as any)?.max_peers_local ?? NaN);
            if (ja < hostJoinedAt || (ja === hostJoinedAt && (hostId === null || key < hostId))) {
              hostId = key;
              hostJoinedAt = ja;
              hostMax = Number.isFinite(mMax) ? mMax : hostMax;
            }
          }
        }
      }
      // If creator is not present, do not elect any fallback host
      const derivedEffectiveMax = Math.min(8, Math.max(2, Number(hostMax ?? maxPeers)));
      effectiveMaxRef.current = derivedEffectiveMax;

      // Determine capacity membership for this client using ordering by joinedAt then id
      let myJoinedAt = Number.POSITIVE_INFINITY;
      if (stateObj && stateObj[myPeerId]) {
        const metas = stateObj[myPeerId] || [];
        for (const m of metas) {
          const ja = Number(m?.joinedAt ?? m?.joined_at ?? Number.POSITIVE_INFINITY);
          if (ja < myJoinedAt) myJoinedAt = ja;
        }
      }
      const ordered = (Object.entries(stateObj || {}) as Array<[string, any[]]>)
        .map(([key, metas]) => {
          let ja = Number.POSITIVE_INFINITY;
          for (const m of (metas || [])) {
            const v = Number(m?.joinedAt ?? m?.joined_at ?? Number.POSITIVE_INFINITY);
            if (v < ja) ja = v;
          }
          return { key, ja };
        })
        .sort((a, b) => (a.ja === b.ja ? (a.key < b.key ? -1 : 1) : a.ja - b.ja));
      const withinCapacityKeys = ordered.slice(0, derivedEffectiveMax).map((x) => x.key);
      const isWithinCapacity = withinCapacityKeys.includes(myPeerId);

      withinCapacityRef.current = isWithinCapacity;
      participantsRef.current = peerIds.length;
      // Host is strictly the creator
      isHostRef.current = Boolean(myUserIdRef.current && creatorId && myUserIdRef.current === creatorId);
      hostIdRef.current = hostId;
      setState((s) => ({
        ...s,
        participants: peerIds.length,
        effectiveMaxPeers: derivedEffectiveMax,
        isWithinCapacity,
        isHost: isHostRef.current,
        presencePeerIds: peerIds,
      }));
      // In star mode, non-host should keep only connection to host
      if (isStarActive() && !isHostRef.current && hostIdRef.current) {
        for (const pid of Array.from(peersRef.current.keys())) {
          if (pid !== hostIdRef.current) {
            teardownPeer(pid);
          }
        }
      }
      const isMember = peerIds.includes(myPeerId);
      const roomFull = peerIds.length >= derivedEffectiveMax && !isMember;
      if (roomFull && !isClosingRef.current) {
        setState((s) => ({ ...s, isRoomFull: true }));
        return;
      }
      // Do not join presence if room is locked and we are not the host (detected only when we know identities)
      if (
        roomLockedRef.current &&
        createdByUserIdRef.current &&
        myUserIdRef.current &&
        myUserIdRef.current !== createdByUserIdRef.current &&
        !didTrackRef.current
      ) {
        setState((s) => ({ ...s, blockedByLock: true }));
        return;
      }
      // Track presence if not yet tracked, include our local max, and announce
      if (!didTrackRef.current) {
        try {
          await channel.track({ joinedAt: Date.now(), maxPeersLocal: maxPeers, userId: myUserIdRef.current });
          didTrackRef.current = true;
          const hello: SignalMessage = { t: "hello", from: myPeerId };
          void sendWithRetry("signal", hello);
        } catch (e) {
          // ignore
        }
      }
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        setState((s) => ({ ...s, isReady: true }));
        // telemetry: join
        try {
          void supabase
            .from("live_share_events" as any)
            .insert({ room_id: shareId, event: "join", peer_id: myPeerId, encryption_enabled: Boolean(encryptionKeyRef.current) });
        } catch {}
        // Fetch authoritative room config; fall back to URL max if not found
        try {
          // Capture my user id for host resolution
          try {
            const { data: sess } = await supabase.auth.getSession();
            myUserIdRef.current = sess?.session?.user?.id ?? null;
          } catch {}
          const { data } = await supabase
            .from("live_share_rooms_public" as any)
            .select("max_peers, locked, expires_at, created_by")
            .eq("id", shareId)
            .maybeSingle();
          if (data) {
            const hostMax = Number((data as any).max_peers);
            const derivedEffectiveMax = Math.min(8, Math.max(2, Number.isFinite(hostMax) ? hostMax : maxPeers));
            effectiveMaxRef.current = derivedEffectiveMax;
            const locked = Boolean((data as any).locked);
            roomLockedRef.current = locked;
            setState((s) => ({ ...s, effectiveMaxPeers: derivedEffectiveMax, roomLocked: locked }));
            const expiresAt = (data as any).expires_at as string | null;
            if (expiresAt) {
              const expired = Date.now() > new Date(expiresAt).getTime();
              if (expired) {
                roomLockedRef.current = true;
                setState((s) => ({ ...s, roomLocked: true }));
              }
            }
            createdByUserIdRef.current = (data as any)?.created_by ?? null;
          }
        } catch {}
        // Fetch permissions for this room and set allowed actions
        try {
          const res = await fetch(`/live-share/rooms/${shareId}/permissions`, { method: 'GET' });
          const json = await res.json();
          if (res.ok && json?.items) {
            const set = new Set<string>();
            for (const it of (json.items as any[])) {
              const grantedTo = (it as any)?.granted_to as string | undefined;
              if (grantedTo && (grantedTo === 'guests' || grantedTo === 'all')) {
                const acts: string[] = Array.isArray((it as any)?.actions) ? (it as any).actions : [];
                for (const a of acts) set.add(String(a));
              }
            }
            allowedActionsRef.current = set;
            setState((s) => ({ ...s, allowedActions: Array.from(set) }));
          }
        } catch {}
        // Periodically refresh permissions to reflect host changes
        try {
          if (permissionsIntervalRef.current) window.clearInterval(permissionsIntervalRef.current);
          permissionsIntervalRef.current = window.setInterval(async () => {
            try {
              const res = await fetch(`/live-share/rooms/${shareId}/permissions`, { method: 'GET' });
              const json = await res.json();
              if (res.ok && json?.items) {
                const set = new Set<string>();
                for (const it of (json.items as any[])) {
                  const grantedTo = (it as any)?.granted_to as string | undefined;
                  if (grantedTo && (grantedTo === 'guests' || grantedTo === 'all')) {
                    const acts: string[] = Array.isArray((it as any)?.actions) ? (it as any).actions : [];
                    for (const a of acts) set.add(String(a));
                  }
                }
                const next = Array.from(set);
                // Only update state if changed to avoid renders
                setState((s) => {
                  const prev = Array.isArray(s.allowedActions) ? s.allowedActions.join('|') : '';
                  const curr = next.join('|');
                  if (prev === curr) return s;
                  allowedActionsRef.current = set;
                  return { ...s, allowedActions: next };
                });
              }
            } catch {}
          }, 5000);
        } catch {}
        // tracking will be decided on first presence sync
      }
    });

    const onBeforeUnload = () => {
      if (channel) channel.untrack();
      for (const id of Array.from(peersRef.current.keys())) teardownPeer(id);
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    // Heartbeat to detect half-open channels
    if (heartbeatIntervalRef.current) window.clearInterval(heartbeatIntervalRef.current);
    heartbeatIntervalRef.current = window.setInterval(async () => {
      const now = Date.now();
      for (const [pid, rec] of peersRef.current.entries()) {
        try {
          if (rec.dc && rec.dc.readyState === "open") {
            await sendEncrypted(rec.dc, { type: "ping", ts: now, from: myPeerId });
          }
        } catch {}
        const last = lastSeenRef.current.get(pid) || 0;
        if (now - last > 8000) {
          const attempts = restartAttemptsRef.current.get(pid) || 0;
          if (attempts < 3) {
            restartAttemptsRef.current.set(pid, attempts + 1);
            void performIceRestart(pid);
          }
        }
      }
    }, 3000);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (heartbeatIntervalRef.current) {
        window.clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      if (permissionsIntervalRef.current) {
        window.clearInterval(permissionsIntervalRef.current);
        permissionsIntervalRef.current = null;
      }
      // telemetry: leave
       try { void supabase.from("live_share_events" as any).insert({ room_id: shareId, event: "leave", peer_id: myPeerId, encryption_enabled: Boolean(encryptionKeyRef.current) }); } catch {}
      leave();
    };
  }, [enabled, shareId, myPeerId, maxPeers, handleSignal, leave, teardownPeer, performIceRestart, sendEncrypted, sendWithRetry]);

  // Initialize Yjs doc/awareness once
  useEffect(() => {
    if (ydocRef.current) return;
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("content");
    const awareness = new Awareness(ydoc);
    ydocRef.current = ydoc;
    ytextRef.current = ytext;
    awarenessRef.current = awareness;

    // Observe text to reflect into React state
    const updateStateFromDoc = () => {
      const txt = ytext.toString();
      latestTextRef.current = txt;
      setState((s) => ({ ...s, text: txt }));
    };
    ytext.observe(() => updateStateFromDoc());
    updateStateFromDoc();

    // Broadcast yjs doc updates
    ydoc.on("update", async (update: Uint8Array) => {
      const uB64 = btoa(String.fromCharCode(...update));
      for (const rec of peersRef.current.values()) {
        if (rec.dc && rec.dc.readyState === "open") {
          try {
            await sendEncrypted(rec.dc, { type: "y", u: uB64, ts: Date.now() });
          } catch {}
        }
      }
      // Fallback via Realtime within capacity
      if (channelRef.current && withinCapacityRef.current) {
        try {
          const payload = { type: "y", u: uB64, ts: Date.now() };
          if (encryptionKeyRef.current) {
            const iv = generateIV();
            const plaintext = JSON.stringify(payload);
            const { encryptedData, authTag } = await encryptData(plaintext, encryptionKeyRef.current, iv);
            const msg = { e: 1, d: arrayBufferToBase64(encryptedData), i: uint8ArrayToBase64(iv), a: uint8ArrayToBase64(authTag) } as const;
            await sendWithRetry("y", msg);
          } else {
            await sendWithRetry("y", payload);
          }
        } catch {}
      }
    });

    // Broadcast awareness updates (e.g., typing/cursor)
    awareness.on("update", async ({ added, updated, removed }: any) => {
      const changed = (added as number[]).concat(updated as number[]).concat(removed as number[]);
      if (!changed.length) return;
      const update = encodeAwarenessUpdate(awareness, changed);
      const uB64 = btoa(String.fromCharCode(...update));
      for (const rec of peersRef.current.values()) {
        if (rec.dc && rec.dc.readyState === "open") {
          try {
            await sendEncrypted(rec.dc, { type: "aw", u: uB64, ts: Date.now() });
          } catch {}
        }
      }
      if (channelRef.current && withinCapacityRef.current) {
        try {
          const payload = { type: "aw", u: uB64, ts: Date.now() };
          if (encryptionKeyRef.current) {
            const iv = generateIV();
            const plaintext = JSON.stringify(payload);
            const { encryptedData, authTag } = await encryptData(plaintext, encryptionKeyRef.current, iv);
            const msg = { e: 1, d: arrayBufferToBase64(encryptedData), i: uint8ArrayToBase64(iv), a: uint8ArrayToBase64(authTag) } as const;
            await sendWithRetry("aw", msg);
          } else {
            await sendWithRetry("aw", payload);
          }
        } catch {}
      }
      computeAndSetRemoteCursors();
    });

    return () => {
      try { ydoc.destroy(); } catch {}
    };
  }, [sendEncrypted, sendWithRetry, computeAndSetRemoteCursors]);

  // Initialize identity and base presence in awareness
  useEffect(() => {
    const run = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const email = data?.session?.user?.email ?? undefined;
        const name = data?.session?.user?.user_metadata?.full_name ?? email ?? 'Guest';
        myDisplayNameRef.current = String(name);
      } catch {}
      const color = pickColorFromId(myPeerId);
      myColorRef.current = color;
      const aw = awarenessRef.current as any;
      if (aw?.setLocalState) {
        const prev = aw.getLocalState?.() ?? {};
        aw.setLocalState({ ...prev, user: { peerId: myPeerId, name: myDisplayNameRef.current, color }, cursor: null });
      }
    };
    run();
  }, [myPeerId, pickColorFromId]);

  return {
    state,
    setText,
    leave,
    // Presence helpers
    setPresenceIdentity: (name?: string, color?: string) => {
      if (typeof name === 'string' && name.trim()) myDisplayNameRef.current = name.trim();
      if (typeof color === 'string' && color.trim()) myColorRef.current = color.trim();
      const aw = awarenessRef.current as any;
      if (aw?.setLocalState) {
        const prev = aw.getLocalState?.() ?? {};
        aw.setLocalState({ ...prev, user: { peerId: myPeerId, name: myDisplayNameRef.current, color: myColorRef.current } });
      }
    },
    setCursorNormalized: (x: number, y: number) => {
      const aw = awarenessRef.current as any;
      if (!aw?.setLocalState) return;
      const nx = Math.max(0, Math.min(1, Number(x)));
      const ny = Math.max(0, Math.min(1, Number(y)));
      const now = performance.now();
      const send = () => {
        const prev = aw.getLocalState?.() ?? {};
        aw.setLocalState({ ...prev, cursor: { x: nx, y: ny, ts: Date.now() } });
        lastCursorSentAtRef.current = now;
        if (cursorRafRef.current) {
          cancelAnimationFrame(cursorRafRef.current);
          cursorRafRef.current = null;
        }
      };
      if (now - lastCursorSentAtRef.current < 30) {
        if (!cursorRafRef.current) cursorRafRef.current = requestAnimationFrame(send);
        return;
      }
      send();
    },
    clearCursor: () => {
      const aw = awarenessRef.current as any;
      if (!aw?.setLocalState) return;
      const prev = aw.getLocalState?.() ?? {};
      aw.setLocalState({ ...prev, cursor: null });
    },
    exportSnapshot: async (): Promise<{ yUpdateB64: string | null; text: string }> => {
      try {
        const ydoc = ydocRef.current as any;
        if (ydoc) {
          const update = Y.encodeStateAsUpdate(ydoc);
          const uB64 = btoa(String.fromCharCode(...update));
          return { yUpdateB64: uB64, text: ytextRef.current?.toString?.() ?? latestTextRef.current };
        }
      } catch {}
      return { yUpdateB64: null, text: latestTextRef.current };
    },
    importSnapshot: async (payload: { yUpdateB64?: string | null; text?: string }) => {
      try {
        if (!isHostRef.current) {
          const hasImport = allowedActionsRef.current.has('import');
          if (!hasImport) return;
        }
        const { yUpdateB64, text } = payload || {} as any;
        const ydoc = ydocRef.current as any;
        if (ydoc && yUpdateB64) {
          const update = Uint8Array.from(atob(yUpdateB64), (c) => c.charCodeAt(0));
          Y.applyUpdate(ydoc, update);
          // Broadcast imported state to peers for fast convergence
          const recs = Array.from(peersRef.current.values());
          for (const rec of recs) {
            if (rec.dc && rec.dc.readyState === "open") {
              try {
                await sendEncrypted(rec.dc, { type: "y", u: yUpdateB64, ts: Date.now(), from: myPeerId });
              } catch {}
            }
          }
      if (channelRef.current && withinCapacityRef.current) {
            const payloadY = { type: "y", u: yUpdateB64, ts: Date.now(), from: myPeerId } as const;
            if (encryptionKeyRef.current) {
              const iv = generateIV();
              const plaintext = JSON.stringify(payloadY);
              const { encryptedData, authTag } = await encryptData(plaintext, encryptionKeyRef.current, iv);
              const msg = { e: 1, d: arrayBufferToBase64(encryptedData), i: uint8ArrayToBase64(iv), a: uint8ArrayToBase64(authTag) } as const;
              await sendWithRetry("y", msg);
            } else {
              await sendWithRetry("y", payloadY);
            }
          }
          return;
        }
        if (typeof text === "string") {
          setText(text);
        }
      } catch {}
    },
    // expose helpers for UI enhancements
    broadcastTyping: broadcastTypingInternal,
    updateRoomLocked: async (locked: boolean) => {
      try {
        if (!isHostRef.current) return;
        // broadcast immediately for UX, then persist
        roomLockedRef.current = locked;
        setState((s) => ({ ...s, roomLocked: locked }));
        await sendWithRetry("room", { locked, fromUserId: myUserIdRef.current });
        // Only attempt to persist if authenticated; otherwise skip to avoid 401 noise
        try {
          const { data } = await supabase.auth.getSession();
          const userId = data?.session?.user?.id ?? null;
          if (userId) {
            await supabase.from("live_share_rooms" as any).update({ locked }).eq("id", shareId);
          }
        } catch {}
      } catch {}
    },
    setEncryptionKey: async (key: CryptoKey | null) => {
      encryptionKeyRef.current = key;
    },
    rotateKey: async () => {
      // host rotates key and broadcasts under current key
      try {
        const oldKey = encryptionKeyRef.current;
        const newKey = await generateAesKey(true);
        const b64 = await exportAesKeyToBase64(newKey);
        const payload = { type: "rekey", k: b64, ts: Date.now(), from: myPeerId } as const;
        // P2P first (encrypt with the old key explicitly)
        for (const rec of peersRef.current.values()) {
          if (rec.dc && rec.dc.readyState === "open") {
            try {
              if (oldKey) {
                const iv = generateIV();
                const plaintext = JSON.stringify(payload);
                const { encryptedData, authTag } = await encryptData(plaintext, oldKey, iv);
                const msg = { e: 1, d: arrayBufferToBase64(encryptedData), i: uint8ArrayToBase64(iv), a: uint8ArrayToBase64(authTag) } as const;
                rec.dc.send(JSON.stringify(msg));
              } else {
                rec.dc.send(JSON.stringify(payload));
              }
            } catch {}
          }
        }
        // Realtime fallback (encrypt with the old key explicitly)
        if (channelRef.current && withinCapacityRef.current) {
          if (oldKey) {
            const iv = generateIV();
            const plaintext = JSON.stringify(payload);
            const { encryptedData, authTag } = await encryptData(plaintext, oldKey, iv);
            const msg = { e: 1, d: arrayBufferToBase64(encryptedData), i: uint8ArrayToBase64(iv), a: uint8ArrayToBase64(authTag) } as const;
            await sendWithRetry("key", msg);
          } else {
            await sendWithRetry("key", payload);
          }
        }
        // Switch to the new key locally after broadcasting
        encryptionKeyRef.current = newKey;
        try { void supabase.from("live_share_events" as any).insert({ room_id: shareId, event: "rekey", peer_id: myPeerId, encryption_enabled: true }); } catch {}
      } catch {}
    },
    sendChatMessage: async (text: string) => {
      if (!isHostRef.current && !allowedActionsRef.current.has('chat')) return;
      const id = crypto.randomUUID();
      const ts = Date.now();
      const payload = { type: "chat", id, text, ts, from: myPeerId } as const;
      // P2P first
      for (const rec of peersRef.current.values()) {
        if (rec.dc && rec.dc.readyState === "open") {
          try { await sendEncrypted(rec.dc, payload); } catch {}
        }
      }
      // Fallback via Realtime within capacity
      if (channelRef.current && withinCapacityRef.current) {
        const channel = channelRef.current as any;
        const stateObj = channel.presenceState?.() as Record<string, any[]> | undefined;
        const entries = Object.entries(stateObj || {}) as Array<[string, any[]]>;
        const ordered = entries
          .map(([key, metas]) => {
            let ja = Number.POSITIVE_INFINITY;
            for (const m of metas || []) {
              const v = Number(m?.joinedAt ?? m?.joined_at ?? Number.POSITIVE_INFINITY);
              if (v < ja) ja = v;
            }
            return { key, ja };
          })
          .sort((a, b) => (a.ja === b.ja ? (a.key < b.key ? -1 : 1) : a.ja - b.ja));
        const allow = ordered.slice(0, effectiveMaxRef.current || 2).map((x) => x.key);
        const wrapped = { ...payload, allow } as const;
        if (encryptionKeyRef.current) {
          const iv = generateIV();
          const plaintext = JSON.stringify(wrapped);
          const { encryptedData, authTag } = await encryptData(plaintext, encryptionKeyRef.current, iv);
          const msg = { e: 1, d: arrayBufferToBase64(encryptedData), i: uint8ArrayToBase64(iv), a: uint8ArrayToBase64(authTag) } as const;
          await sendWithRetry("text", msg);
        } else {
          await sendWithRetry("text", wrapped);
        }
      }
      // local append (also mark as seen so our own broadcast echo won't duplicate)
      rememberChatId(id);
      setState((s) => ({ ...s, chatMessages: [...s.chatMessages, { id, from: myPeerId, text, ts }] }));
      try { await supabase.from("live_share_events" as any).insert({ room_id: shareId, event: "chat", peer_id: myPeerId }); } catch {}
    },
    kickPeer: async (peerId: string) => {
      // host only action; broadcast kick
      try {
        if (!isHostRef.current) return;
        await sendWithRetry("room", { kick: [peerId], fromUserId: myUserIdRef.current });
        denylistRef.current.add(peerId);
      } catch {}
    },
    getDiagnostics: async (): Promise<Array<{ peerId: string; connectionState: RTCPeerConnectionState; dcState: RTCDataChannelState | undefined; localCandidateType?: string; remoteCandidateType?: string }>> => {
      const result: Array<{ peerId: string; connectionState: RTCPeerConnectionState; dcState: RTCDataChannelState | undefined; localCandidateType?: string; remoteCandidateType?: string }> = [];
      for (const [pid, rec] of peersRef.current.entries()) {
        let localType: string | undefined;
        let remoteType: string | undefined;
        try {
          const stats = await rec.pc.getStats();
          let selectedPairId: string | null = null;
          const candidates: Record<string, any> = {};
          stats.forEach((report: any) => {
            if (report.type === "transport" && report.selectedCandidatePairId) {
              selectedPairId = report.selectedCandidatePairId;
            }
            if (report.type === "candidate-pair" && report.selected) {
              selectedPairId = report.id;
            }
            if (report.type === "local-candidate" || report.type === "remote-candidate") {
              candidates[report.id] = report;
            }
          });
          if (selectedPairId) {
            stats.forEach((report: any) => {
              if (report.type === "candidate-pair" && report.id === selectedPairId) {
                const l = candidates[report.localCandidateId];
                const r = candidates[report.remoteCandidateId];
                localType = l?.candidateType;
                remoteType = r?.candidateType;
              }
            });
          }
        } catch {}
        result.push({ peerId: pid, connectionState: rec.pc.connectionState, dcState: rec.dc?.readyState, localCandidateType: localType, remoteCandidateType: remoteType });
      }
      return result;
    },
    myPeerId,
  } as const;
}


