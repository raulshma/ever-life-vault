import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, QrCode, KeyRound, User as UserIcon, Image as ImageIcon, Shield } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdBusy, setPwdBusy] = useState(false);

  // 2FA
  const [mfaBusy, setMfaBusy] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [enrolledFactorId, setEnrolledFactorId] = useState<string | null>(null);
  const [otp, setOtp] = useState('');

  useEffect(() => {
    if (!user) return;
    // Load profile from public.profiles
    const load = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      if (!error && data) {
        setDisplayName(data.display_name || '');
        setAvatarUrl(data.avatar_url || '');
      }
    };
    load();
    // Check existing MFA factors (TOTP) to set current state
    (async () => {
      try {
        const mfaApi = (supabase.auth as any)?.mfa;
        if (!mfaApi?.listFactors) return;
        const factors = await mfaApi.listFactors();
        if (!factors?.error) {
          const totpFactor = factors?.data?.totp?.[0];
          if (totpFactor?.id) {
            const verified = typeof totpFactor.verified === 'boolean' ? !!totpFactor.verified : undefined;
            if (verified === undefined) {
              try {
                const aal = await mfaApi.getAuthenticatorAssuranceLevel?.();
                const currentLevel = aal?.data?.currentLevel || aal?.currentLevel;
                setIsEnrolled(currentLevel === 'aal2');
              } catch {
                setIsEnrolled(true);
              }
            } else {
              setIsEnrolled(verified);
            }
            setEnrolledFactorId(totpFactor.id as string);
          } else {
            setIsEnrolled(false);
            setEnrolledFactorId(null);
          }
        }
      } catch {}
    })();
  }, [user?.id]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, display_name: displayName || null, avatar_url: avatarUrl || null, updated_at: new Date().toISOString() });
      if (error) {
        setError(error.message);
        return;
      }
      toast({ title: 'Profile updated' });
    } catch (err) {
      setError('Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setPwdBusy(true);
    setError('');
    try {
      // Reauthenticate isn't available directly; if needed, can do signInWithPassword
      if (currentPassword) {
        const { error: signErr } = await supabase.auth.signInWithPassword({ email: user?.email || '', password: currentPassword });
        if (signErr) {
          setError('Current password is incorrect.');
          setPwdBusy(false);
          return;
        }
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setError(error.message);
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast({ title: 'Password changed' });
    } catch (err) {
      setError('Failed to change password.');
    } finally {
      setPwdBusy(false);
    }
  };

  const enroll2FA = async () => {
    setMfaBusy(true);
    setError('');
    try {
      const mfaApi = (supabase.auth as any)?.mfa;
      if (!mfaApi?.enroll) {
        setError('MFA enroll is not available.');
        return;
      }
      // If a TOTP factor already exists, handle accordingly
      if (mfaApi?.listFactors) {
        const factors = await mfaApi.listFactors();
        if (!factors?.error) {
          const existing = factors?.data?.totp?.[0];
          if (existing?.id) {
            // Determine if verified
            const verified = typeof existing.verified === 'boolean' ? !!existing.verified : undefined;
            if (verified === true) {
              setIsEnrolled(true);
              setEnrolledFactorId(existing.id as string);
              toast({ title: '2FA already enabled' });
              return;
            } else {
              // Not verified: try reusing existing TOTP by re-challenging instead of enrolling a new one
              setEnrolledFactorId(existing.id as string);
              const challenge = await mfaApi.challenge({ factorId: existing.id as string });
              if (challenge?.error) {
                // If challenge fails (corrupt/incomplete), clean up then continue to enroll
                if (mfaApi?.unenroll) {
                  await mfaApi.unenroll({ factorId: existing.id as string });
                }
              } else {
                // Ask user to verify with existing app; no new QR available from API for existing factors
                setQrSvg('');
                setTotpUri(null);
                toast({ title: 'Enter code', description: 'Enter the 6‑digit code from your authenticator app.' });
                setMfaBusy(false);
                return;
              }
            }
          }
        }
      }

      // Do not pass a fixed friendlyName to avoid name-collision errors
      const { data, error } = await mfaApi.enroll({ factorType: 'totp' });
      if (error) {
        setError(error.message);
        return;
      }
      // Supabase returns id and a QR code SVG under data.totp.qr_code
      setEnrolledFactorId(data?.id as string);
      const qr = (data?.totp as any)?.qr_code as string | undefined;
      const secret = (data?.totp as any)?.secret as string | undefined;
      const uri = (data?.totp as any)?.uri as string | undefined;
      if (secret) setTotpSecret(secret);
      if (uri) setTotpUri(uri);
      if (qr) setQrSvg(qr);
    } catch (err) {
      setError('Failed to start 2FA enrollment.');
    } finally {
      setMfaBusy(false);
    }
  };

  const verify2FAEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    setMfaBusy(true);
    setError('');
    try {
      const mfaApi = (supabase.auth as any)?.mfa;
      if (!mfaApi?.verify) {
        setError('MFA verify is not available.');
        return;
      }
      // Create a challenge then verify with the provided code
      if (!enrolledFactorId) {
        setError('Missing factorId.');
        return;
      }
      const challenge = await (supabase.auth as any).mfa.challenge({ factorId: enrolledFactorId });
      if (challenge?.error) {
        setError(challenge.error.message);
        return;
      }
      const challengeId = challenge?.data?.id as string;
      const { error } = await mfaApi.verify({ factorId: enrolledFactorId, challengeId, code: otp });
      if (error) {
        setError(error.message || 'Invalid code.');
        return;
      }
      setIsEnrolled(true);
      setOtp('');
      setQrSvg(null);
      setTotpSecret(null);
      setTotpUri(null);
      toast({ title: '2FA enabled' });
    } catch (err) {
      setError('Failed to verify 2FA code.');
    } finally {
      setMfaBusy(false);
    }
  };

  const disable2FA = async () => {
    setMfaBusy(true);
    setError('');
    try {
      const mfaApi = (supabase.auth as any)?.mfa;
      if (!mfaApi?.unenroll) {
        setError('MFA unenroll is not available.');
        return;
      }
      // Unenroll requires a factorId
      if (!enrolledFactorId) {
        setError('No enrolled factor to disable.');
        return;
      }
      const { error } = await mfaApi.unenroll({ factorId: enrolledFactorId });
      if (error) {
        setError(error.message);
        return;
      }
      setIsEnrolled(false);
      setQrSvg(null);
      setEnrolledFactorId(null);
      setTotpSecret(null);
      setTotpUri(null);
      setOtp('');
      toast({ title: '2FA disabled' });
    } catch (err) {
      setError('Failed to disable 2FA.');
    } finally {
      setMfaBusy(false);
    }
  };

  const cancelEnrollment = async () => {
    if (!qrSvg || !enrolledFactorId) {
      setQrSvg(null);
      setTotpSecret(null);
      setOtp('');
      return;
    }
    try {
      setMfaBusy(true);
      const mfaApi = (supabase.auth as any)?.mfa;
      if (mfaApi?.unenroll) {
        await mfaApi.unenroll({ factorId: enrolledFactorId });
      }
      setQrSvg(null);
      setTotpSecret(null);
      setEnrolledFactorId(null);
      setOtp('');
    } catch {}
    finally {
      setMfaBusy(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card className="glass shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserIcon className="h-5 w-5" /> Account Profile</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="pl-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="avatarUrl">Avatar URL</Label>
              <div className="relative">
                <ImageIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="avatarUrl" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} className="pl-10" />
              </div>
            </div>
            <Button type="submit" disabled={loading}>Save</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="glass shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={6} />
            </div>
            <Button type="submit" disabled={pwdBusy}>Change Password</Button>
          </form>

          <div className="border-t pt-4">
            {!isEnrolled ? (
              <div className="space-y-4">
                {!qrSvg ? (
                  <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Two‑Factor Authentication</div>
                      <div className="text-base font-medium">Enhance your account security</div>
                      <p className="text-sm text-muted-foreground mt-1">Use an authenticator app (Google Authenticator, 1Password, Authy) to generate 6‑digit codes.</p>
                    </div>
                    <Button onClick={enroll2FA} disabled={mfaBusy} variant="outline" className="gap-2">
                      <QrCode className="h-4 w-4" /> Enable 2FA (TOTP)
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-3">
                      <div className="text-sm font-medium">Step 1 — Scan this code</div>
                      <div className="rounded-lg border bg-card/40 p-4 w-fit">
                        {/* Supabase may return raw SVG or a data URI; support both. Some apps fail with inline SVG, so provide a PNG fallback using the TOTP URI. */}
                        {qrSvg.startsWith('data:image') ? (
                          <img src={qrSvg} alt="TOTP QR" className="w-48 h-48" />
                        ) : totpUri ? (
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=192x192&data=${encodeURIComponent(totpUri)}`}
                            alt="TOTP QR"
                            className="w-48 h-48"
                          />
                        ) : (
                          <div className="w-48 h-48" dangerouslySetInnerHTML={{ __html: qrSvg }} />
                        )}
                      </div>
                      {totpSecret && (
                        <div className="text-xs text-muted-foreground">
                          Can’t scan? Enter this key in your app: <span className="font-mono select-all">{totpSecret}</span>
                          {totpUri && (
                            <>
                              <br />Or open this link: <a href={totpUri} target="_blank" className="underline break-all">{totpUri}</a>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <form onSubmit={verify2FAEnrollment} className="space-y-3">
                      <div className="text-sm font-medium">Step 2 — Enter 6‑digit code</div>
                      <InputOTP maxLength={6} value={otp} onChange={setOtp} containerClassName="justify-start">
                        <InputOTPGroup>
                          {[0,1,2,3,4,5].map((i) => (
                            <InputOTPSlot key={i} index={i} />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                      <div className="flex gap-2">
                        <Button type="submit" disabled={mfaBusy || otp.length !== 6} className="gap-2">
                          <KeyRound className="h-4 w-4" /> Verify
                        </Button>
                        <Button type="button" variant="ghost" onClick={cancelEnrollment} disabled={mfaBusy}>Cancel</Button>
                      </div>
                      <p className="text-xs text-muted-foreground">After verification, codes become mandatory when signing in.</p>
                    </form>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="text-sm text-muted-foreground">Two‑Factor Authentication is <span className="text-green-500 font-medium">enabled</span>.</div>
                <Button onClick={disable2FA} disabled={mfaBusy} variant="destructive">Disable 2FA</Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


