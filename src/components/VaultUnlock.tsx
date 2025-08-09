import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Shield, 
  Eye, 
  EyeOff, 
  Lock, 
  Key,
  AlertTriangle,
  Clock
} from 'lucide-react';

interface VaultUnlockProps {
  onUnlock: (password: string, timeoutMinutes?: number) => Promise<boolean>;
  loading?: boolean;
  error?: string;
}

export function VaultUnlock({ onUnlock, loading = false, error }: VaultUnlockProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [timeoutMinutes, setTimeoutMinutes] = useState<number>(15);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || loading) return;
    
    const success = await onUnlock(password, timeoutMinutes);
    if (!success) {
      setAttempts(prev => prev + 1);
      setPassword(''); // Clear password on failed attempt
    } else {
      setPassword(''); // Clear password on success as well
    }
  };

  const timeoutOptions = [
    { value: 5, label: '5 minutes' },
    { value: 15, label: '15 minutes' },
    { value: 30, label: '30 minutes' },
    { value: 60, label: '1 hour' },
    { value: 120, label: '2 hours' },
    { value: 240, label: '4 hours' },
    { value: 480, label: '8 hours' },
  ];

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-[hsl(var(--info)/0.15)] rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-[hsl(var(--accent))]" />
          </div>
          <CardTitle className="text-2xl">Unlock Vault</CardTitle>
          <p className="text-muted-foreground">
            Enter your master password to access your encrypted vault
          </p>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Master Password Input */}
            <div className="space-y-2">
              <Label htmlFor="password">Master Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your master password"
                  className="pr-10"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Auto-lock Duration */}
            <div className="space-y-2">
              <Label htmlFor="timeout">Keep unlocked for</Label>
              <Select value={timeoutMinutes.toString()} onValueChange={(value) => setTimeoutMinutes(Number(value))}>
                <SelectTrigger>
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-2 text-muted-foreground" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {timeoutOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Vault will automatically lock after this time period
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Failed Attempts Warning */}
            {attempts > 2 && (
              <Alert className="border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning)/0.12)]">
                <AlertTriangle className="w-4 h-4 text-[hsl(var(--warning))]" />
                <AlertDescription className="text-[hsl(var(--warning-foreground))]">
                  Multiple failed attempts detected. Make sure you're entering the correct master password.
                </AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <Button 
              type="submit" 
              className="w-full" 
              disabled={!password.trim() || loading}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-foreground border-t-transparent rounded-full animate-spin mr-2" />
                  Unlocking...
                </>
              ) : (
                <>
                  <Key className="w-4 h-4 mr-2" />
                  Unlock Vault
                </>
              )}
            </Button>
          </form>

          {/* Security Information */}
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <div className="flex items-start space-x-3">
              <Shield className="w-5 h-5 text-[hsl(var(--success))] mt-0.5" />
              <div className="text-sm">
                <p className="font-medium mb-1">Your vault is secured with:</p>
                <ul className="text-muted-foreground space-y-1">
                  <li>• End-to-end encryption</li>
                  <li>• Zero-knowledge architecture</li>
                  <li>• Time-based auto-lock</li>
                  <li>• Cross-device session sync</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Help Text */}
          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Forgot your master password? Unfortunately, it cannot be recovered due to our zero-knowledge security model.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}