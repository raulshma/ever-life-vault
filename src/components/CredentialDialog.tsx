import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Copy, 
  Check,
  Trash2
} from 'lucide-react';

interface Credential {
  id: string;
  name: string;
  category: string;
  username?: string;
  encrypted_password?: string;
  url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

interface CredentialDialogProps {
  credential: Credential | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Omit<Credential, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Credential>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function CredentialDialog({ 
  credential, 
  open, 
  onOpenChange, 
  onSave, 
  onUpdate,
  onDelete 
}: CredentialDialogProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Password generator settings
  const [passwordLength, setPasswordLength] = useState([16]);
  const [includeUppercase, setIncludeUppercase] = useState(true);
  const [includeLowercase, setIncludeLowercase] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);

  React.useEffect(() => {
    if (credential) {
      setName(credential.name);
      setCategory(credential.category);
      setUsername(credential.username || '');
      setPassword(credential.encrypted_password || '');
      setUrl(credential.url || '');
      setNotes(credential.notes || '');
    } else {
      setName('');
      setCategory('login');
      setUsername('');
      setPassword('');
      setUrl('');
      setNotes('');
    }
  }, [credential]);

  const generatePassword = () => {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    let chars = '';
    if (includeUppercase) chars += uppercase;
    if (includeLowercase) chars += lowercase;
    if (includeNumbers) chars += numbers;
    if (includeSymbols) chars += symbols;
    
    if (!chars) chars = lowercase; // fallback
    
    let result = '';
    for (let i = 0; i < passwordLength[0]; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    setPassword(result);
  };

  const copyPassword = async () => {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    const credentialData = {
      name,
      category,
      username: username || undefined,
      encrypted_password: password || undefined,
      url: url || undefined,
      notes: notes || undefined,
    };

    if (credential) {
      await onUpdate(credential.id, credentialData);
    } else {
      await onSave(credentialData);
    }
    
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!credential) return;
    
    setIsDeleting(true);
    try {
      await onDelete(credential.id);
      onOpenChange(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {credential ? 'Edit Credential' : 'Add New Credential'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Gmail, GitHub"
              />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="note">Secure Note</SelectItem>
                  <SelectItem value="api">API Key</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {category === 'login' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="username">Username/Email</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your@email.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="url">Website URL</Label>
                <Input
                  id="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                />
              </div>
            </>
          )}

          {(category === 'login' || category === 'api') && (
            <div className="space-y-2">
              <Label htmlFor="password">
                {category === 'api' ? 'API Key' : 'Password'}
              </Label>
              <div className="space-y-3">
                <div className="flex space-x-2">
                  <div className="relative flex-1">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={category === 'api' ? 'Enter API key' : 'Enter password'}
                      className="pr-20"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex space-x-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </Button>
                      {password && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={copyPassword}
                        >
                          {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                        </Button>
                      )}
                    </div>
                  </div>
                  {category === 'login' && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={generatePassword}
                      className="shrink-0"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Generate
                    </Button>
                  )}
                </div>

                {category === 'login' && (
                  <div className="p-4 bg-muted rounded-lg space-y-3">
                    <Label className="text-sm font-medium">Password Generator</Label>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Length: {passwordLength[0]}</Label>
                      </div>
                      <Slider
                        value={passwordLength}
                        onValueChange={setPasswordLength}
                        max={50}
                        min={8}
                        step={1}
                        className="w-full"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="uppercase"
                          checked={includeUppercase}
                          onCheckedChange={setIncludeUppercase}
                        />
                        <Label htmlFor="uppercase" className="text-sm">A-Z</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="lowercase"
                          checked={includeLowercase}
                          onCheckedChange={setIncludeLowercase}
                        />
                        <Label htmlFor="lowercase" className="text-sm">a-z</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="numbers"
                          checked={includeNumbers}
                          onCheckedChange={setIncludeNumbers}
                        />
                        <Label htmlFor="numbers" className="text-sm">0-9</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="symbols"
                          checked={includeSymbols}
                          onCheckedChange={setIncludeSymbols}
                        />
                        <Label htmlFor="symbols" className="text-sm">!@#</Label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes or secure information"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          {credential && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              className="mr-auto"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          )}
          
          <div className="space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!name.trim()}>
              {credential ? 'Save Changes' : 'Add Credential'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}