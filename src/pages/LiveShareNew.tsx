import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { arrayBufferToBase64, generateSalt } from "@/lib/crypto";
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
  const [maxPeers, setMaxPeers] = useState<number>(2);
  const [passwordEnabled, setPasswordEnabled] = useState<boolean>(false);
  const [password, setPassword] = useState<string>("");
  const [link, setLink] = useState<string>("");

  const shareId = useMemo(() => crypto.randomUUID().split("-")[0], []);

  const createLink = async () => {
    try {
      const url = new URL(window.location.origin);
      url.pathname = `/share/${shareId}`;
      url.searchParams.set("max", String(maxPeers));

      // Persist authoritative room config server-side (idempotent)
      const { error: upsertErr } = await supabase
        .from("live_share_rooms" as any)
        .upsert({ id: shareId, max_peers: Math.min(8, Math.max(2, maxPeers)) }, { onConflict: "id" });
      if (upsertErr) {
        throw upsertErr;
      }

      if (passwordEnabled) {
        if (!password || password.length < 6) {
          toast({ title: "Password too short", description: "Use at least 6 characters.", variant: "destructive" });
          return;
        }
        const salt = generateSalt();
        const saltB64 = arrayBufferToBase64(salt.buffer);
        const proof = await sha256Base64(`${shareId}:${password}:${saltB64}`);
        url.searchParams.set("s", saltB64);
        url.searchParams.set("proof", proof);
      }

      setLink(url.toString());
      await navigator.clipboard.writeText(url.toString());
      toast({ title: "Link created", description: "Copied to clipboard." });
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


