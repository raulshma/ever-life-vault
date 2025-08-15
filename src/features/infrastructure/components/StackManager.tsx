import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Server, 
  Search, 
  Filter, 
  FileText,
  Edit,
  Eye
} from "lucide-react";
import type { DockerComposeConfig } from "@/features/infrastructure/types";

interface StackManagerProps {
  configs: DockerComposeConfig[];
  onRefresh?: () => void;
  onEditConfig?: (config: DockerComposeConfig) => void;
  onViewConfig?: (config: DockerComposeConfig) => void;
}

const formatTimestamp = (timestamp: string): string => {
  return new Date(timestamp).toLocaleString();
};

export const StackManager: React.FC<StackManagerProps> = ({ 
  configs, 
  onRefresh, 
  onEditConfig, 
  onViewConfig 
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  // Filter configs based on search term
  const filteredConfigs = configs.filter(config => {
    const matchesSearch = config.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (config.description && config.description.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  const handleEditConfig = (config: DockerComposeConfig) => {
    if (onEditConfig) {
      onEditConfig(config);
    }
  };

  const handleViewConfig = (config: DockerComposeConfig) => {
    if (onViewConfig) {
      onViewConfig(config);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Docker Compose Configurations</h2>
          <p className="text-muted-foreground">
            Manage your Docker Compose files and configurations
          </p>
        </div>
        {onRefresh && (
          <Button 
            onClick={onRefresh} 
            variant="outline"
            className="flex items-center gap-2"
          >
            <Server className="h-4 w-4" />
            Refresh
          </Button>
        )}
      </div>

      {/* Search Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search configurations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Configuration List */}
      <div className="grid gap-4">
        {filteredConfigs.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">
                  {searchTerm ? "No matching configurations found" : "No configurations created"}
                </p>
                <p className="text-sm">
                  {searchTerm 
                    ? "Try adjusting your search criteria"
                    : "Create your first Docker Compose configuration to get started"
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredConfigs.map((config) => (
            <Card key={config.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-blue-500" />
                    <div>
                      <CardTitle className="text-lg">{config.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {config.description || "No description provided"}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-8 px-3"
                      onClick={() => handleViewConfig(config)}
                      title="View Configuration"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-8 px-3"
                      onClick={() => handleEditConfig(config)}
                      title="Edit Configuration"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {/* Configuration Metadata */}
                <div className="space-y-3">
                  {config.metadata?.services && config.metadata.services.length > 0 && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Server className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Services</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {config.metadata.services.map((service, index) => (
                          <div key={index} className="text-xs bg-background px-2 py-1 rounded border">
                            <span className="font-medium">{service.name}</span>
                            {service.image && (
                              <span className="text-muted-foreground ml-1">({service.image})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Configuration Metadata */}
                <div className="mt-4 pt-3 border-t text-xs text-muted-foreground flex flex-wrap gap-4">
                  <span>Created: {formatTimestamp(config.created_at)}</span>
                  <span>Updated: {formatTimestamp(config.updated_at)}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

    </div>
  );
};