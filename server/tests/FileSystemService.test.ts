import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FileSystemService } from '../services/FileSystemService.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';

// Import fs constants for access modes
import { constants as fsConstants } from 'fs';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  stat: vi.fn(),
  access: vi.fn(),
  mkdir: vi.fn(),
  chown: vi.fn(),
  chmod: vi.fn(),
  mkdtemp: vi.fn(),
  rm: vi.fn()
}));

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn()
}));

// Mock process methods
const mockProcess = {
  getuid: vi.fn(() => 1000),
  getgid: vi.fn(() => 1000),
  platform: 'linux'
};

Object.defineProperty(process, 'getuid', {
  value: mockProcess.getuid,
  writable: true
});

Object.defineProperty(process, 'getgid', {
  value: mockProcess.getgid,
  writable: true
});

describe('FileSystemService', () => {
  let fileSystemService: FileSystemService;
  let mockFs: any;
  let mockExec: any;

  beforeEach(() => {
    fileSystemService = new FileSystemService(['/home', '/opt', '/tmp'], false); // Explicitly set to Linux
    mockFs = {
      stat: vi.mocked(fs.stat),
      access: vi.mocked(fs.access),
      mkdir: vi.mocked(fs.mkdir),
      chown: vi.mocked(fs.chown),
      chmod: vi.mocked(fs.chmod),
      mkdtemp: vi.mocked(fs.mkdtemp),
      rm: vi.mocked(fs.rm)
    };
    mockExec = vi.mocked(exec);
    
    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validatePath', () => {
    it('should validate a correct path within allowed directories', async () => {
      const testPath = '/home/user/docker';
      
      // Mock path exists and is writable
      mockFs.stat.mockResolvedValue({
        mode: 0o755,
        uid: 1000,
        gid: 1000
      });
      
      // Mock access check - always succeed
      mockFs.access.mockResolvedValue(undefined);

      const result = await fileSystemService.validatePath(testPath);

      expect(result.valid).toBe(true);
      expect(result.exists).toBe(true);
      expect(result.writable).toBe(true);
      expect(result.message).toContain('exists and is writable');
    });

    it('should reject paths with directory traversal', async () => {
      const maliciousPaths = [
        '/home/user/../../../etc/passwd',
        '/home/user/../../root',
        '../../../etc/shadow',
        '/home/user/~/../../etc'
      ];

      for (const maliciousPath of maliciousPaths) {
        const result = await fileSystemService.validatePath(maliciousPath);
        
        expect(result.valid).toBe(false);
        expect(result.message).toContain('directory traversal');
      }
    });

    it('should reject paths outside allowed directories', async () => {
      const disallowedPath = '/etc/passwd';

      const result = await fileSystemService.validatePath(disallowedPath);

      expect(result.valid).toBe(false);
      expect(result.message).toContain('must be within allowed directories');
    });

    it('should handle non-existent paths that can be created', async () => {
      const testPath = '/home/user/new-directory';
      
      // Mock path doesn't exist
      mockFs.stat.mockRejectedValue({ code: 'ENOENT' });
      
      // Mock parent directory is writable
      mockFs.access.mockResolvedValue(undefined);

      const result = await fileSystemService.validatePath(testPath);

      expect(result.valid).toBe(true);
      expect(result.exists).toBe(false);
      expect(result.writable).toBe(true);
      expect(result.message).toContain('does not exist but can be created');
    });

    it('should suggest permissions for existing non-writable paths', async () => {
      const testPath = '/home/user/readonly';
      
      // Mock path exists but is not writable
      mockFs.stat.mockResolvedValue({
        mode: 0o644,
        uid: 1000,
        gid: 1000
      });
      
      mockFs.access.mockImplementation((path: string, mode: number) => {
        if (mode === fs.constants.W_OK) {
          return Promise.reject(new Error('Not writable'));
        }
        return Promise.resolve();
      });

      const result = await fileSystemService.validatePath(testPath);

      expect(result.valid).toBe(true);
      expect(result.exists).toBe(true);
      expect(result.writable).toBe(false);
      expect(result.suggested_permissions).toEqual({
        uid: 1000,
        gid: 1000,
        mode: '755'
      });
    });

    it('should handle Windows paths differently', async () => {
      const windowsService = new FileSystemService([], true); // Explicitly set to Windows
      
      const windowsPath = 'C:\\Users\\test\\docker';
      
      mockFs.stat.mockResolvedValue({
        mode: 0o755,
        uid: 0,
        gid: 0
      });
      mockFs.access.mockResolvedValue(undefined);

      const result = await windowsService.validatePath(windowsPath);

      expect(result.valid).toBe(true);
      // Windows should allow any path
    });
  });

  describe('createDirectory', () => {
    it('should create directory successfully', async () => {
      const request = {
        path: '/home/user/new-dir',
        permissions: {
          uid: 1000,
          gid: 1000,
          mode: '755'
        }
      };

      // Mock validation success
      mockFs.stat.mockRejectedValue({ code: 'ENOENT' });
      mockFs.access.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.chown.mockResolvedValue(undefined);
      mockFs.chmod.mockResolvedValue(undefined);

      const result = await fileSystemService.createDirectory(request);

      expect(result.success).toBe(true);
      expect(result.message).toContain('created successfully');
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        path.resolve(request.path),
        { recursive: true }
      );
      expect(mockFs.chown).toHaveBeenCalledWith(
        path.resolve(request.path),
        1000,
        1000
      );
      expect(mockFs.chmod).toHaveBeenCalledWith(
        path.resolve(request.path),
        0o755
      );
    });

    it('should handle existing directory', async () => {
      const request = { path: '/home/user/existing-dir' };

      // Mock directory already exists
      mockFs.stat.mockResolvedValue({
        mode: 0o755,
        uid: 1000,
        gid: 1000
      });
      mockFs.access.mockResolvedValue(undefined);

      const result = await fileSystemService.createDirectory(request);

      expect(result.success).toBe(true);
      expect(result.message).toContain('already exists');
      expect(mockFs.mkdir).not.toHaveBeenCalled();
    });

    it('should handle permission errors', async () => {
      const request = {
        path: '/home/user/new-dir',
        permissions: {
          uid: 0,
          gid: 0,
          mode: '755'
        }
      };

      mockFs.stat.mockRejectedValue({ code: 'ENOENT' });
      mockFs.access.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.chown.mockRejectedValue({ code: 'EPERM' });

      const result = await fileSystemService.createDirectory(request);

      expect(result.success).toBe(false);
      expect(result.message).toContain('failed to set permissions');
    });

    it('should skip permissions on Windows', async () => {
      const windowsService = new FileSystemService([], true); // Explicitly set to Windows
      
      const request = {
        path: 'C:\\Users\\test\\new-dir',
        permissions: {
          uid: 1000,
          gid: 1000,
          mode: '755'
        }
      };

      // Mock validation and creation success
      mockFs.stat.mockRejectedValue({ code: 'ENOENT' });
      mockFs.access.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);

      const result = await windowsService.createDirectory(request);

      expect(result.success).toBe(true);
      expect(mockFs.chown).not.toHaveBeenCalled();
      expect(mockFs.chmod).not.toHaveBeenCalled();
    });
  });

  describe('setPermissions', () => {
    it('should set permissions successfully', async () => {
      const request = {
        path: '/home/user/test-dir',
        uid: 1000,
        gid: 1000,
        mode: '755'
      };

      // Mock path exists and is valid
      mockFs.stat.mockResolvedValue({
        mode: 0o644,
        uid: 1000,
        gid: 1000
      });
      mockFs.access.mockResolvedValue(undefined);
      mockFs.chown.mockResolvedValue(undefined);
      mockFs.chmod.mockResolvedValue(undefined);

      const result = await fileSystemService.setPermissions(request);

      expect(result.success).toBe(true);
      expect(result.message).toContain('set successfully');
      expect(mockFs.chown).toHaveBeenCalledWith(
        path.resolve(request.path),
        1000,
        1000
      );
      expect(mockFs.chmod).toHaveBeenCalledWith(
        path.resolve(request.path),
        0o755
      );
    });

    it('should reject invalid permission modes', async () => {
      const request = {
        path: '/home/user/test-dir',
        uid: 1000,
        gid: 1000,
        mode: '999' // Invalid mode
      };

      mockFs.stat.mockResolvedValue({
        mode: 0o644,
        uid: 1000,
        gid: 1000
      });
      mockFs.access.mockResolvedValue(undefined);

      const result = await fileSystemService.setPermissions(request);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid permission mode');
    });

    it('should reject negative UIDs/GIDs', async () => {
      const request = {
        path: '/home/user/test-dir',
        uid: -1,
        gid: 1000,
        mode: '755'
      };

      mockFs.stat.mockResolvedValue({
        mode: 0o644,
        uid: 1000,
        gid: 1000
      });
      mockFs.access.mockResolvedValue(undefined);

      const result = await fileSystemService.setPermissions(request);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid user or group ID');
    });

    it('should handle permission denied errors', async () => {
      const request = {
        path: '/home/user/test-dir',
        uid: 0,
        gid: 0,
        mode: '755'
      };

      mockFs.stat.mockResolvedValue({
        mode: 0o644,
        uid: 1000,
        gid: 1000
      });
      mockFs.access.mockResolvedValue(undefined);
      mockFs.chown.mockRejectedValue({ code: 'EPERM' });

      const result = await fileSystemService.setPermissions(request);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Permission denied');
      expect(result.error).toContain('elevated privileges');
    });

    it('should skip permissions on Windows', async () => {
      const windowsService = new FileSystemService([], true); // Explicitly set to Windows
      
      const request = {
        path: 'C:\\Users\\test\\dir',
        uid: 1000,
        gid: 1000,
        mode: '755'
      };

      const result = await windowsService.setPermissions(request);

      expect(result.success).toBe(true);
      expect(result.message).toContain('not supported on Windows');
      expect(mockFs.chown).not.toHaveBeenCalled();
      expect(mockFs.chmod).not.toHaveBeenCalled();
    });
  });

  describe('checkPermissions', () => {
    it('should return permission information', async () => {
      const testPath = '/home/user/test-file';

      mockFs.stat.mockResolvedValue({
        mode: 0o100755, // Regular file with 755 permissions
        uid: 1000,
        gid: 1000
      });

      // Mock all access checks succeed
      mockFs.access.mockResolvedValue(undefined);

      const result = await fileSystemService.checkPermissions(testPath);

      expect(result.uid).toBe(1000);
      expect(result.gid).toBe(1000);
      expect(result.mode).toBe('755');
      expect(result.readable).toBe(true);
      expect(result.writable).toBe(true);
      expect(result.executable).toBe(true);
    });

    it('should handle non-existent files', async () => {
      const testPath = '/home/user/non-existent';

      mockFs.stat.mockRejectedValue({ code: 'ENOENT' });

      const result = await fileSystemService.checkPermissions(testPath);

      expect(result.uid).toBe(0);
      expect(result.gid).toBe(0);
      expect(result.mode).toBe('000');
      expect(result.readable).toBe(false);
      expect(result.writable).toBe(false);
      expect(result.executable).toBe(false);
    });

    it('should handle partial access permissions', async () => {
      const testPath = '/home/user/readonly-file';

      mockFs.stat.mockResolvedValue({
        mode: 0o100644, // Regular file with 644 permissions
        uid: 1000,
        gid: 1000
      });

      // Mock only read access succeeds
      mockFs.access.mockImplementation((checkPath: string, mode?: number) => {
        if (mode === fsConstants.R_OK) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Access denied'));
      });

      const result = await fileSystemService.checkPermissions(testPath);

      expect(result.mode).toBe('644');
      expect(result.readable).toBe(true);
      expect(result.writable).toBe(false);
      expect(result.executable).toBe(false);
    });
  });

  describe('security', () => {
    it('should detect various path traversal patterns', async () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '/home/user/../../../etc/shadow',
        '~/../../root/.ssh',
        '/home/user/%2e%2e/%2e%2e/etc/passwd',
        '/home/user/%252e%252e/etc/passwd'
      ];

      for (const maliciousPath of maliciousPaths) {
        const result = await fileSystemService.validatePath(maliciousPath);
        expect(result.valid).toBe(false);
        expect(result.message).toContain('directory traversal');
      }
    });

    it('should validate permission modes correctly', () => {
      const service = new FileSystemService();
      
      // Valid modes
      expect((service as any).isValidMode('755')).toBe(true);
      expect((service as any).isValidMode('644')).toBe(true);
      expect((service as any).isValidMode('000')).toBe(true);
      expect((service as any).isValidMode('777')).toBe(true);
      
      // Invalid modes
      expect((service as any).isValidMode('888')).toBe(false);
      expect((service as any).isValidMode('75')).toBe(false);
      expect((service as any).isValidMode('7755')).toBe(false);
      expect((service as any).isValidMode('abc')).toBe(false);
      expect((service as any).isValidMode('')).toBe(false);
    });

    it('should safely join paths', () => {
      const service = new FileSystemService();
      
      // Safe path joining
      expect(service.safePath('/home', 'user', 'docker')).toBe(path.resolve('/home/user/docker'));
      
      // Should throw on path traversal
      expect(() => {
        service.safePath('/home', '../../../etc', 'passwd');
      }).toThrow('Path traversal detected');
    });
  });

  describe('temporary directory operations', () => {
    it('should create temporary directory', async () => {
      const expectedTempDir = '/tmp/homelab-abc123';
      mockFs.mkdtemp.mockResolvedValue(expectedTempDir);

      const result = await fileSystemService.createTempDirectory('homelab-');

      expect(result).toBe(expectedTempDir);
      expect(mockFs.mkdtemp).toHaveBeenCalledWith(
        expect.stringContaining('homelab-')
      );
    });

    it('should cleanup temporary directory', async () => {
      const tempDir = '/tmp/homelab-test123';
      mockFs.rm.mockResolvedValue(undefined);

      await fileSystemService.cleanupTempDirectory(tempDir);

      expect(mockFs.rm).toHaveBeenCalledWith(tempDir, {
        recursive: true,
        force: true
      });
    });

    it('should handle cleanup failures gracefully', async () => {
      const tempDir = '/tmp/homelab-test123';
      mockFs.rm.mockRejectedValue(new Error('Permission denied'));

      // Should not throw
      await expect(fileSystemService.cleanupTempDirectory(tempDir)).resolves.toBeUndefined();
    });
  });
});