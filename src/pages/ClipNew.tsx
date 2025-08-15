import { useMemo, useState } from "react";
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
  const [slug, setSlug] = useState<string>(useMemo(() => Math.random().toString(36).slice(2, 10), []));
  const [slugError, setSlugError] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [passwordEnabled, setPasswordEnabled] = useState<boolean>(false);
  const [password, setPassword] = useState<string>("");
  const [expiryPreset, setExpiryPreset] = useState<string>("24h");
  const [oneTimeView, setOneTimeView] = useState<boolean>(false);
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
      
      // Confirm one-time view creation
      if (oneTimeView && !window.confirm(
        "Are you sure you want to create a one-time view clip? " +
        "This clip will be automatically deleted after the first person views it, and cannot be recovered. " +
        "This action cannot be undone."
      )) {
        setSaving(false);
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
        _one_time_view: oneTimeView,
      });
      if (error) throw error;
      if (data !== true) {
        toast({ title: "Failed to save", description: "Upsert returned false.", variant: "destructive" });
        return;
      }

      const url = new URL(window.location.origin);
      url.pathname = `/clip/${id}`;
      if (proof) {
        const hash = new URLSearchParams();
        hash.set("proof", proof);
        url.hash = hash.toString();
      }
      const urlStr = url.toString();
      setLink(urlStr);
      try { await navigator.clipboard.writeText(urlStr); } catch {}
      const message = oneTimeView 
        ? "One-time clip created! Link copied to clipboard. It will be deleted after first view."
        : "Clip created! Link copied to clipboard.";
      toast({ title: "Clip created", description: message });
      // Don't navigate to the clip, just show the link
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
          <CardDescription>Create a simple paste with optional password protection, expiry, and one-time viewing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 items-center">
            <Label htmlFor="slug">ID</Label>
            <div className="flex flex-col gap-1">
              <Input id="slug" value={slug} onChange={(e) => { const v = normalizeSlug(e.target.value); setSlug(v); if (isSlugValid(v)) setSlugError(""); }} placeholder="e.g. team-note" />
              <div className="text-xs text-muted-foreground">
                Preview: {`${window.location.origin}/clip/${slug || "your-id"}`}
                {oneTimeView && <span className="text-blue-600 font-medium"> • One-time view</span>}
              </div>
              {slugError && <div className="text-xs text-destructive">{slugError}</div>}
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
          <div className="flex items-center justify-between">
            <div>
              <Label>One-time view only</Label>
              <p className="text-xs text-muted-foreground">Clip will be automatically deleted after first view.</p>
            </div>
            <Switch checked={oneTimeView} onCheckedChange={setOneTimeView} />
          </div>
          {oneTimeView && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                🔒 This clip will be automatically deleted after the first person views it. 
                Perfect for sharing sensitive information that should only be seen once.
              </p>
            </div>
          )}
          {oneTimeView && passwordEnabled && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
              <p className="text-sm text-orange-800">
                ⚠️ Note: One-time view + password protection means the clip will be deleted after the first successful password unlock.
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 items-start">
            <Label htmlFor="content">Content</Label>
            <Textarea id="content" rows={12} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Type or paste here..." />
          </div>
          {link && (
            <div className="space-y-2">
              <Label>Share link</Label>
              <div className="flex gap-2">
                <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(link);
                      toast({ title: "Copied!", description: "Link copied to clipboard" });
                    } catch (e) {
                      toast({ title: "Failed to copy", description: "Please copy manually", variant: "destructive" });
                    }
                  }}
                >
                  Copy
                </Button>
              </div>
              {oneTimeView && (
                <p className="text-xs text-blue-600">
                  🔒 One-time view enabled - this link will be deleted after first use
                </p>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button onClick={onCreate} disabled={saving}>{saving ? "Saving..." : "Create"}</Button>
          {link && (
            <Button 
              variant="outline" 
              onClick={() => {
                setLink("");
                setSlug(Math.random().toString(36).slice(2, 10));
                setContent("");
                setPasswordEnabled(false);
                setPassword("");
                setExpiryPreset("24h");
                setOneTimeView(false);
              }}
            >
              Create Another
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}


