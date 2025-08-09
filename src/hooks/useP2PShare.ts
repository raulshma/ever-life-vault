import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  encryptData,
  decryptData,
  generateIV,
  base64ToArrayBuffer,
  uint8ArrayToBase64,
  base64ToUint8Array,
  arrayBufferToBase64,
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
};

type PeerRecord = {
  pc: RTCPeerConnection;
  dc?: RTCDataChannel;
};

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

export function useP2PShare({ shareId, maxPeers, encryptionKey, debug }: P2PShareOptions) {
  const [state, setState] = useState<P2PShareState>({
    connectedPeerIds: [],
    participants: 0,
    isRoomFull: false,
    isReady: false,
    text: "",
    effectiveMaxPeers: maxPeers,
    isWithinCapacity: false,
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
      if (!encryptionKey) {
        dc.send(JSON.stringify(payload));
        return;
      }
      const iv = generateIV();
      const plaintext = JSON.stringify(payload);
      const { encryptedData, authTag } = await encryptData(plaintext, encryptionKey, iv);
      const msg = {
        e: 1,
        d: arrayBufferToBase64(encryptedData),
        i: uint8ArrayToBase64(iv),
        a: uint8ArrayToBase64(authTag),
      } as const;
      dc.send(JSON.stringify(msg));
    },
    [encryptionKey]
  );

  const decodeIncoming = useCallback(
    async (raw: string): Promise<any | null> => {
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return null;
        if (!("e" in parsed)) return parsed; // plaintext
        if (!encryptionKey) return null; // encrypted but we lack key
        const decrypted = await decryptData(
          base64ToArrayBuffer((parsed as any).d),
          encryptionKey,
          base64ToUint8Array((parsed as any).i),
          base64ToUint8Array((parsed as any).a)
        );
        return JSON.parse(decrypted);
      } catch (e) {
        log("decodeIncoming error", e);
        return null;
      }
    },
    [encryptionKey, log]
  );

  const broadcastLocalText = useCallback(() => {
    if (broadcastTimerRef.current) {
      window.clearTimeout(broadcastTimerRef.current);
      broadcastTimerRef.current = null;
    }
    broadcastTimerRef.current = window.setTimeout(async () => {
      const text = latestTextRef.current;
      const payload = { type: "text", text, ts: Date.now() } as const;
      for (const rec of peersRef.current.values()) {
        if (rec.dc && rec.dc.readyState === "open") {
          await sendEncrypted(rec.dc, payload);
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
          if (encryptionKey) {
            const iv = generateIV();
            const plaintext = JSON.stringify(wrapped);
            const { encryptedData, authTag } = await encryptData(plaintext, encryptionKey, iv);
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

  const setText = useCallback((next: string) => {
    latestTextRef.current = next;
    setState((s) => ({ ...s, text: next }));
    broadcastLocalText();
  }, [broadcastLocalText]);

  const handleDataMessage = useCallback(
    async (ev: MessageEvent) => {
      const payload = await decodeIncoming(typeof ev.data === "string" ? ev.data : "");
      if (!payload || typeof payload !== "object") return;
      if ((payload as any).type === "text") {
        const incomingText = (payload as any).text as string;
        // Apply remote text only if it differs to avoid echo loops
        if (incomingText !== latestTextRef.current) {
          latestTextRef.current = incomingText;
          setState((s) => ({ ...s, text: incomingText }));
        }
      }
    },
    [decodeIncoming]
  );

  const handleBroadcastText = useCallback(
    async (rawPayload: any) => {
      if (!withinCapacityRef.current) return;
      try {
        let decoded: any = rawPayload;
        if (rawPayload && typeof rawPayload === "object" && "e" in rawPayload) {
          if (!encryptionKey) return; // Encrypted but we lack key
          const decrypted = await decryptData(
            base64ToArrayBuffer((rawPayload as any).d),
            encryptionKey,
            base64ToUint8Array((rawPayload as any).i),
            base64ToUint8Array((rawPayload as any).a)
          );
          decoded = JSON.parse(decrypted);
        }
        if (!decoded || typeof decoded !== "object") return;
        if ((decoded as any).type !== "text") return;
        const allow = ((decoded as any).allow as string[] | undefined) || [];
        if (!allow.includes(myPeerId)) return;
        const incomingText = (decoded as any).text as string;
        if (incomingText !== latestTextRef.current) {
          latestTextRef.current = incomingText;
          setState((s) => ({ ...s, text: incomingText }));
        }
      } catch (e) {
        log("handleBroadcastText error", e);
      }
    },
    [encryptionKey, log, myPeerId]
  );

  const createPeer = useCallback(
    (remoteId: string) => {
      if (peersRef.current.has(remoteId)) return peersRef.current.get(remoteId)!;
      const pc = new RTCPeerConnection({ iceServers: buildIceServers() });
      const record: PeerRecord = { pc };
      peersRef.current.set(remoteId, record);

      pc.onconnectionstatechange = () => {
        log("pc state", remoteId, pc.connectionState);
        if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
          teardownPeer(remoteId);
        }
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          const msg: SignalMessage = { t: "ice", from: myPeerId, to: remoteId, candidate: e.candidate };
          channelRef.current?.send({ type: "broadcast", event: "signal", payload: msg });
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
          // Send current text state upon establishing the channel to ensure initial sync
          try {
            await sendEncrypted(record.dc!, { type: "text", text: latestTextRef.current, ts: Date.now() });
          } catch {}
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
          // Send current text state upon establishing the channel to ensure initial sync
          try {
            await sendEncrypted(rec.dc!, { type: "text", text: latestTextRef.current, ts: Date.now() });
          } catch {}
        };
        rec.dc.onclose = () => teardownPeer(remoteId);
      }
      const offer = await rec.pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });
      await rec.pc.setLocalDescription(offer);
      const msg: SignalMessage = {
        t: "offer",
        from: myPeerId,
        to: remoteId,
        sdp: JSON.stringify(rec.pc.localDescription),
      };
      channelRef.current?.send({ type: "broadcast", event: "signal", payload: msg });
    },
    [createPeer, handleDataMessage, myPeerId, teardownPeer]
  );

  const handleSignal = useCallback(
    async (msg: SignalMessage) => {
      if (msg.from === myPeerId) return;
      if ("to" in msg && msg.to !== myPeerId) return;
      if (msg.t === "hello") {
        // Enforce room capacity from our own view; ignore new peers if full
        if (isRoomAtCapacity()) {
          log("ignoring hello from", msg.from, "room at capacity");
          return;
        }
        // Existing peers always initiate offer upon hello to ensure connection establishment
        await createOffer(msg.from);
        return;
      }
      if (msg.t === "offer") {
        if (isRoomAtCapacity() && !peersRef.current.has(msg.from)) {
          log("ignoring offer from", msg.from, "room at capacity");
          return;
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
        channelRef.current?.send({ type: "broadcast", event: "signal", payload: resp });
        return;
      }
      if (msg.t === "answer") {
        const rec = createPeer(msg.from);
        const desc = JSON.parse(msg.sdp);
        await rec.pc.setRemoteDescription(desc);
        return;
      }
      if (msg.t === "ice") {
        const rec = createPeer(msg.from);
        try {
          await rec.pc.addIceCandidate(msg.candidate);
        } catch (e) {
          log("addIceCandidate error", e);
        }
      }
    },
    [createOffer, createPeer, log, myPeerId]
  );

  const leave = useCallback(async () => {
    isClosingRef.current = true;
    try {
      for (const id of Array.from(peersRef.current.keys())) teardownPeer(id);
      await channelRef.current?.untrack();
      await channelRef.current?.unsubscribe();
    } catch {}
    channelRef.current = null;
    setState((s) => ({ ...s, connectedPeerIds: [], participants: 0, isRoomFull: false }));
  }, [teardownPeer]);

  useEffect(() => {
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

    channel.on("presence", { event: "sync" }, async () => {
      const stateObj = channel.presenceState() as Record<string, any[]> | undefined;
      const peerIds = Object.keys(stateObj || {});

      // Determine host (earliest joinedAt, then lexicographically smallest id)
      let hostId: string | null = null;
      let hostJoinedAt = Number.POSITIVE_INFINITY;
      let hostMax: number | null = null;
      if (stateObj) {
        for (const [key, metas] of Object.entries(stateObj)) {
          const arr = Array.isArray(metas) ? metas : [];
          for (const m of arr) {
            const ja = Number(m?.joinedAt ?? m?.joined_at ?? Number.POSITIVE_INFINITY);
            const mMax = Number(m?.maxPeersLocal ?? m?.max_peers_local ?? NaN);
            if (
              ja < hostJoinedAt ||
              (ja === hostJoinedAt && (hostId === null || key < hostId))
            ) {
              hostId = key;
              hostJoinedAt = ja;
              hostMax = Number.isFinite(mMax) ? mMax : hostMax;
            }
          }
        }
      }
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
      setState((s) => ({
        ...s,
        participants: peerIds.length,
        effectiveMaxPeers: derivedEffectiveMax,
        isWithinCapacity,
      }));
      const isMember = peerIds.includes(myPeerId);
      const roomFull = peerIds.length >= derivedEffectiveMax && !isMember;
      if (roomFull && !isClosingRef.current) {
        setState((s) => ({ ...s, isRoomFull: true }));
        return;
      }
      // Track presence if not yet tracked, include our local max, and announce
      if (!didTrackRef.current) {
        try {
          await channel.track({ joinedAt: Date.now(), maxPeersLocal: maxPeers });
          didTrackRef.current = true;
          const hello: SignalMessage = { t: "hello", from: myPeerId };
          channel.send({ type: "broadcast", event: "signal", payload: hello });
        } catch (e) {
          // ignore
        }
      }
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        setState((s) => ({ ...s, isReady: true }));
        // Fetch authoritative room config; fall back to URL max if not found
        try {
          const { data } = await supabase
            .from("live_share_rooms" as any)
            .select("max_peers")
            .eq("id", shareId)
            .maybeSingle();
          if (data) {
            const hostMax = Number((data as any).max_peers);
            const derivedEffectiveMax = Math.min(8, Math.max(2, Number.isFinite(hostMax) ? hostMax : maxPeers));
            effectiveMaxRef.current = derivedEffectiveMax;
            setState((s) => ({ ...s, effectiveMaxPeers: derivedEffectiveMax }));
          }
        } catch {}
        // tracking will be decided on first presence sync
      }
    });

    const onBeforeUnload = () => {
      if (channel) channel.untrack();
      for (const id of Array.from(peersRef.current.keys())) teardownPeer(id);
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      leave();
    };
  }, [shareId, myPeerId, maxPeers, handleSignal, leave, teardownPeer]);

  return {
    state,
    setText,
    leave,
  } as const;
}


