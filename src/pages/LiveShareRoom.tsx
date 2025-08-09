import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { deriveKey } from "@/lib/crypto";
import { useP2PShare } from "@/hooks/useP2PShare";

export default function LiveShareRoom() {
  const { toast } = useToast();
  const { id } = useParams();
  const [params] = useSearchParams();
  const [password, setPassword] = useState<string>("");
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [needsPassword, setNeedsPassword] = useState<boolean>(false);

  const maxPeers = Math.min(8, Math.max(2, Number(params.get("max")) || 2));
  const saltB64 = params.get("s");
  const proof = params.get("proof");

  useEffect(() => {
    setNeedsPassword(Boolean(saltB64 && proof));
  }, [saltB64, proof]);

  const setupKey = async () => {
    if (!saltB64) return;
    try {
      const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
      const k = await deriveKey(password, salt, false);
      setKey(k);
    } catch (e: any) {
      toast({ title: "Failed to set key", description: e?.message ?? String(e), variant: "destructive" });
    }
  };

  const { state, setText, leave } = useP2PShare({ shareId: id!, maxPeers, encryptionKey: key, debug: true });

  useEffect(() => {
    return () => {
      leave();
    };
  }, [leave]);

  const roomFull = state.isRoomFull && state.participants >= state.effectiveMaxPeers && !state.connectedPeerIds.length;

  return (
    <div className="max-w-5xl mx-auto mt-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Live Share Room</CardTitle>
          <CardDescription>
            Share ID: <code>{id}</code> • Participants: {state.participants}/{state.effectiveMaxPeers}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {roomFull && (
            <div className="p-3 rounded-md bg-amber-50 text-amber-900 border border-amber-200">
              Room is full. Try again later or ask the host to increase the limit.
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
          <Textarea
            value={state.text}
            onChange={(e) => setText(e.target.value)}
            placeholder={needsPassword && !key ? "Enter the password to start editing..." : "Start typing..."}
            className="min-h-[50vh]"
            disabled={needsPassword && !key}
          />
        </CardContent>
      </Card>
    </div>
  );
}


