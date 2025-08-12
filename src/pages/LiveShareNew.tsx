import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { arrayBufferToBase64, generateSalt, generateAesKey, exportAesKeyToBase64 } from "@/lib/crypto";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function base64UrlEncode(input: string) {
  return btoa(input)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function sha256Base64(data: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(data));
  return arrayBufferToBase64(buf);
}

export default function LiveShareNew() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [maxPeers, setMaxPeers] = useState<number>(2);
  const [passwordEnabled, setPasswordEnabled] = useState<boolean>(false);
  const [password, setPassword] = useState<string>("");
  const [link, setLink] = useState<string>("");
  const [expiryPreset, setExpiryPreset] = useState<string>("30m");
  const [myRooms, setMyRooms] = useState<any[]>([]);
  const [loadingRooms, setLoadingRooms] = useState<boolean>(false);
  const [permEdit, setPermEdit] = useState<boolean>(true);
  const [permChat, setPermChat] = useState<boolean>(true);
  const [permImport, setPermImport] = useState<boolean>(false);

  // Use a full 128-bit random id (UUID v4 without dashes) to prevent easy enumeration
  const shareId = useMemo(() => crypto.randomUUID().replace(/-/g, ""), []);

  const createLink = async () => {
    try {
      const url = new URL(window.location.origin);
      url.pathname = `/share/${shareId}`;
      url.searchParams.set("max", String(maxPeers));

      // Prepare optional password salt/proof or ephemeral key (default-on encryption)
      let saltB64: string | null = null;
      let proof: string | null = null;
      let keyB64: string | null = null;

      if (passwordEnabled) {
        if (!password || password.length < 8) {
          toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
          return;
        }
        const salt = generateSalt();
        saltB64 = arrayBufferToBase64(salt.buffer);
        proof = await sha256Base64(`${shareId}:${password}:${saltB64}`);
        // Do NOT put proof/salt in query string. Place in URL fragment to avoid referrer/log leakage.
        const hash = new URLSearchParams();
        hash.set("proof", proof);
        url.hash = hash.toString();
      } else {
        // No password: generate ephemeral AES key and embed in URL fragment
        const key = await generateAesKey(true);
        keyB64 = await exportAesKeyToBase64(key);
        const hash = new URLSearchParams();
        hash.set("k", keyB64);
        url.hash = hash.toString();
      }

      // Persist authoritative room config server-side (idempotent)
      const payload: any = { id: shareId, max_peers: Math.min(8, Math.max(2, maxPeers)) };
      // Expiration from preset
      const now = Date.now();
      const addMs =
        expiryPreset === "30m" ? 30 * 60 * 1000 :
        expiryPreset === "1h" ? 60 * 60 * 1000 :
        expiryPreset === "4h" ? 4 * 60 * 60 * 1000 :
        expiryPreset === "12h" ? 12 * 60 * 60 * 1000 :
        expiryPreset === "72h" ? 72 * 60 * 60 * 1000 :
        expiryPreset === "7d" ? 7 * 24 * 60 * 60 * 1000 :
        24 * 60 * 60 * 1000; // default 24h
      payload.expires_at = new Date(now + addMs).toISOString();
      if (saltB64 && proof) {
        payload.password_salt = saltB64;
        payload.password_proof = proof;
      }
      const { error: upsertErr } = await supabase
        .from("live_share_rooms" as any)
        .upsert(payload, { onConflict: "id" });
      if (upsertErr) {
        throw upsertErr;
      }

      // Set default guest permissions
      try {
        const actions: string[] = [];
        if (permEdit) actions.push('edit');
        if (permChat) actions.push('chat');
        if (permImport) actions.push('import');
        const expiresAtPerm = payload.expires_at as string | undefined;
        const res = await fetch(`/live-share/rooms/${shareId}/permissions`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ resourceType: 'room', grantedTo: 'guests', actions, expiresAt: expiresAtPerm }),
        });
        if (!res.ok) {
          // eslint-disable-next-line no-console
          console.warn('Failed to set permissions');
        }
      } catch {}

      setLink(url.toString());
      await navigator.clipboard.writeText(url.toString());
      toast({ title: "Link created", description: "Copied to clipboard." });
      // Navigate host directly into the room; include hash so encryption/proof is available client-side only
      navigate(`${url.pathname}${url.search}${url.hash}`);
    } catch (e: any) {
      toast({ title: "Failed to create link", description: e?.message ?? String(e), variant: "destructive" });
    }
  };

  const refreshMyRooms = async () => {
    try {
      setLoadingRooms(true);
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess?.session?.user?.id;
      if (!uid) {
        setMyRooms([]);
        return;
      }
      const { data, error } = await supabase
        .from("live_share_rooms_public" as any)
        .select("id, max_peers, created_at, expires_at, locked")
        .eq("created_by", uid)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setMyRooms(data || []);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    refreshMyRooms();
  }, []);

  return (
    <div className="max-w-xl mx-auto mt-4">
      <Card>
        <CardHeader>
          <CardTitle>Create P2P Live Text Share</CardTitle>
          <CardDescription>Peer-to-peer editing with optional password. No content is stored on the server.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 items-center">
            <Label htmlFor="max">Max participants</Label>
            <Input
              id="max"
              type="number"
              min={2}
              max={8}
              value={maxPeers}
              onChange={(e) => setMaxPeers(Math.min(8, Math.max(2, Number(e.target.value) || 2)))}
            />
            <p className="col-span-2 text-xs text-muted-foreground">
              The host’s value is authoritative. Clients cannot raise this limit by modifying the URL.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 items-center">
            <Label>Expires</Label>
            <Select value={expiryPreset} onValueChange={setExpiryPreset}>
              <SelectTrigger>
                <SelectValue placeholder="Select expiry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30m">30 minutes</SelectItem>
                <SelectItem value="1h">1 hour</SelectItem>
                <SelectItem value="4h">4 hours</SelectItem>
                <SelectItem value="12h">12 hours</SelectItem>
                <SelectItem value="24h">24 hours</SelectItem>
                <SelectItem value="72h">3 days</SelectItem>
                <SelectItem value="7d">7 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4 items-start">
            <Label>Guest permissions</Label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={permEdit} onChange={(e) => setPermEdit(e.target.checked)} />
                Allow edit
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={permChat} onChange={(e) => setPermChat(e.target.checked)} />
                Allow chat
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={permImport} onChange={(e) => setPermImport(e.target.checked)} />
                Allow import
              </label>
              <p className="text-xs text-muted-foreground">You can adjust permissions later; clients refresh periodically.</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Password protect</Label>
              <p className="text-xs text-muted-foreground">Require a password and enable end-to-end encryption.</p>
            </div>
            <Switch checked={passwordEnabled} onCheckedChange={setPasswordEnabled} />
          </div>
          {passwordEnabled && (
            <div className="grid grid-cols-2 gap-4 items-center">
              <Label htmlFor="pwd">Password</Label>
              <Input id="pwd" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          )}
          {link && (
            <div className="space-y-2">
              <Label>Share link</Label>
              <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
            </div>
          )}
        </CardContent>
        <CardFooter className="flex items-center gap-2">
          <Button onClick={createLink}>Create link</Button>
          {link && (
            <a href={link} target="_blank" rel="noreferrer">
              <Button variant="secondary">Open</Button>
            </a>
          )}
        </CardFooter>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Your live shares</CardTitle>
          <CardDescription>Rooms you created. End a room to stop sharing and clean up its metadata.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={refreshMyRooms} disabled={loadingRooms}>
              {loadingRooms ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
          {(!myRooms || myRooms.length === 0) && (
            <div className="text-sm text-muted-foreground">No live shares yet.</div>
          )}
          {myRooms?.map((r) => {
            const expired = r.expires_at ? Date.now() > new Date(r.expires_at).getTime() : false;
            const baseUrl = new URL(window.location.origin);
            baseUrl.pathname = `/share/${r.id}`;
            baseUrl.searchParams.set("max", String(r.max_peers ?? 2));
            const baseLink = baseUrl.toString();
            return (
              <div key={r.id} className="border rounded p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="px-1 py-0.5 rounded bg-muted text-xs">{r.id}</code>
                  <span className="text-xs text-muted-foreground">Max {r.max_peers}</span>
                  {r.locked && <span className="text-xs px-2 py-0.5 rounded bg-muted">Locked</span>}
                  {expired && <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-900">Expired</span>}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()} → {r.expires_at ? new Date(r.expires_at).toLocaleString() : "N/A"}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(baseLink);
                      toast({ title: "Link copied", description: "Base link copied (fragment not included)." });
                    } catch {}
                  }}>Copy link</Button>
                  <a href={baseLink} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline">Open</Button>
                  </a>
                  <Button size="sm" variant="destructive" onClick={async () => {
                    try {
                      const { error } = await (supabase as any).rpc("end_live_share", { _id: r.id });
                      if (error) throw error;
                      toast({ title: "Ended", description: "Room was ended and cleaned up." });
                      refreshMyRooms();
                    } catch (e: any) {
                      toast({ title: "Failed to end", description: e?.message ?? String(e), variant: "destructive" });
                    }
                  }}>End</Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}


