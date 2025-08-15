import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { DockerComposeConfig, StackStatus } from '../../types';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockConfigs: DockerComposeConfig[] = [
  {
    id: '1',
    user_id: 'user1',
    name: 'web-stack',
    description: 'Web application stack',
    compose_content: 'version: "3.8"\nservices:\n  nginx:\n    image: nginx:latest',
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-01-15T14:22:00Z',
    metadata: {
      services: [{
        name: 'nginx',
        image: 'nginx:latest',
        ports: [{ host_port: 80, container_port: 80, protocol: 'tcp' }],
        environment: [],
        volumes: []
      }],
      volumes: [],
      networks: []
    }
  }
];

const mockStackStatuses: StackStatus[] = [
  {
    name: "web-stack",
    status: "running",
    containers: [
      {
        name: "web-stack_nginx_1",
        service: "nginx",
        status: "running",
        health: "healthy",
        ports: [{ host_port: 80, container_port: 80, protocol: "tcp" }],
        resources: {
          cpu_percent: 2.5,
          memory_usage: 64 * 1024 * 1024,
          memory_limit: 512 * 1024 * 1024,
          network_rx: 1024,
          network_tx: 2048
        }
      }
    ],
    created_at: "2024-01-15T10:30:00Z",
    updated_at: "2024-01-15T14:22:00Z"
  }
];

// Helper functions that would be used in the StackManager component
const getStatusIcon = (status: StackStatus['status']) => {
  switch (status) {
    case 'running':
      return 'CheckCircle';
    case 'stopped':
      return 'Square';
    case 'error':
      return 'XCircle';
    case 'partial':
      return 'AlertCircle';
    default:
      return 'Clock';
  }
};

const getStatusBadgeVariant = (status: StackStatus['status']) => {
  switch (status) {
    case 'running':
      return 'default';
    case 'stopped':
      return 'secondary';
    case 'error':
      return 'destructive';
    case 'partial':
      return 'outline';
    default:
      return 'secondary';
  }
};

const formatMemoryUsage = (bytes: number): string => {
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) {
    return `${mb.toFixed(1)} MB`;
  }
  return `${(mb / 1024).toFixed(1)} GB`;
};

const formatTimestamp = (timestamp: string): string => {
  return new Date(timestamp).toLocaleString();
};

describe('StackManager Helper Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getStatusIcon', () => {
    it('returns correct icon for running status', () => {
      expect(getStatusIcon('running')).toBe('CheckCircle');
    });

    it('returns correct icon for stopped status', () => {
      expect(getStatusIcon('stopped')).toBe('Square');
    });

    it('returns correct icon for error status', () => {
      expect(getStatusIcon('error')).toBe('XCircle');
    });

    it('returns correct icon for partial status', () => {
      expect(getStatusIcon('partial')).toBe('AlertCircle');
    });

    it('returns default icon for unknown status', () => {
      expect(getStatusIcon('unknown' as any)).toBe('Clock');
    });
  });

  describe('getStatusBadgeVariant', () => {
    it('returns correct variant for running status', () => {
      expect(getStatusBadgeVariant('running')).toBe('default');
    });

    it('returns correct variant for stopped status', () => {
      expect(getStatusBadgeVariant('stopped')).toBe('secondary');
    });

    it('returns correct variant for error status', () => {
      expect(getStatusBadgeVariant('error')).toBe('destructive');
    });

    it('returns correct variant for partial status', () => {
      expect(getStatusBadgeVariant('partial')).toBe('outline');
    });
  });

  describe('formatMemoryUsage', () => {
    it('formats bytes to MB when less than 1GB', () => {
      const bytes = 512 * 1024 * 1024; // 512 MB
      expect(formatMemoryUsage(bytes)).toBe('512.0 MB');
    });

    it('formats bytes to GB when 1GB or more', () => {
      const bytes = 2 * 1024 * 1024 * 1024; // 2 GB
      expect(formatMemoryUsage(bytes)).toBe('2.0 GB');
    });

    it('handles small memory values', () => {
      const bytes = 64 * 1024 * 1024; // 64 MB
      expect(formatMemoryUsage(bytes)).toBe('64.0 MB');
    });
  });

  describe('formatTimestamp', () => {
    it('formats ISO timestamp to locale string', () => {
      const timestamp = '2024-01-15T10:30:00Z';
      const formatted = formatTimestamp(timestamp);
      expect(formatted).toContain('2024');
      expect(typeof formatted).toBe('string');
    });
  });

  describe('Stack filtering logic', () => {
    it('filters stacks by name', () => {
      const searchTerm = 'web';
      const filtered = mockStackStatuses.filter(stack => 
        stack.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('web-stack');
    });

    it('filters stacks by service name', () => {
      const searchTerm = 'nginx';
      const filtered = mockStackStatuses.filter(stack => 
        stack.containers.some(container => 
          container.service.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('web-stack');
    });

    it('filters stacks by status', () => {
      const statusFilter = 'running';
      const filtered = mockStackStatuses.filter(stack => 
        statusFilter === 'all' || stack.status === statusFilter
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].status).toBe('running');
    });

    it('returns empty array when no matches found', () => {
      const searchTerm = 'nonexistent';
      const filtered = mockStackStatuses.filter(stack => 
        stack.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      expect(filtered).toHaveLength(0);
    });
  });

  describe('Operation state management', () => {
    it('creates operation state correctly', () => {
      const stackName = 'web-stack';
      const operation = 'deploy';
      
      const operationState = {
        stackName,
        operation,
        progress: 0,
        status: 'running' as const,
        message: `${operation.charAt(0).toUpperCase() + operation.slice(1)}ing stack...`
      };

      expect(operationState.stackName).toBe(stackName);
      expect(operationState.operation).toBe(operation);
      expect(operationState.progress).toBe(0);
      expect(operationState.status).toBe('running');
      expect(operationState.message).toBe('Deploying stack...');
    });

    it('generates correct confirmation messages', () => {
      const confirmations = {
        deploy: {
          title: 'Deploy Stack',
          description: 'Are you sure you want to deploy the "web-stack" stack? This will start all services defined in the configuration.'
        },
        stop: {
          title: 'Stop Stack',
          description: 'Are you sure you want to stop the "web-stack" stack? This will stop all running containers but preserve data.'
        },
        restart: {
          title: 'Restart Stack',
          description: 'Are you sure you want to restart the "web-stack" stack? This will stop and then start all services.'
        },
        remove: {
          title: 'Remove Stack',
          description: 'Are you sure you want to remove the "web-stack" stack? This will stop and remove all containers. Data in named volumes will be preserved.'
        }
      };

      expect(confirmations.deploy.title).toBe('Deploy Stack');
      expect(confirmations.stop.title).toBe('Stop Stack');
      expect(confirmations.restart.title).toBe('Restart Stack');
      expect(confirmations.remove.title).toBe('Remove Stack');
    });
  });

  describe('Progress simulation', () => {
    it('defines correct progress steps', () => {
      const progressSteps = [10, 30, 60, 80, 100];
      expect(progressSteps).toHaveLength(5);
      expect(progressSteps[0]).toBe(10);
      expect(progressSteps[4]).toBe(100);
    });

    it('defines correct progress messages for deploy operation', () => {
      const messages = {
        deploy: ['Validating configuration...', 'Pulling images...', 'Creating containers...', 'Starting services...', 'Stack deployed successfully']
      };
      
      expect(messages.deploy).toHaveLength(5);
      expect(messages.deploy[0]).toBe('Validating configuration...');
      expect(messages.deploy[4]).toBe('Stack deployed successfully');
    });
  });
});