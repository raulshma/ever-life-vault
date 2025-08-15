import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, Info, AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HelpTooltipProps {
  content: string;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

export const HelpTooltip: React.FC<HelpTooltipProps> = ({
  content,
  children,
  side = "top",
  align = "center"
}) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent side={side} align={align} className="max-w-xs">
          <p className="text-sm">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

interface HelpIconProps {
  content: string;
  variant?: "info" | "warning" | "success";
  side?: "top" | "right" | "bottom" | "left";
}

export const HelpIcon: React.FC<HelpIconProps> = ({
  content,
  variant = "info",
  side = "top"
}) => {
  const Icon = variant === "warning" ? AlertTriangle : 
               variant === "success" ? CheckCircle : 
               Info;
  
  const iconColor = variant === "warning" ? "text-yellow-500" : 
                   variant === "success" ? "text-green-500" : 
                   "text-muted-foreground";

  return (
    <HelpTooltip content={content} side={side}>
      <Button variant="ghost" size="sm" className="h-auto p-1">
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </Button>
    </HelpTooltip>
  );
};

interface HelpSectionProps {
  title: string;
  description: string;
  tips?: readonly string[];
  warnings?: readonly string[];
}

export const HelpSection: React.FC<HelpSectionProps> = ({
  title,
  description,
  tips = [],
  warnings = []
}) => {
  return (
    <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-2">
        <HelpCircle className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      
      {tips.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Tips
          </h4>
          <ul className="space-y-1">
            {tips.map((tip, index) => (
              <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-green-500 mt-0.5">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {warnings.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            Important Notes
          </h4>
          <ul className="space-y-1">
            {warnings.map((warning, index) => (
              <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-yellow-500 mt-0.5">•</span>
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// Predefined help content for common infrastructure concepts
export const HELP_CONTENT = {
  dockerCompose: {
    title: "Docker Compose Configuration",
    description: "Docker Compose allows you to define and run multi-container Docker applications using a YAML file.",
    tips: [
      "Use meaningful service names that describe their purpose",
      "Always specify image tags instead of using 'latest' for production",
      "Group related services using networks for better organization"
    ],
    warnings: [
      "Avoid exposing unnecessary ports to the host system",
      "Be careful with volume mounts - they can affect host system security",
      "Always validate your configuration before deploying"
    ]
  },
  
  volumeMounts: {
    title: "Volume Mounts",
    description: "Volume mounts allow containers to persist data and share files with the host system.",
    tips: [
      "Use named volumes for data that should persist between container restarts",
      "Bind mounts are useful for development when you need to edit files on the host",
      "Set appropriate permissions (uid/gid) to avoid permission issues"
    ],
    warnings: [
      "Bind mounts can expose sensitive host directories to containers",
      "Always validate host paths exist before mounting",
      "Consider using read-only mounts when containers don't need write access"
    ]
  },
  
  environmentVariables: {
    title: "Environment Variables",
    description: "Environment variables configure container behavior and pass sensitive information securely.",
    tips: [
      "Use descriptive variable names with consistent naming conventions",
      "Group related variables together in the configuration",
      "Use the secrets manager for sensitive values like passwords and API keys"
    ],
    warnings: [
      "Never store passwords or API keys directly in compose files",
      "Be careful with variable names - they're case-sensitive",
      "Some variables may require container restart to take effect"
    ]
  },
  
  networking: {
    title: "Container Networking",
    description: "Docker networks allow containers to communicate with each other and external services.",
    tips: [
      "Create custom networks to isolate groups of related services",
      "Use service names as hostnames for inter-container communication",
      "Only expose ports that need to be accessible from outside"
    ],
    warnings: [
      "Containers on the same network can communicate freely by default",
      "Port conflicts will prevent containers from starting",
      "External networks must exist before referencing them"
    ]
  },
  
  secrets: {
    title: "Secrets Management",
    description: "Secrets provide a secure way to store and inject sensitive configuration data.",
    tips: [
      "Use meaningful secret names that indicate their purpose",
      "Regularly rotate sensitive credentials",
      "Use templates to reuse common secret patterns across services"
    ],
    warnings: [
      "Secrets are encrypted at rest but visible to containers at runtime",
      "Backup your secrets separately from configurations",
      "Deleted secrets cannot be recovered - export important ones first"
    ]
  },
  
  fileManagement: {
    title: "Docker Compose File Management",
    description: "This tool helps you create, edit, and manage Docker Compose files without connecting to Docker instances.",
    tips: [
      "Always validate configurations before saving to catch syntax errors",
      "Use the backup feature to export your configurations regularly",
      "Organize your configurations with descriptive names and descriptions"
    ],
    warnings: [
      "This tool only manages docker-compose files - it does not deploy or connect to Docker",
      "Validate your configurations in a test environment before production use",
      "Keep backups of important configurations in case of accidental deletion"
    ]
  }
} as const;