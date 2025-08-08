import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Shield,
  Key,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Plus,
  AlertTriangle,
  Loader2,
  Edit,
  Trash2,
  ExternalLink,
  Check,
  Search,
  Settings,
  Zap,
  RefreshCw,
  Download,
  Upload,
} from "lucide-react";
import { useVaultSession } from "@/hooks/useVaultSession";
import { useEncryptedVault } from "@/hooks/useEncryptedVault";
import { MasterPasswordSetup } from "@/components/MasterPasswordSetup";
import { VaultUnlock } from "@/components/VaultUnlock";
import { EncryptedVaultDialog } from "@/components/EncryptedVaultDialog";
import { VaultItem } from "@/lib/crypto";
import { useToast } from "@/hooks/use-toast";

// Quick Add Credentials Component
function QuickAddCredentials({
  onAdd,
}: {
  onAdd: (
    item: Omit<VaultItem, "id" | "created_at" | "updated_at">
  ) => Promise<VaultItem | null>;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [quickForm, setQuickForm] = useState({
    type: "login" as "login" | "api",
    name: "",
    secret: "",
  });
  // Local toast (separate from parent) so we can surface quick-add errors clearly
  const { toast } = useToast();

  const generateSecret = () => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";
    const length = quickForm.type === "api" ? 40 : 20; // Slightly longer defaults for stronger secrets
    const randomValues = new Uint32Array(length);
    crypto.getRandomValues(randomValues);
    let generated = "";
    for (let i = 0; i < length; i++) {
      generated += chars[randomValues[i] % chars.length];
    }
    setQuickForm((prev) => ({ ...prev, secret: generated }));
  };

  const handleQuickAdd = async () => {
    if (!quickForm.name.trim() || !quickForm.secret.trim()) return;

    setIsAdding(true);
    try {
      const newItem = {
        type: quickForm.type,
        name: quickForm.name,
        data:
          quickForm.type === "login"
            ? { password: quickForm.secret }
            : { apiKey: quickForm.secret },
      };
      const saved = await onAdd(newItem);
      if (saved) {
        // Reset only on success so user doesn't lose unsaved input silently
        setQuickForm({ type: "login", name: "", secret: "" });
        toast({
          title: "Item Added",
          description: `Quick ${quickForm.type === "api" ? "API key" : "login password"} stored securely.`,
        });
      } else {
        toast({
          title: "Save Failed",
          description: "Couldn't store the item. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleQuickAdd();
    }
  };

  const getSecretLabel = () => {
    switch (quickForm.type) {
      case "api":
        return "API Key";
      default:
        return "Password";
    }
  };

  const getSecretPlaceholder = () => {
    switch (quickForm.type) {
      case "api":
        return "Enter or generate API key";
      default:
        return "Enter or generate password";
    }
  };

  return (
    <Card className="border-blue-200 bg-blue-50 shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-3">
        <div className="flex items-center space-x-2 mb-2">
          <Zap className="w-4 h-4 text-teal-500" />
          <h3 className="font-semibold text-blue-800 text-sm">Quick Add</h3>
        </div>

        {/* Responsive Layout */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2">
          {/* Type Selection */}
          <div className="flex space-x-1 sm:flex-shrink-0">
            <Button
              type="button"
              variant={quickForm.type === "login" ? "default" : "outline"}
              size="sm"
              onClick={() =>
                setQuickForm((prev) => ({ ...prev, type: "login", secret: "" }))
              }
              className="h-8 px-2 flex-1 sm:flex-none"
            >
              <Key className="w-3 h-3 mr-1" />
              Login
            </Button>
            <Button
              type="button"
              variant={quickForm.type === "api" ? "default" : "outline"}
              size="sm"
              onClick={() =>
                setQuickForm((prev) => ({ ...prev, type: "api", secret: "" }))
              }
              className="h-8 px-2 flex-1 sm:flex-none"
            >
              <Shield className="w-3 h-3 mr-1" />
              API
            </Button>
          </div>

          {/* Input Fields Row */}
          <div className="flex space-x-2 flex-1">
            {/* Name Field */}
            <Input
              placeholder={
                quickForm.type === "api" ? "Service name" : "Website name"
              }
              value={quickForm.name}
              onChange={(e) =>
                setQuickForm((prev) => ({ ...prev, name: e.target.value }))
              }
              onKeyPress={handleKeyPress}
              className="h-8 text-sm flex-1 min-w-0"
            />

            {/* Secret Field with Generate Button */}
            <div className="flex space-x-1 flex-1">
              <Input
                type="password"
                placeholder={quickForm.type === "api" ? "API key" : "Password"}
                value={quickForm.secret}
                onChange={(e) =>
                  setQuickForm((prev) => ({ ...prev, secret: e.target.value }))
                }
                onKeyPress={handleKeyPress}
                className="h-8 text-sm flex-1 min-w-0"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generateSecret}
                className="h-8 px-2 flex-shrink-0"
                title={`Generate ${getSecretLabel()}`}
              >
                <RefreshCw className="w-3 h-3" />
              </Button>
            </div>

            {/* Add Button */}
            <Button
              onClick={handleQuickAdd}
              disabled={
                !quickForm.name.trim() || !quickForm.secret.trim() || isAdding
              }
              className="h-8 bg-teal-600 hover:bg-teal-700 px-3 flex-shrink-0"
              size="sm"
            >
              {isAdding ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Plus className="w-3 h-3" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Vault() {
  const {
    isUnlocked,
    hasVault,
    loading: sessionLoading,
    initializeVault,
    unlockVault,
    lockVault,
  } = useVaultSession();

  const {
    itemsByType,
    loading: vaultLoading,
    searchQuery,
    addItem,
    updateItem,
    deleteItem,
    searchItems,
    exportVaultData,
    importVaultData,
    totalItems,
  } = useEncryptedVault();

  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(
    new Set()
  );
  const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [copiedItems, setCopiedItems] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const { toast } = useToast();

  // Show setup screen if no vault exists
  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading vault...</p>
        </div>
      </div>
    );
  }

  if (!hasVault) {
    return (
      <MasterPasswordSetup onSetup={initializeVault} loading={sessionLoading} />
    );
  }

  if (!isUnlocked) {
    return <VaultUnlock onUnlock={unlockVault} loading={sessionLoading} />;
  }

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedItems((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setCopiedItems((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }, 2000);
  };

  const handleAddItem = (type: "login" | "note" | "api" | "document") => {
    setSelectedItem(null);
    setShowDialog(true);
  };

  const handleEditItem = (item: VaultItem) => {
    setSelectedItem(item);
    setShowDialog(true);
  };

  const handleExport = async () => {
    if (totalItems === 0) {
      toast({
        title: "Nothing to Export",
        description: "Your vault is empty. Add some items first.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      const exportData = await exportVaultData();
      if (exportData) {
        // Create and download the file
        const blob = new Blob([exportData], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `vault-backup-${
          new Date().toISOString().split("T")[0]
        }.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: "Export Successful",
          description: `Exported ${totalItems} vault items to encrypted backup file.`,
        });
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Import file must be smaller than 10MB.",
          variant: "destructive",
        });
        return;
      }

      // Basic validation of JSON structure
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!parsed.version || !parsed.encrypted) {
          throw new Error("Invalid backup file format");
        }

        // Show confirmation dialog
        setPendingImportFile(file);
        setShowImportDialog(true);
      } catch (parseError) {
        toast({
          title: "Invalid File",
          description: "The selected file is not a valid vault backup.",
          variant: "destructive",
        });
      }
    };
    input.click();
  };

  const confirmImport = async () => {
    if (!pendingImportFile) return;

    setIsImporting(true);
    setShowImportDialog(false);

    try {
      const text = await pendingImportFile.text();
      await importVaultData(text);
    } catch (error) {
      toast({
        title: "Import Error",
        description: "Failed to read the import file.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      setPendingImportFile(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle pb-20 md:pb-8">
      {/* Header */}
      <div className="bg-gradient-hero text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center">
                <Shield className="w-8 h-8 mr-3" />
                Secure Vault
              </h1>
              <p className="text-white/90">
                End-to-end encrypted credential storage
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-800"
              >
                <Lock className="w-3 h-3 mr-1" />
                Encrypted
              </Badge>
              <div className="flex items-center space-x-2">
                <Button
                  variant="hero"
                  className="bg-white/20 hover:bg-white/30"
                  onClick={handleExport}
                  disabled={isExporting || totalItems === 0}
                  title={`Export all ${totalItems} vault items to encrypted backup file`}
                >
                  {isExporting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Export
                </Button>
                <Button
                  variant="hero"
                  className="bg-white/20 hover:bg-white/30"
                  onClick={handleImport}
                  disabled={isImporting}
                  title="Import vault data from encrypted backup file"
                >
                  {isImporting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Import
                </Button>
              </div>
              <Button
                variant="hero"
                className="bg-white/20 hover:bg-white/30"
                onClick={lockVault}
              >
                <Lock className="w-4 h-4 mr-2" />
                Lock Vault
              </Button>
              <Button
                variant="hero"
                className="bg-white/20 hover:bg-white/30"
                onClick={() => handleAddItem("login")}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Search and Security Notice */}
        <div className="mb-8 space-y-4">
          {/* Search Bar */}
          <Card>
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search your vault items..."
                  value={searchQuery}
                  onChange={(e) => searchItems(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Security Notice */}
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-6">
              <div className="flex items-start space-x-3">
                <Shield className="w-5 h-5 text-emerald-500 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-green-800 mb-1">
                    End-to-End Encryption Active
                  </h3>
                  <p className="text-green-700 text-sm">
                    Your vault is secured with AES-256-GCM encryption. All data
                    is encrypted on your device before being stored.
                    Zero-knowledge architecture ensures complete privacy.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Export/Import Info */}
          {totalItems > 0 && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <div className="flex space-x-2">
                    <Download className="w-4 h-4 text-teal-500 mt-0.5" />
                    <Upload className="w-4 h-4 text-teal-500 mt-0.5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-blue-800 mb-1">
                      Backup & Restore
                    </h3>
                    <p className="text-teal-700 text-sm">
                      Export your vault to create encrypted backups. Import from
                      backup files to restore data. All exports are encrypted
                      with your master password for maximum security.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Add Section */}
          <QuickAddCredentials onAdd={addItem} />
        </div>

        {/* Vault Categories */}
        {vaultLoading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Decrypting vault items...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Login Credentials */}
            <Card className="bg-gradient-card shadow-card hover:shadow-elegant transition-all duration-300">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Key className="w-5 h-5 mr-2 text-cyan-500" />
                  Login Credentials ({itemsByType.login.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {itemsByType.login.length > 0 ? (
                    itemsByType.login.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-white rounded-lg border group hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <div className="font-medium text-sm truncate">
                                {item.name}
                              </div>
                              {item.data.url && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() =>
                                    window.open(item.data.url, "_blank")
                                  }
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {item.data.username}
                            </div>
                          </div>
                          <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => togglePasswordVisibility(item.id)}
                            >
                              {visiblePasswords.has(item.id) ? (
                                <EyeOff className="w-3 h-3" />
                              ) : (
                                <Eye className="w-3 h-3" />
                              )}
                            </Button>
                            {item.data.username && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() =>
                                  copyToClipboard(
                                    item.data.username,
                                    `${item.id}-username`
                                  )
                                }
                              >
                                {copiedItems.has(`${item.id}-username`) ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleEditItem(item)}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        {visiblePasswords.has(item.id) &&
                          item.data.password && (
                            <div className="mt-2 p-2 bg-muted rounded text-xs font-mono break-all flex items-center justify-between">
                              <span className="truncate mr-2">
                                {item.data.password}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 shrink-0"
                                onClick={() =>
                                  copyToClipboard(
                                    item.data.password,
                                    `${item.id}-password`
                                  )
                                }
                              >
                                {copiedItems.has(`${item.id}-password`) ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                          )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Lock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No login credentials yet</p>
                    </div>
                  )}
                </div>

                <Button
                  variant="ghost"
                  className="w-full mt-4 text-teal-600"
                  onClick={() => handleAddItem("login")}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Login
                </Button>
              </CardContent>
            </Card>

            {/* Secure Notes */}
            <Card className="bg-gradient-card shadow-card hover:shadow-elegant transition-all duration-300">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Lock className="w-5 h-5 mr-2 text-emerald-500" />
                  Secure Notes ({itemsByType.note.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {itemsByType.note.length > 0 ? (
                    itemsByType.note.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-white rounded-lg border group hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {item.name}
                            </div>
                            {item.data.content && (
                              <div className="text-xs text-muted-foreground truncate">
                                {item.data.content.substring(0, 50)}...
                              </div>
                            )}
                          </div>
                          <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => togglePasswordVisibility(item.id)}
                            >
                              {visiblePasswords.has(item.id) ? (
                                <EyeOff className="w-3 h-3" />
                              ) : (
                                <Eye className="w-3 h-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleEditItem(item)}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        {visiblePasswords.has(item.id) && item.data.content && (
                          <div className="mt-2 p-2 bg-muted rounded text-xs whitespace-pre-wrap">
                            {item.data.content}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Lock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No secure notes yet</p>
                    </div>
                  )}
                </div>

                <Button
                  variant="ghost"
                  className="w-full mt-4 text-emerald-600"
                  onClick={() => handleAddItem("note")}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Secure Note
                </Button>
              </CardContent>
            </Card>

            {/* API Keys */}
            <Card className="bg-gradient-card shadow-card hover:shadow-elegant transition-all duration-300">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Key className="w-5 h-5 mr-2 text-purple-600" />
                  API Keys ({itemsByType.api.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {itemsByType.api.length > 0 ? (
                    itemsByType.api.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-white rounded-lg border group hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {item.name}
                            </div>
                            {item.data.notes && (
                              <div className="text-xs text-muted-foreground truncate">
                                {item.data.notes}
                              </div>
                            )}
                          </div>
                          <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => togglePasswordVisibility(item.id)}
                            >
                              {visiblePasswords.has(item.id) ? (
                                <EyeOff className="w-3 h-3" />
                              ) : (
                                <Eye className="w-3 h-3" />
                              )}
                            </Button>
                            {item.data.apiKey && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() =>
                                  copyToClipboard(
                                    item.data.apiKey,
                                    `${item.id}-key`
                                  )
                                }
                              >
                                {copiedItems.has(`${item.id}-key`) ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleEditItem(item)}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        {visiblePasswords.has(item.id) && item.data.apiKey && (
                          <div className="mt-2 p-2 bg-muted rounded text-xs font-mono break-all">
                            {item.data.apiKey}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Key className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No API keys yet</p>
                    </div>
                  )}
                </div>

                <Button
                  variant="ghost"
                  className="w-full mt-4 text-purple-600"
                  onClick={() => handleAddItem("api")}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add API Key
                </Button>
              </CardContent>
            </Card>

            {/* Documents */}
            <Card className="bg-gradient-card shadow-card hover:shadow-elegant transition-all duration-300">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Shield className="w-5 h-5 mr-2 text-orange-600" />
                  Documents ({itemsByType.document.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {itemsByType.document.length > 0 ? (
                    itemsByType.document.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-white rounded-lg border group hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {item.name}
                            </div>
                            {item.data.documentType && (
                              <div className="text-xs text-muted-foreground truncate">
                                {item.data.documentType}
                              </div>
                            )}
                          </div>
                          <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => togglePasswordVisibility(item.id)}
                            >
                              {visiblePasswords.has(item.id) ? (
                                <EyeOff className="w-3 h-3" />
                              ) : (
                                <Eye className="w-3 h-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleEditItem(item)}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        {visiblePasswords.has(item.id) && (
                          <div className="mt-2 p-2 bg-muted rounded text-xs space-y-1">
                            {item.data.documentNumber && (
                              <div>
                                <strong>Number:</strong>{" "}
                                {item.data.documentNumber}
                              </div>
                            )}
                            {item.data.notes && (
                              <div>
                                <strong>Notes:</strong> {item.data.notes}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No documents yet</p>
                    </div>
                  )}
                </div>

                <Button
                  variant="ghost"
                  className="w-full mt-4 text-orange-600"
                  onClick={() => handleAddItem("document")}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Document
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Security Features */}
        <Card className="mt-8 bg-gradient-card shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Security Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Lock className="w-6 h-6 text-emerald-500" />
                </div>
                <h3 className="font-semibold mb-2">AES-256-GCM</h3>
                <p className="text-sm text-muted-foreground">
                  Military-grade encryption with authentication
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Key className="w-6 h-6 text-cyan-500" />
                </div>
                <h3 className="font-semibold mb-2">PBKDF2</h3>
                <p className="text-sm text-muted-foreground">
                  100,000 iterations for key derivation
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Shield className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="font-semibold mb-2">Zero Knowledge</h3>
                <p className="text-sm text-muted-foreground">
                  Server never sees your decrypted data
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <AlertTriangle className="w-6 h-6 text-orange-600" />
                </div>
                <h3 className="font-semibold mb-2">Auto-Lock</h3>
                <p className="text-sm text-muted-foreground">
                  Automatically locks after 15 minutes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Encrypted Vault Dialog */}
        <EncryptedVaultDialog
          item={selectedItem}
          open={showDialog}
          onOpenChange={setShowDialog}
          onSave={addItem}
          onUpdate={updateItem}
          onDelete={deleteItem}
        />

        {/* Import Confirmation Dialog */}
        <AlertDialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center">
                <Upload className="w-5 h-5 mr-2" />
                Import Vault Data
              </AlertDialogTitle>
              <AlertDialogDescription>
                You're about to import vault data from a backup file. This will:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Add new items to your vault</li>
                  <li>Skip items that already exist (duplicates)</li>
                  <li>Require your master password to decrypt the backup</li>
                </ul>
                <p className="mt-3 font-medium">
                  File: {pendingImportFile?.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  This action cannot be undone. Make sure you have a current
                  backu p before proceeding.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingImportFile(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={confirmImport}>
                Import Data
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
