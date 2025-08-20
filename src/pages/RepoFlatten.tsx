import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  GitBranch, 
  Download, 
  ExternalLink,
  Loader2,
  FileText,
  Eye,
  Copy,
  CheckCircle,
  AlertCircle,
  Github,
  Zap
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import PageHeader from '@/components/PageHeader';
import { useToast } from '@/hooks/use-toast';

interface RepoFlattenResult {
  html: string;
  stats: {
    totalFiles: number;
    renderedFiles: number;
    skippedFiles: number;
  };
}

export default function RepoFlatten() {
  const [repoUrl, setRepoUrl] = useState('');
  const [maxBytes, setMaxBytes] = useState(50 * 1024); // 50 KiB default
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RepoFlattenResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!repoUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a GitHub repository URL",
        variant: "destructive"
      });
      return;
    }

    // Basic URL validation
    try {
      const url = new URL(repoUrl);
      if (!url.hostname.includes('github.com')) {
        throw new Error('Not a GitHub URL');
      }
    } catch {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid GitHub repository URL",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/repo-flatten', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repoUrl: repoUrl.trim(),
          maxBytes
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      
      // Extract stats from HTML (simple regex parsing)
      const totalMatch = html.match(/Total files:<\/strong>\s*(\d+)/);
      const renderedMatch = html.match(/Rendered:<\/strong>\s*(\d+)/);
      const skippedMatch = html.match(/Skipped:<\/strong>\s*(\d+)/);
      
      const stats = {
        totalFiles: totalMatch ? parseInt(totalMatch[1]) : 0,
        renderedFiles: renderedMatch ? parseInt(renderedMatch[1]) : 0,
        skippedFiles: skippedMatch ? parseInt(skippedMatch[1]) : 0
      };

      setResult({ html, stats });
      
      toast({
        title: "Success!",
        description: `Repository flattened successfully. ${stats.renderedFiles} files processed.`,
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    
    try {
      // Extract repo name from URL for filename
      let filename = 'repo-flattened.html';
      try {
        const urlParts = repoUrl.trim().split('/');
        const repoName = urlParts[urlParts.length - 1].replace('.git', '');
        filename = `${repoName}-flattened.html`;
      } catch {
        // Use default filename
      }
      
      // Try modern download approach first
      if ('showSaveFilePicker' in window) {
        // Use File System Access API if available (Chrome/Edge)
        const blob = new Blob([result.html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Fallback for other browsers
        const blob = new Blob([result.html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      
      toast({
        title: "Downloaded",
        description: `HTML file "${filename}" has been downloaded`,
      });
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: "Download Failed",
        description: "Could not download file. Please try copying the HTML instead.",
        variant: "destructive"
      });
    }
  };

  const handlePreview = () => {
    if (!result) return;
    
    try {
      const blob = new Blob([result.html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const newWindow = window.open(url, '_blank');
      
      if (!newWindow) {
        toast({
          title: "Popup Blocked",
          description: "Please allow popups for this site to preview the HTML",
          variant: "destructive"
        });
        return;
      }
      
      // Clean up the URL after a delay
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      
      toast({
        title: "Preview Opened",
        description: "HTML file opened in new tab",
      });
    } catch (error) {
      toast({
        title: "Preview Failed",
        description: "Could not open preview. Try downloading instead.",
        variant: "destructive"
      });
    }
  };

  const handleCopyHtml = async () => {
    if (!result) return;
    
    try {
      await navigator.clipboard.writeText(result.html);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      toast({
        title: "Copied",
        description: "HTML content copied to clipboard",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive"
      });
    }
  };

  const formatBytes = (bytes: number): string => {
    const units = ['B', 'KiB', 'MiB', 'GiB'];
    let value = bytes;
    let unitIndex = 0;
    
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    
    return unitIndex === 0 
      ? `${Math.floor(value)} ${units[unitIndex]}`
      : `${value.toFixed(1)} ${units[unitIndex]}`;
  };

  return (
    <div className="min-h-screen bg-gradient-subtle pb-20 md:pb-8">
      <PageHeader
        title="GitHub Repo Flattener"
        description="Flatten any GitHub repository into a single HTML page for fast skimming and Ctrl+F searching"
        icon={GitBranch}
      />

      <div className="max-w-4xl mx-auto px-6 py-6 sm:py-8">
        {/* Input Form */}
        <Card className="bg-gradient-card shadow-card mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Github className="w-5 h-5 mr-2" />
              Repository Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="repo-url">GitHub Repository URL</Label>
                <Input
                  id="repo-url"
                  type="url"
                  placeholder="https://github.com/username/repository"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  disabled={loading}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the full GitHub repository URL (e.g., https://github.com/user/repo)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-bytes">Maximum File Size</Label>
                <div className="flex items-center space-x-4">
                  <Input
                    id="max-bytes"
                    type="number"
                    min="1024"
                    max="1048576"
                    step="1024"
                    value={maxBytes}
                    onChange={(e) => setMaxBytes(parseInt(e.target.value) || 50 * 1024)}
                    disabled={loading}
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">
                    bytes ({formatBytes(maxBytes)})
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Files larger than this will be listed but not included in the output
                </p>
              </div>

              <Button 
                type="submit" 
                disabled={loading || !repoUrl.trim()}
                className="w-full sm:w-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing Repository...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Flatten Repository
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Loading State */}
        {loading && (
          <Card className="bg-gradient-card shadow-card mb-8">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <div className="space-y-2">
                  <p className="font-medium">Processing repository...</p>
                  <p className="text-sm text-muted-foreground">
                    This may take a few moments depending on repository size
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {error && (
          <Card className="bg-gradient-card shadow-card mb-8 border-destructive/50">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <AlertCircle className="w-6 h-6 text-destructive flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="font-medium text-destructive">Error Processing Repository</p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Common issues:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Repository is private or doesn't exist</li>
                      <li>Invalid GitHub URL format</li>
                      <li>Repository is too large or has connectivity issues</li>
                      <li>Server timeout (try again in a moment)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Success State */}
        {result && (
          <div className="space-y-6">
            {/* Stats */}
            <Card className="bg-gradient-card shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                  Processing Complete
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-card rounded-lg border">
                    <div className="text-2xl font-bold text-primary">{result.stats.totalFiles}</div>
                    <div className="text-sm text-muted-foreground">Total Files</div>
                  </div>
                  <div className="text-center p-4 bg-card rounded-lg border">
                    <div className="text-2xl font-bold text-green-600">{result.stats.renderedFiles}</div>
                    <div className="text-sm text-muted-foreground">Rendered</div>
                  </div>
                  <div className="text-center p-4 bg-card rounded-lg border">
                    <div className="text-2xl font-bold text-orange-600">{result.stats.skippedFiles}</div>
                    <div className="text-sm text-muted-foreground">Skipped</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button onClick={handleDownload} className="flex-1 sm:flex-none">
                    <Download className="w-4 h-4 mr-2" />
                    Download HTML
                  </Button>
                  <Button onClick={handlePreview} variant="outline" className="flex-1 sm:flex-none">
                    <Eye className="w-4 h-4 mr-2" />
                    Preview
                  </Button>
                  <Button onClick={handleCopyHtml} variant="outline" className="flex-1 sm:flex-none">
                    {copied ? (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    ) : (
                      <Copy className="w-4 h-4 mr-2" />
                    )}
                    {copied ? 'Copied!' : 'Copy HTML'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Features Info */}
            <Card className="bg-gradient-card shadow-card">
              <CardHeader>
                <CardTitle>Generated HTML Features</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3">
                      <Badge variant="secondary" className="mt-0.5">
                        <FileText className="w-3 h-3 mr-1" />
                        Files
                      </Badge>
                      <div className="text-sm">
                        <p className="font-medium">Syntax Highlighting</p>
                        <p className="text-muted-foreground">Code files are highlighted with proper syntax coloring</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Badge variant="secondary" className="mt-0.5">
                        <GitBranch className="w-3 h-3 mr-1" />
                        Structure
                      </Badge>
                      <div className="text-sm">
                        <p className="font-medium">Directory Tree</p>
                        <p className="text-muted-foreground">Visual representation of the repository structure</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3">
                      <Badge variant="secondary" className="mt-0.5">
                        <Eye className="w-3 h-3 mr-1" />
                        Views
                      </Badge>
                      <div className="text-sm">
                        <p className="font-medium">Dual View Mode</p>
                        <p className="text-muted-foreground">Human-readable and LLM-optimized CXML format</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Badge variant="secondary" className="mt-0.5">
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Navigation
                      </Badge>
                      <div className="text-sm">
                        <p className="font-medium">Table of Contents</p>
                        <p className="text-muted-foreground">Sidebar navigation with file links and search</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Info Card */}
        {!result && !loading && (
          <Card className="bg-gradient-card shadow-card">
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">What gets included:</h4>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-start space-x-2">
                      <span className="text-green-600 mt-0.5">•</span>
                      <span>Text files (code, markdown, config files)</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-green-600 mt-0.5">•</span>
                      <span>Syntax highlighting for code files</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-green-600 mt-0.5">•</span>
                      <span>Rendered markdown as HTML</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-green-600 mt-0.5">•</span>
                      <span>Directory tree visualization</span>
                    </li>
                  </ul>
                </div>
                <div className="space-y-4">
                  <h4 className="font-medium">What gets skipped:</h4>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-start space-x-2">
                      <span className="text-orange-600 mt-0.5">•</span>
                      <span>Binary files (images, executables, etc.)</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-orange-600 mt-0.5">•</span>
                      <span>Files larger than the size limit</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-orange-600 mt-0.5">•</span>
                      <span>Git metadata and build artifacts</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-orange-600 mt-0.5">•</span>
                      <span>Node modules and similar directories</span>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  The generated HTML file is completely self-contained and can be opened in any web browser. 
                  It includes both a human-readable view and an LLM-optimized CXML format for AI analysis.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}