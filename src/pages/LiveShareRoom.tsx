import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { arrayBufferToBase64, deriveKey, importAesKeyFromBase64, generateAesKey, exportAesKeyToBase64 } from "@/lib/crypto";
import { useP2PShare } from "@/hooks/useP2PShare";
import { supabase } from "@/integrations/supabase/client";
import { Separator } from "@/components/ui/separator";

export default function LiveShareRoom() {
  const { toast } = useToast();
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [password, setPassword] = useState<string>("");
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [needsPassword, setNeedsPassword] = useState<boolean>(false);
  const [verified, setVerified] = useState<boolean>(false);
  const [serverSalt, setServerSalt] = useState<string | null>(null);
  const [serverProof, setServerProof] = useState<string | null>(null);
  const [ephemeralKeyPresent, setEphemeralKeyPresent] = useState<boolean>(false);
  const [createdInviteCode, setCreatedInviteCode] = useState<string>("");
  const [pendingParticipants, setPendingParticipants] = useState<any[]>([]);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<'idle' | 'pending' | 'approved' | 'banned'>("idle");

  const maxPeers = Math.min(8, Math.max(2, Number(params.get("max")) || 2));
  // Sensitive data are passed via URL fragment to avoid referrer leakage
  const fragment = useMemo(() => {
    try {
      const raw = window.location.hash?.replace(/^#/, "") ?? "";
      return new URLSearchParams(raw);
    } catch {
      return new URLSearchParams();
    }
  }, []);
  const proof = fragment.get("proof") || params.get("proof") || undefined;
  const keyB64 = fragment.get("k") || params.get("k") || undefined;
  const inviteCodeParam = params.get("code") || undefined;

  useEffect(() => {
    // Load server-side room config to determine if password-protected
    const run = async () => {
      try {
        const { data } = await supabase
          .from("live_share_rooms_public")
          .select("password_salt, max_peers")
          .eq("id", id)
          .maybeSingle();
        const salt = data?.password_salt as string | null;
        setServerSalt(salt || null);
        const protectedRoom = Boolean(salt);
        setNeedsPassword(protectedRoom);
        if (protectedRoom && proof) {
          // Try server-side verification using provided proof
          const client: any = supabase;
          const { data: ok, error } = await client.rpc("verify_live_share_access", { _id: id, _proof: proof });
          if (!error && ok === true) setVerified(true);
        } else {
          setVerified(true);
        }
        // If ephemeral key present in URL, import it immediately
        if (!protectedRoom && keyB64) {
          try {
            const imported = await importAesKeyFromBase64(keyB64, true);
            setKey(imported);
            setEphemeralKeyPresent(true);
          } catch {}
        }
      } catch {
        // On failure, only allow if ephemeral key is present in fragment
        setVerified(Boolean(keyB64));
      }
    };
    if (id) run();
  }, [id, proof, keyB64]);

  async function sha256Base64(data: string): Promise<string> {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest("SHA-256", enc.encode(data));
    return arrayBufferToBase64(buf);
  }

  const setupKey = async () => {
    try {
      const saltStr = serverSalt;
      if (!saltStr) return;
      const salt = Uint8Array.from(atob(saltStr), (c) => c.charCodeAt(0));
      const k = await deriveKey(password, salt, false);
      setKey(k);
      // Verify access via server RPC
      const localProof = await sha256Base64(`${id}:${password}:${saltStr}`);
      const client: any = supabase;
      const { data: ok, error } = await client.rpc("verify_live_share_access", { _id: id, _proof: localProof });
      if (!error && ok === true) {
        setVerified(true);
      } else {
        toast({ title: "Access denied", description: "Incorrect password.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Failed to set key", description: e?.message ?? String(e), variant: "destructive" });
    }
  };

  const isGuest = Boolean(inviteCodeParam);
  const shouldEnable = verified && (!isGuest || approvalStatus === 'approved');
  const { state, setText, leave, updateRoomLocked, sendChatMessage, getDiagnostics, kickPeer, myPeerId, exportSnapshot, importSnapshot, rotateKey, setCursorNormalized, clearCursor } = useP2PShare({ shareId: id!, maxPeers, encryptionKey: key, debug: true, enabled: shouldEnable });
  const [chatInput, setChatInput] = useState("");
  const [diag, setDiag] = useState<any[]>([]);
  const editorRef = useRef<HTMLDivElement | null>(null);

  // Persist and restore last text locally for recovery
  useEffect(() => {
    const storageKey = `live_share:last_text:${id}`;
    const cached = localStorage.getItem(storageKey);
    if (cached && !state.text) {
      setText(cached);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => {
    const storageKey = `live_share:last_text:${id}`;
    try {
      if (state.text) localStorage.setItem(storageKey, state.text);
    } catch {}
  }, [id, state.text]);

  useEffect(() => {
    return () => {
      leave();
    };
  }, [leave]);

  // Guest: redeem invite code and wait for approval
  useEffect(() => {
    const run = async () => {
      try {
        if (!id || !inviteCodeParam) return;
        // Avoid re-redeeming
        if (participantId) return;
        let displayName = 'Guest';
        try {
          const { data } = await supabase.auth.getSession();
          const email = data?.session?.user?.email ?? undefined;
          displayName = (data?.session?.user?.user_metadata?.full_name as string | undefined) ?? email ?? 'Guest';
        } catch {}
        const { data: sess } = await supabase.auth.getSession();
        const token = sess?.session?.access_token;
        const res = await fetch(`/live-share/join`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ code: inviteCodeParam, displayName }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed to join');
        const pid = json?.participantId as string | undefined;
        if (pid) {
          setParticipantId(pid);
          setApprovalStatus('pending');
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, inviteCodeParam]);

  // Poll my participant status if pending
  useEffect(() => {
    if (!participantId || approvalStatus !== 'pending') return;
    let timer: number | null = null;
    const run = async () => {
      try {
        const client: any = supabase;
        const { data, error } = await client.rpc('get_live_share_participant_status', { _id: participantId });
        if (!error && typeof data === 'string') {
          const st = data as string;
          if (st === 'approved') setApprovalStatus('approved');
          if (st === 'banned') setApprovalStatus('banned');
        }
      } catch {}
    };
    run();
    timer = window.setInterval(run, 2500);
    return () => { if (timer) window.clearInterval(timer); };
  }, [participantId, approvalStatus]);

  const roomFull = state.isRoomFull && state.participants >= state.effectiveMaxPeers && !state.connectedPeerIds.length;

  const safetyCode = useMemo(() => {
    const src = proof || serverProof || keyB64 || null;
    if (!src) return null;
    // 8-char grouped safety code for visual verification
    const compact = src.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
    if (!compact) return null;
    return `${compact.slice(0,4)}-${compact.slice(4,8)}`;
  }, [proof, serverProof, keyB64]);

  useEffect(() => {
    if (state.kicked) {
      toast({ title: "Removed by host", description: "You were kicked from the room.", variant: "destructive" });
      navigate("/", { replace: true });
    }
  }, [state.kicked, navigate, toast]);

  useEffect(() => {
    if (state.ended) {
      if (state.isHost) {
        toast({ title: "Live share ended", description: "You ended this room.", variant: "default" });
        navigate("/share/new", { replace: true });
      } else {
        toast({ title: "Live share ended", description: "The host ended this room.", variant: "default" });
        navigate("/", { replace: true });
      }
    }
  }, [state.ended, state.isHost, navigate, toast]);

  // Host lobby: poll pending participants list
  useEffect(() => {
    let timer: number | null = null;
    const run = async () => {
      try {
        if (!state.isHost || !id) return;
        const { data, error } = await supabase
          .from("live_share_participants" as any)
          .select("id, display_name, status, joined_at")
          .eq("room_id", id)
          .in("status", ["pending", "banned"])
          .order("joined_at", { ascending: true });
        if (!error) setPendingParticipants(data || []);
      } catch {}
    };
    run();
    timer = window.setInterval(run, 3000);
    return () => { if (timer) window.clearInterval(timer); };
  }, [id, state.isHost]);

  const showRoomUI = !(roomFull || (state.blockedByLock && !state.isHost) || state.kicked);

  return (
    <div className="max-w-5xl mx-auto mt-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Live Share Room
            {state.roomLocked && (
              <span className="text-xs px-2 py-1 rounded bg-muted">Locked</span>
            )}
          </CardTitle>
          <CardDescription>
            Share ID: <code>{id}</code> • Participants: {state.participants}/{state.effectiveMaxPeers}
            {(serverProof || proof || keyB64) && (
              <span className="ml-2">• Safety code: <code>{safetyCode ?? 'N/A'}</code></span>
            )}
          </CardDescription>
          {state.isHost && (
            <div className="mt-2">
              <Button size="sm" variant="outline" onClick={() => updateRoomLocked(!state.roomLocked)}>
                {state.roomLocked ? "Unlock room" : "Lock room"}
              </Button>
              <Button size="sm" variant="outline" className="ml-2" onClick={() => rotateKey()}>Rotate key</Button>
              <Button size="sm" variant="ghost" className="ml-2" onClick={async () => { await leave(); navigate("/share/new", { replace: true }); }}>End & leave</Button>
              <Button size="sm" variant="secondary" className="ml-2" onClick={async () => {
                try {
                  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
                  const { data: sess } = await supabase.auth.getSession();
                  const token = sess?.session?.access_token;
                  const res = await fetch(`/live-share/rooms/${id}/invites`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                    body: JSON.stringify({ expiresAt, maxUses: 5 }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data?.error || 'Failed');
                  setCreatedInviteCode(data.code);
                } catch (e: any) {
                  toast({ title: 'Failed to create invite', description: e?.message ?? String(e), variant: 'destructive' });
                }
              }}>Create invite</Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {createdInviteCode && (
            <div className="p-2 rounded border text-sm flex items-center gap-2">
              <span>Invite code:</span>
              <code className="px-1 py-0.5 rounded bg-muted">{createdInviteCode}</code>
              <Button size="sm" variant="outline" onClick={async () => {
                try { await navigator.clipboard.writeText(createdInviteCode); toast({ title: 'Copied', description: 'Invite code copied.' }); } catch {}
              }}>Copy</Button>
            </div>
          )}
          {roomFull && (
            <div className="p-3 rounded-md bg-amber-50 text-amber-900 border border-amber-200">
              Room is full. Try again later or ask the host to increase the limit.
            </div>
          )}
          {state.blockedByLock && !state.isHost && (
            <div className="p-3 rounded-md bg-slate-50 text-slate-900 border border-slate-200">
              The room is locked by the host. You cannot join right now.
            </div>
          )}
          {isGuest && approvalStatus === 'pending' && (
            <div className="p-3 rounded-md bg-yellow-50 text-yellow-900 border border-yellow-200">
              Waiting for host approval...
            </div>
          )}
          {isGuest && approvalStatus === 'banned' && (
            <div className="p-3 rounded-md bg-red-50 text-red-900 border border-red-200">
              Access denied by host.
            </div>
          )}
          {!verified && needsPassword && (
            <div className="p-3 rounded-md bg-blue-50 text-blue-900 border border-blue-200">
              This room is protected. Enter the password to join.
            </div>
          )}
          {needsPassword && !key && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <Label htmlFor="pwd">Room password</Label>
              <div className="sm:col-span-2 flex gap-2">
                <Input id="pwd" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <Button onClick={setupKey}>Unlock</Button>
              </div>
            </div>
          )}
          {state.roomLocked && (
            <div className="p-3 rounded-md bg-slate-50 text-slate-900 border border-slate-200">
              The room is locked. New peers cannot join until unlocked by the host.
            </div>
          )}
          {!roomFull && !(state.blockedByLock && !state.isHost) && !(isGuest && approvalStatus !== 'approved') ? (
            <div
              ref={editorRef}
              className="relative"
              onMouseMove={(e) => {
                const el = editorRef.current;
                if (!el) return;
                const ta = el.querySelector('textarea');
                const rect = (ta ?? el).getBoundingClientRect();
                const x = (e.clientX - rect.left) / Math.max(1, rect.width);
                const y = (e.clientY - rect.top) / Math.max(1, rect.height);
                setCursorNormalized(x, y);
              }}
              onMouseLeave={() => clearCursor()}
              onTouchMove={(e) => {
                const el = editorRef.current;
                if (!el) return;
                const touch = e.touches?.[0];
                if (!touch) return;
                const ta = el.querySelector('textarea');
                const rect = (ta ?? el).getBoundingClientRect();
                const x = (touch.clientX - rect.left) / Math.max(1, rect.width);
                const y = (touch.clientY - rect.top) / Math.max(1, rect.height);
                setCursorNormalized(x, y);
              }}
            >
              <Textarea
                value={state.text}
                onChange={(e) => setText(e.target.value)}
                placeholder={needsPassword && !key ? "Enter the password to start editing..." : (isGuest && approvalStatus !== 'approved') ? "Waiting for host approval..." : "Start typing..."}
                className="min-h-[50vh]"
                disabled={(needsPassword && !key) || (isGuest && approvalStatus !== 'approved')}
              />
              {/* Cursor overlay */}
              {state.remoteCursors?.length ? (
                <div className="pointer-events-none absolute inset-0 z-10">
                  {state.remoteCursors.map((c) => (
                    <div
                      key={c.peerId}
                      className="absolute -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
                    >
                      <div className="flex items-center gap-1 -translate-y-3 translate-x-2">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full shadow"
                          style={{ backgroundColor: c.color || '#6366f1', boxShadow: `0 0 0 2px white` }}
                        />
                        <span className="text-[10px] px-1 py-0.5 rounded bg-white/90 text-slate-700 shadow border">
                          {(c.name || c.peerId.slice(0,6))}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {showRoomUI && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              {isGuest && approvalStatus === 'pending' && (
                <div className="p-2 rounded border bg-yellow-50 text-yellow-900 text-sm mb-2">
                  Waiting for host approval...
                </div>
              )}
              <div className="text-sm font-medium mb-1">Chat</div>
              <div className="border rounded p-2 h-40 overflow-auto bg-background">
                {state.chatMessages?.length ? (
                  state.chatMessages.slice(-100).map((m) => (
                    <div key={m.id} className="text-sm">
                      <span className="text-muted-foreground mr-1">[{new Date(m.ts).toLocaleTimeString()}]</span>
                      <code className="mr-1">{m.from.slice(0, 6)}</code>
                      <span>{m.text}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground">No messages yet.</div>
                )}
              </div>
              <div className="mt-2 flex gap-2">
                <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type a message and press Enter" onKeyDown={async (e) => {
                  if (e.key === "Enter" && chatInput.trim()) {
                    e.preventDefault();
                    await sendChatMessage(chatInput.trim());
                    setChatInput("");
                  }
                }} />
                <Button variant="outline" onClick={async () => {
                  try {
                    const snap = await exportSnapshot();
                    const blob = new Blob([JSON.stringify({
                      version: 1,
                      shareId: id,
                      ts: Date.now(),
                      yUpdateB64: snap.yUpdateB64,
                      text: snap.text,
                    }, null, 2)], { type: "application/json" });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `live-share-${id}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                  } catch (e: any) {
                    toast({ title: 'Export failed', description: e?.message ?? String(e), variant: 'destructive' });
                  }
                }}>Export</Button>
                <Button variant="outline" onClick={async () => {
                  try {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'application/json';
                    input.onchange = async () => {
                      const file = input.files?.[0];
                      if (!file) return;
                      const text = await file.text();
                      const data = JSON.parse(text);
                      await importSnapshot({ yUpdateB64: data?.yUpdateB64 ?? null, text: data?.text ?? '' });
                      toast({ title: 'Imported', description: 'Session content loaded.' });
                    };
                    input.click();
                  } catch (e: any) {
                    toast({ title: 'Import failed', description: e?.message ?? String(e), variant: 'destructive' });
                  }
                }}>Import</Button>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Participants</div>
              <div className="flex flex-col gap-1">
                {state.presencePeerIds?.map((pid) => (
                  <div key={pid} className="flex items-center gap-2">
                    <code className="px-1 py-0.5 rounded bg-muted text-xs">{pid.slice(0, 6)}{pid === myPeerId ? ' (you)' : ''}</code>
                    {state.isHost && pid !== myPeerId && (
                      <Button size="sm" variant="destructive" onClick={() => kickPeer(pid)}>Kick</Button>
                    )}
                  </div>
                ))}
              </div>
              {state.isHost && (
                <div className="pt-3">
                  <Separator className="my-2" />
                  <div className="text-sm font-medium mb-2">Lobby</div>
                  {pendingParticipants.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No pending requests.</div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {pendingParticipants.map((p) => (
                        <div key={p.id} className="flex items-center gap-2">
                          <span className="text-xs">{p.display_name}</span>
                          <span className="text-[10px] px-1 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">{p.status}</span>
                          <Button size="sm" variant="outline" onClick={async () => {
                            try {
                              const { data: sess } = await supabase.auth.getSession();
                              const token = sess?.session?.access_token;
                              const res = await fetch(`/live-share/rooms/${id}/approve`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ participantId: p.id }) });
                              const data = await res.json();
                              if (!res.ok) throw new Error(data?.error || 'Failed');
                              setPendingParticipants((list) => list.filter((x) => x.id !== p.id));
                            } catch (e: any) {
                              toast({ title: 'Failed to approve', description: e?.message ?? String(e), variant: 'destructive' });
                            }
                          }}>Approve</Button>
                          <Button size="sm" variant="destructive" onClick={async () => {
                            try {
                              const { data: sess } = await supabase.auth.getSession();
                              const token = sess?.session?.access_token;
                              const res = await fetch(`/live-share/rooms/${id}/ban`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ participantId: p.id }) });
                              const data = await res.json();
                              if (!res.ok) throw new Error(data?.error || 'Failed');
                              setPendingParticipants((list) => list.filter((x) => x.id !== p.id));
                            } catch (e: any) {
                              toast({ title: 'Failed to ban', description: e?.message ?? String(e), variant: 'destructive' });
                            }
                          }}>Ban</Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="pt-2">
                <Button size="sm" variant="outline" onClick={async () => {
                  const d = await getDiagnostics();
                  setDiag(d);
                }}>Diagnostics</Button>
                {diag.length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground space-y-1">
                    {diag.map((d, i) => (
                      <div key={i}>
                        <code>{String(d.peerId).slice(0,6)}</code>: {d.connectionState} / DC {d.dcState} • {d.localCandidateType ?? "?"}→{d.remoteCandidateType ?? "?"}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          )}
          <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-2">
            <span>Connected peers:</span>
            {state.connectedPeerIds.length ? (
              state.connectedPeerIds.map((pid) => (
                <code key={pid} className="px-1 py-0.5 rounded bg-muted">
                  {pid.slice(0, 6)}
                </code>
              ))
            ) : (
              <span>none</span>
            )}
            {state.typingPeerIds.length > 0 && (
              <span className="ml-2 italic">typing: {state.typingPeerIds.map((id) => id.slice(0, 6)).join(", ")}</span>
            )}
            <span className="ml-auto">Capacity seat: {state.isWithinCapacity ? "yes" : "no"}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


