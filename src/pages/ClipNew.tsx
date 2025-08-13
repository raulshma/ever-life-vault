import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { arrayBufferToBase64, generateSalt } from "@/lib/crypto";

async function sha256Base64(data: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(data));
  return arrayBufferToBase64(buf);
}

function normalizeSlug(raw: string): string {
  const s = raw
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.slice(0, 64);
}

function isSlugValid(s: string): boolean {
  if (!s) return false;
  return /^[a-z0-9-]{3,64}$/.test(s);
}

export default function ClipNew() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [slug, setSlug] = useState<string>(useMemo(() => Math.random().toString(36).slice(2, 10), []));
  const [slugError, setSlugError] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [passwordEnabled, setPasswordEnabled] = useState<boolean>(false);
  const [password, setPassword] = useState<string>("");
  const [expiryPreset, setExpiryPreset] = useState<string>("24h");
  const [saving, setSaving] = useState<boolean>(false);
  const [link, setLink] = useState<string>("");

  const onCreate = async () => {
    try {
      setSaving(true);
      const id = normalizeSlug(slug);
      setSlug(id);
      if (!isSlugValid(id)) {
        setSlugError("Use 3–64 chars: lowercase letters, numbers, hyphens.");
        toast({ title: "Invalid id", description: "Please enter a valid URL id.", variant: "destructive" });
        return;
      }
      if (!content.trim()) {
        toast({ title: "No content", description: "Type something to save.", variant: "destructive" });
        return;
      }

      const now = Date.now();
      const addMs =
        expiryPreset === "30m" ? 30 * 60 * 1000 :
        expiryPreset === "1h" ? 60 * 60 * 1000 :
        expiryPreset === "4h" ? 4 * 60 * 60 * 1000 :
        expiryPreset === "12h" ? 12 * 60 * 60 * 1000 :
        expiryPreset === "72h" ? 72 * 60 * 60 * 1000 :
        expiryPreset === "7d" ? 7 * 24 * 60 * 60 * 1000 :
        24 * 60 * 60 * 1000;
      const expiresAt = new Date(now + addMs).toISOString();

      let proof: string | null = null;
      let saltB64: string | null = null;
      if (passwordEnabled) {
        if (!password || password.length < 6) {
          toast({ title: "Password too short", description: "Use at least 6 characters.", variant: "destructive" });
          return;
        }
        const salt = generateSalt();
        saltB64 = arrayBufferToBase64(salt.buffer);
        proof = await sha256Base64(`${id}:${password}:${saltB64}`);
      }

      const { data, error } = await (supabase as any).rpc("upsert_clip", {
        _id: id,
        _content: content,
        _expires_at: expiresAt,
        _set_password_proof: proof,
        _set_password_salt: saltB64,
      });
      if (error) throw error;
      if (data !== true) {
        toast({ title: "Failed to save", description: "Upsert returned false.", variant: "destructive" });
        return;
      }

      const url = new URL(window.location.origin);
      url.pathname = `/cl1p/${id}`;
      if (proof) {
        const hash = new URLSearchParams();
        hash.set("proof", proof);
        url.hash = hash.toString();
      }
      const urlStr = url.toString();
      setLink(urlStr);
      try { await navigator.clipboard.writeText(urlStr); } catch {}
      toast({ title: "Clip created", description: "Link copied to clipboard." });
      navigate(`${url.pathname}${url.search}${url.hash}`);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto mt-6">
      <Card>
        <CardHeader>
          <CardTitle>New Clip</CardTitle>
          <CardDescription>Create a simple paste with an optional password and expiry.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 items-center">
            <Label htmlFor="slug">ID</Label>
            <div className="flex flex-col gap-1">
              <Input id="slug" value={slug} onChange={(e) => { const v = normalizeSlug(e.target.value); setSlug(v); if (isSlugValid(v)) setSlugError(""); }} placeholder="e.g. team-note" />
              <div className="text-xs text-muted-foreground">Preview: {`${window.location.origin}/cl1p/${slug || "your-id"}`}</div>
              {slugError && <div className="text-xs text-red-600">{slugError}</div>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 items-start">
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
          <div className="flex items-center justify-between">
            <div>
              <Label>Password protect</Label>
              <p className="text-xs text-muted-foreground">Require a password to read or edit.</p>
            </div>
            <Switch checked={passwordEnabled} onCheckedChange={setPasswordEnabled} />
          </div>
          {passwordEnabled && (
            <div className="grid grid-cols-2 gap-4 items-center">
              <Label htmlFor="pwd">Password</Label>
              <Input id="pwd" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 items-start">
            <Label htmlFor="content">Content</Label>
            <Textarea id="content" rows={12} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Type or paste here..." />
          </div>
          {link && (
            <div className="space-y-2">
              <Label>Share link</Label>
              <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={onCreate} disabled={saving}>{saving ? "Saving..." : "Create"}</Button>
        </CardFooter>
      </Card>
    </div>
  );
}


