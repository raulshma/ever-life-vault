import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { arrayBufferToBase64, generateSalt } from "@/lib/crypto";

async function sha256Base64(data: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(data));
  return arrayBufferToBase64(buf);
}

export default function ClipPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [hasPassword, setHasPassword] = useState<boolean>(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [password, setPassword] = useState<string>("");
  const [saltB64, setSaltB64] = useState<string | null>(null);
  const [proofFromHash, setProofFromHash] = useState<string | null>(null);

  // Read proof from URL hash if present
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const p = hash.get("proof");
    setProofFromHash(p);
  }, []);

  const computeProof = async (pwd: string) => {
    if (!id || !saltB64) return null;
    return sha256Base64(`${id}:${pwd}:${saltB64}`);
  };

  const load = async (providedProof?: string | null) => {
    if (!id) return;
    try {
      setLoading(true);
      // First fetch meta to know if password needed and get salt
      const { data: meta, error: metaErr } = await (supabase as any).rpc("get_clip_meta", { _id: id });
      if (metaErr) throw metaErr;
      const metaHasPwd = Boolean(meta?.has_password);
      const metaSalt = meta?.password_salt ?? null;
      setHasPassword(metaHasPwd);
      setExpiresAt(meta?.expires_at ?? null);
      setUpdatedAt(meta?.updated_at ?? null);
      setSaltB64(metaSalt);

      let proof = providedProof ?? proofFromHash ?? null;
      if (metaHasPwd && !proof && password && metaSalt) {
        proof = await sha256Base64(`${id}:${password}:${metaSalt}`);
      }

      const { data, error } = await (supabase as any).rpc("get_clip", { _id: id, _proof: proof });
      if (error) throw error;
      if (!data || !Array.isArray(data) || data.length === 0) {
        setContent("");
      } else {
        const row = data[0];
        setContent(row.content ?? "");
        setHasPassword(Boolean(row.has_password));
        setExpiresAt(row.expires_at ?? null);
        setUpdatedAt(row.updated_at ?? null);
      }
    } catch (e: any) {
      toast({ title: "Failed to load", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const save = async () => {
    if (!id) return;
    try {
      setSaving(true);
      let proof: string | null = proofFromHash ?? null;
      if (hasPassword) {
        if (!password || !saltB64) {
          toast({ title: "Password required", description: "Enter the password to save.", variant: "destructive" });
          return;
        }
        proof = await computeProof(password);
      }
      const { data, error } = await (supabase as any).rpc("upsert_clip", {
        _id: id,
        _content: content,
        _expires_at: expiresAt,
        _proof: proof,
      });
      if (error) throw error;
      if (data !== true) throw new Error("Upsert returned false");
      toast({ title: "Saved", description: "Clip updated." });
      load(proof ?? undefined);
    } catch (e: any) {
      toast({ title: "Failed to save", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const unlock = async () => {
    if (!id) return;
    try {
      if (!hasPassword) {
        await load();
        return;
      }
      if (!password || !saltB64) {
        toast({ title: "Password required", description: "Enter the password to unlock.", variant: "destructive" });
        return;
      }
      const proof = await sha256Base64(`${id}:${password}:${saltB64}`);
      await load(proof);
      const url = new URL(window.location.href);
      const hash = new URLSearchParams();
      hash.set("proof", proof);
      url.hash = hash.toString();
      window.history.replaceState(null, "", url.toString());
    } catch {}
  };

  return (
    <div className="max-w-4xl mx-auto mt-4">
      <Card>
        <CardHeader>
          <CardTitle>Clip: {id}</CardTitle>
          <CardDescription>
            {hasPassword ? "Password protected" : "Public"}
            {expiresAt ? ` • Expires ${new Date(expiresAt).toLocaleString()}` : ""}
            {updatedAt ? ` • Updated ${new Date(updatedAt).toLocaleString()}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasPassword && (
            <div className="grid grid-cols-2 gap-4 items-center">
              <Label htmlFor="pwd">Password</Label>
              <div className="flex gap-2">
                <Input id="pwd" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <Button variant="secondary" onClick={unlock}>Unlock</Button>
              </div>
            </div>
          )}
          <Textarea rows={16} value={content} onChange={(e) => setContent(e.target.value)} placeholder={loading ? "Loading..." : "Type or paste here..."} />
          <div className="flex items-center gap-2">
            <Button onClick={save} disabled={saving || loading}>{saving ? "Saving..." : "Save"}</Button>
            <Button variant="outline" onClick={() => load().catch(() => {})}>Refresh</Button>
            <Button variant="outline" onClick={() => navigator.clipboard.writeText(content)}>Copy</Button>
            <Button variant="ghost" onClick={() => navigate("/clip/new")}>New</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


