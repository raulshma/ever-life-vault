import React, { useState, useEffect } from 'react';
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
import { Slider } from '@/components/ui/slider';
import { 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Copy, 
  Check,
  Trash2,
  Shield
} from 'lucide-react';
import { VaultItem } from '@/lib/crypto';

interface EncryptedVaultDialogProps {
  item: VaultItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Omit<VaultItem, 'id' | 'created_at' | 'updated_at'>) => Promise<VaultItem | null>;
  onUpdate: (id: string, updates: Partial<Omit<VaultItem, 'id' | 'created_at' | 'updated_at'>>) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

export function EncryptedVaultDialog({ 
  item, 
  open, 
  onOpenChange, 
  onSave, 
  onUpdate,
  onDelete 
}: EncryptedVaultDialogProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'login' | 'note' | 'api' | 'document'>('login');
  const [data, setData] = useState<Record<string, any>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Password generator settings
  const [passwordLength, setPasswordLength] = useState([16]);
  const [includeUppercase, setIncludeUppercase] = useState(true);
  const [includeLowercase, setIncludeLowercase] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);

  // Initialize form data
  useEffect(() => {
    if (item) {
      setName(item.name);
      setType(item.type);
      setData(item.data);
    } else {
      setName('');
      setType('login');
      setData({});
    }
  }, [item]);

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
    
    setData(prev => ({ ...prev, password: result }));
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSave = async () => {
    const itemData = {
      name,
      type,
      data,
    };

    if (item) {
      await onUpdate(item.id, itemData);
    } else {
      await onSave(itemData);
    }
    
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!item) return;
    
    setIsDeleting(true);
    try {
      await onDelete(item.id);
      onOpenChange(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const updateData = (key: string, value: any) => {
    setData(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            {item ? 'Edit Vault Item' : 'Add New Vault Item'}
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
                placeholder="e.g., Gmail, GitHub, Personal Note"
              />
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(value: any) => setType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="login">Login Credential</SelectItem>
                  <SelectItem value="note">Secure Note</SelectItem>
                  <SelectItem value="api">API Key</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Login Credential Fields */}
          {type === 'login' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="username">Username/Email</Label>
                <div className="flex space-x-2">
                  <Input
                    id="username"
                    value={data.username || ''}
                    onChange={(e) => updateData('username', e.target.value)}
                    placeholder="your@email.com"
                    className="flex-1"
                  />
                  {data.username && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(data.username, 'username')}
                    >
                      {copied === 'username' ? 
                        <Check className="w-4 h-4 text-[hsl(var(--success))]" /> : 
                        <Copy className="w-4 h-4" />
                      }
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="space-y-3">
                  <div className="flex space-x-2">
                    <div className="relative flex-1">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={data.password || ''}
                        onChange={(e) => updateData('password', e.target.value)}
                        placeholder="Enter password"
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
                        {data.password && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(data.password, 'password')}
                          >
                            {copied === 'password' ? 
                              <Check className="w-3 h-3 text-[hsl(var(--success))]" /> : 
                              <Copy className="w-3 h-3" />
                            }
                          </Button>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={generatePassword}
                      className="shrink-0"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Generate
                    </Button>
                  </div>

                  {/* Password Generator */}
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
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="url">Website URL</Label>
                <Input
                  id="url"
                  value={data.url || ''}
                  onChange={(e) => updateData('url', e.target.value)}
                  placeholder="https://example.com"
                />
              </div>
            </>
          )}

          {/* API / Service Credential Fields */}
          {type === 'api' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="serverUrl">Server URL</Label>
                <div className="flex space-x-2">
                  <Input
                    id="serverUrl"
                    value={data.serverUrl || ''}
                    onChange={(e) => updateData('serverUrl', e.target.value)}
                    placeholder="http://localhost:8096"
                  />
                  {data.serverUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(data.serverUrl, 'serverUrl')}
                    >
                      {copied === 'serverUrl' ? (
                        <Check className="w-4 h-4 text-[hsl(var(--success))]" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Base URL of the service (e.g. Jellyfin, Jellyseerr, Sonarr, etc.)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <div className="flex space-x-2">
                  <div className="relative flex-1">
                    <Input
                      id="apiKey"
                      type={showPassword ? 'text' : 'password'}
                      value={data.apiKey || ''}
                      onChange={(e) => updateData('apiKey', e.target.value)}
                      placeholder="Enter API key"
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
                      {data.apiKey && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(data.apiKey, 'apiKey')}
                        >
                            {copied === 'apiKey' ? (
                              <Check className="w-3 h-3 text-[hsl(var(--success))]" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Store service API key securely. You can link this credential on service pages.
                </p>
              </div>
            </div>
          )}

          {/* Secure Note Fields */}
          {type === 'note' && (
            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={data.content || ''}
                onChange={(e) => updateData('content', e.target.value)}
                placeholder="Enter your secure note content"
                rows={6}
              />
            </div>
          )}

          {/* Document Fields */}
          {type === 'document' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="documentType">Document Type</Label>
                <Input
                  id="documentType"
                  value={data.documentType || ''}
                  onChange={(e) => updateData('documentType', e.target.value)}
                  placeholder="e.g., Passport, License, Certificate"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="documentNumber">Document Number</Label>
                <Input
                  id="documentNumber"
                  value={data.documentNumber || ''}
                  onChange={(e) => updateData('documentNumber', e.target.value)}
                  placeholder="Document number or ID"
                />
              </div>
            </>
          )}

          {/* Notes field for all types */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={data.notes || ''}
              onChange={(e) => updateData('notes', e.target.value)}
              placeholder="Additional notes or information"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          {item && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {item ? 'Save Changes' : 'Add Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}