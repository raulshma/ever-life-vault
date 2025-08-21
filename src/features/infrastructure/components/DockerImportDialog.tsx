import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Terminal, FileText, AlertCircle, CheckCircle, X } from 'lucide-react';
import { parseDockerCommand, importDockerCompose, type DockerCommandParseResult, type DockerComposeImportResult } from '../utils/dockerUtils';
import type { DockerComposeConfig } from '../types';

interface DockerImportDialogProps {
  onImport: (config: Partial<DockerComposeConfig>) => void;
  trigger?: React.ReactNode;
}

export const DockerImportDialog: React.FC<DockerImportDialogProps> = ({
  onImport,
  trigger
}) => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('compose');
  
  // Docker Compose import state
  const [composeYaml, setComposeYaml] = useState('');
  const [composeResult, setComposeResult] = useState<DockerComposeImportResult | null>(null);
  
  // Docker command import state
  const [dockerCommand, setDockerCommand] = useState('');
  const [commandResult, setCommandResult] = useState<DockerCommandParseResult | null>(null);
  
  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleComposeImport = () => {
    if (!composeYaml.trim()) return;
    
    const result = importDockerCompose(composeYaml);
    setComposeResult(result);
    
    if (result.success && result.composeConfig) {
      // Auto-import after successful parsing
      setTimeout(() => {
        if (result.composeConfig) {
          onImport(result.composeConfig);
        }
        setOpen(false);
        resetState();
      }, 1000);
    }
  };

  const handleCommandImport = () => {
    if (!dockerCommand.trim()) return;
    
    const result = parseDockerCommand(dockerCommand);
    setCommandResult(result);
    
          if (result.success && result.composeConfig) {
        // Auto-import after successful parsing
        setTimeout(() => {
          if (result.composeConfig) {
            onImport(result.composeConfig);
          }
          setOpen(false);
          resetState();
        }, 1000);
      }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    
    // Read file content
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setComposeYaml(content);
      setActiveTab('compose');
    };
    reader.readAsText(file);
  };

  const resetState = () => {
    setComposeYaml('');
    setDockerCommand('');
    setComposeResult(null);
    setCommandResult(null);
    setSelectedFile(null);
    setActiveTab('compose');
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      resetState();
    }
  };

  const getExampleCommand = () => {
    return 'docker run -d --name nginx-web -p 8080:80 -v /host/path:/var/www/html:ro -e NGINX_HOST=example.com --restart unless-stopped nginx:alpine';
  };

  const getExampleCompose = () => {
    return `version: '3.8'
services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"
    volumes:
      - ./html:/var/www/html:ro
    environment:
      - NGINX_HOST=example.com
    restart: unless-stopped`;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Import Configuration
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Docker Configuration
          </DialogTitle>
          <DialogDescription>
            Import Docker Compose files or convert Docker run commands to Docker Compose format
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="compose" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Docker Compose
            </TabsTrigger>
            <TabsTrigger value="command" className="flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              Docker Command
            </TabsTrigger>
            <TabsTrigger value="file" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              File Upload
            </TabsTrigger>
          </TabsList>

          {/* Docker Compose Import Tab */}
          <TabsContent value="compose" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="compose-yaml">Docker Compose YAML</Label>
                <Textarea
                  id="compose-yaml"
                  value={composeYaml}
                  onChange={(e) => setComposeYaml(e.target.value)}
                  placeholder="Paste your Docker Compose YAML here..."
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Button onClick={handleComposeImport} disabled={!composeYaml.trim()}>
                  Import Compose
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setComposeYaml(getExampleCompose())}
                  type="button"
                >
                  Load Example
                </Button>
              </div>

              {composeResult && (
                <Alert className={composeResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                  {composeResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                  <AlertDescription className={composeResult.success ? 'text-green-800' : 'text-red-800'}>
                    {composeResult.success ? 'Import successful!' : composeResult.error}
                    {composeResult.warnings && composeResult.warnings.length > 0 && (
                      <div className="mt-2">
                        <strong>Warnings:</strong>
                        <ul className="list-disc list-inside mt-1">
                          {composeResult.warnings.map((warning, index) => (
                            <li key={index}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </TabsContent>

          {/* Docker Command Import Tab */}
          <TabsContent value="command" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="docker-command">Docker Run Command</Label>
                <Input
                  id="docker-command"
                  value={dockerCommand}
                  onChange={(e) => setDockerCommand(e.target.value)}
                  placeholder="docker run -d --name my-app -p 8080:80 nginx:alpine"
                  className="font-mono"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Button onClick={handleCommandImport} disabled={!dockerCommand.trim()}>
                  Convert to Compose
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setDockerCommand(getExampleCommand())}
                  type="button"
                >
                  Load Example
                </Button>
              </div>

              {commandResult && (
                <Alert className={commandResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                  {commandResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                  <AlertDescription className={commandResult.success ? 'text-green-800' : 'text-red-800'}>
                    {commandResult.success ? 'Command converted successfully!' : commandResult.error}
                    {commandResult.warnings && commandResult.warnings.length > 0 && (
                      <div className="mt-2">
                        <strong>Warnings:</strong>
                        <ul className="list-disc list-inside mt-1">
                          {commandResult.warnings.map((warning, index) => (
                            <li key={index}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="text-sm text-muted-foreground">
                <p><strong>Supported options:</strong></p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li><code>-p, --publish</code> - Port mappings</li>
                  <li><code>-v, --volume</code> - Volume mounts</li>
                  <li><code>-e, --env</code> - Environment variables</li>
                  <li><code>--name</code> - Container name</li>
                  <li><code>-w, --workdir</code> - Working directory</li>
                  <li><code>--restart</code> - Restart policy</li>
                  <li><code>--memory</code> - Memory limit</li>
                  <li><code>--cpus</code> - CPU limit</li>
                </ul>
              </div>
            </div>
          </TabsContent>

          {/* File Upload Tab */}
          <TabsContent value="file" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="file-upload">Upload Docker Compose File</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Drag and drop a docker-compose.yml file here, or click to browse
                  </p>
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".yml,.yaml"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => document.getElementById('file-upload')?.click()}
                    type="button"
                  >
                    Choose File
                  </Button>
                </div>
              </div>

              {selectedFile && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="text-sm font-medium">{selectedFile.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {selectedFile && composeYaml && (
                <div className="space-y-2">
                  <Label>File Preview</Label>
                  <div className="max-h-40 overflow-y-auto border rounded-lg p-3 bg-muted">
                    <pre className="text-xs font-mono whitespace-pre-wrap">{composeYaml}</pre>
                  </div>
                  <Button onClick={handleComposeImport} className="w-full">
                    Import from File
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
