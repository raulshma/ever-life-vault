import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DockerImportDialog } from './DockerImportDialog';
import { parseDockerCommand, importDockerCompose } from '../utils/dockerUtils';
import type { DockerComposeConfig } from '../types';

export const DockerImportDemo: React.FC = () => {
  const [importedConfig, setImportedConfig] = useState<Partial<DockerComposeConfig> | null>(null);
  const [demoResults, setDemoResults] = useState<{
    command: string;
    result: any;
  }[]>([]);

  const handleImport = (config: Partial<DockerComposeConfig>) => {
    setImportedConfig(config);
  };

  const runDemoCommands = () => {
    const demoCommands = [
      'docker run -d --name nginx-web -p 8080:80 nginx:alpine',
      'docker run -d --name redis-cache -p 6379:6379 --restart unless-stopped redis:alpine',
      'docker run -d --name postgres-db -p 5432:5432 -e POSTGRES_PASSWORD=secret -e POSTGRES_DB=myapp postgres:13-alpine'
    ];

    const results = demoCommands.map(command => ({
      command,
      result: parseDockerCommand(command)
    }));

    setDemoResults(results);
  };

  const demoCompose = `version: '3.8'
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

  const runComposeDemo = () => {
    const result = importDockerCompose(demoCompose);
    setDemoResults([{
      command: 'Docker Compose Import',
      result
    }]);
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold">Docker Import Demo</h2>
        <p className="text-muted-foreground">
          See the Docker import functionality in action
        </p>
      </div>

      {/* Import Dialog Demo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🚀 Try It Yourself
          </CardTitle>
          <CardDescription>
            Use the import dialog to convert Docker commands or import Docker Compose files
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DockerImportDialog onImport={handleImport} />
          
          {importedConfig && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Imported Configuration:</h4>
              <div className="space-y-2 text-sm">
                <div><strong>Name:</strong> {importedConfig.name}</div>
                <div><strong>Description:</strong> {importedConfig.description}</div>
                <div><strong>Services:</strong> {importedConfig.metadata?.services?.length || 0}</div>
                <div><strong>Volumes:</strong> {importedConfig.metadata?.volumes?.length || 0}</div>
                <div><strong>Networks:</strong> {importedConfig.metadata?.networks?.length || 0}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Demo Commands */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🧪 Demo Commands
          </CardTitle>
          <CardDescription>
            See how Docker run commands are automatically converted to Docker Compose format
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={runDemoCommands} variant="outline">
              Run Command Demos
            </Button>
            <Button onClick={runComposeDemo} variant="outline">
              Run Compose Demo
            </Button>
          </div>

          {demoResults.length > 0 && (
            <div className="space-y-4">
              <Separator />
              <h4 className="font-semibold">Demo Results:</h4>
              
              {demoResults.map((demo, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={demo.result.success ? 'default' : 'destructive'}>
                      {demo.result.success ? 'Success' : 'Error'}
                    </Badge>
                    <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                      {demo.command}
                    </span>
                  </div>
                  
                  {demo.result.success ? (
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">
                        Converted to Docker Compose format:
                      </div>
                      <div className="bg-muted p-3 rounded font-mono text-xs">
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(demo.result.composeConfig, null, 2)}
                        </pre>
                      </div>
                      
                      {demo.result.warnings && demo.result.warnings.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-amber-600">Warnings:</div>
                          <ul className="list-disc list-inside text-sm text-amber-600">
                            {demo.result.warnings.map((warning: string, i: number) => (
                              <li key={i}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-red-600">
                      Error: {demo.result.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Features Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            ✨ Features Overview
          </CardTitle>
          <CardDescription>
            What you can do with the Docker import functionality
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <h4 className="font-semibold">🔄 Docker Command Conversion</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Convert docker run commands to Compose</li>
                <li>• Support for ports, volumes, environment</li>
                <li>• Automatic restart policy detection</li>
                <li>• Resource limit parsing</li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-semibold">📁 Docker Compose Import</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Paste YAML content directly</li>
                <li>• File upload support</li>
                <li>• Validation and error checking</li>
                <li>• Smart parsing with warnings</li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-semibold">⚡ Quick Import</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• One-click import to editor</li>
                <li>• Automatic configuration loading</li>
                <li>• Seamless workflow integration</li>
                <li>• Preview before import</li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-semibold">🔧 Advanced Features</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Protocol-aware port mapping</li>
                <li>• Volume mount mode detection</li>
                <li>• Environment variable parsing</li>
                <li>• Working directory support</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Examples */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📚 Usage Examples
          </CardTitle>
          <CardDescription>
            Common Docker commands and their Compose equivalents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h5 className="font-medium">Basic Web Server</h5>
                <div className="bg-muted p-3 rounded font-mono text-xs">
                  <div>docker run -d \</div>
                  <div>  --name nginx \</div>
                  <div>  -p 80:80 \</div>
                  <div>  nginx:alpine</div>
                </div>
              </div>
              
              <div className="space-y-2">
                <h5 className="font-medium">Database with Environment</h5>
                <div className="bg-muted p-3 rounded font-mono text-xs">
                  <div>docker run -d \</div>
                  <div>  --name postgres \</div>
                  <div>  -p 5432:5432 \</div>
                  <div>  -e POSTGRES_PASSWORD=secret \</div>
                  <div>  postgres:13</div>
                </div>
              </div>
            </div>
            
            <div className="text-center">
              <Badge variant="outline" className="text-lg px-4 py-2">
                ↓ Converts to ↓
              </Badge>
            </div>
            
            <div className="bg-muted p-4 rounded font-mono text-xs">
              <pre className="whitespace-pre-wrap">
{`services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    restart: unless-stopped

  postgres:
    image: postgres:13
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_PASSWORD=secret
    restart: unless-stopped`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
