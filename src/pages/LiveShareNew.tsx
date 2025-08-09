import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { arrayBufferToBase64, generateSalt, generateAesKey, exportAesKeyToBase64 } from "@/lib/crypto";
import { supabase } from "@/integrations/supabase/client";

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
      // Default expiry: 24h
      payload.expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
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

      setLink(url.toString());
      await navigator.clipboard.writeText(url.toString());
      toast({ title: "Link created", description: "Copied to clipboard." });
      // Navigate host directly into the room; include hash so encryption/proof is available client-side only
      navigate(`${url.pathname}${url.search}${url.hash}`);
    } catch (e: any) {
      toast({ title: "Failed to create link", description: e?.message ?? String(e), variant: "destructive" });
    }
  };

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
    </div>
  );
}


