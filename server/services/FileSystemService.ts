import * as fs from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import {
  PathValidationResult,
  PermissionInfo,
  CreateDirectoryRequest,
  SetPermissionsRequest,
  OperationResult
} from '../../src/features/infrastructure/types.js';

const execAsync = promisify(exec);

export class FileSystemService {
  private readonly allowedBasePaths: string[];
  private readonly isWindows: boolean;

  constructor(allowedBasePaths: string[] = ['/home', '/opt', '/var/lib', '/tmp'], isWindows?: boolean) {
    this.allowedBasePaths = allowedBasePaths;
    this.isWindows = isWindows ?? process.platform === 'win32';
  }

  /**
   * Validates a file system path for security and accessibility
   */
  async validatePath(targetPath: string): Promise<PathValidationResult> {
    try {
      // Normalize and resolve the path to prevent traversal attacks
      const normalizedPath = path.resolve(targetPath);
      
      // Check for path traversal attempts
      if (this.containsPathTraversal(targetPath)) {
        return {
          valid: false,
          exists: false,
          writable: false,
          message: 'Path contains directory traversal sequences (../) which are not allowed'
        };
      }

      // Check if path is within allowed base paths (Unix-like systems)
      if (!this.isWindows && !this.isPathAllowed(normalizedPath)) {
        return {
          valid: false,
          exists: false,
          writable: false,
          message: `Path must be within allowed directories: ${this.allowedBasePaths.join(', ')}`
        };
      }

      // Check if path exists
      let exists = false;
      let stats: any = null;
      try {
        stats = await fs.stat(normalizedPath);
        exists = true;
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          return {
            valid: false,
            exists: false,
            writable: false,
            message: `Cannot access path: ${error.message}`
          };
        }
      }

      // Check writability
      let writable = false;
      if (exists) {
        try {
          await fs.access(normalizedPath, fs.constants.W_OK);
          writable = true;
        } catch {
          writable = false;
        }
      } else {
        // Check if parent directory is writable
        const parentDir = path.dirname(normalizedPath);
        try {
          await fs.access(parentDir, fs.constants.W_OK);
          writable = true;
        } catch {
          // If parent doesn't exist, check its parent recursively
          try {
            const grandParent = path.dirname(parentDir);
            if (grandParent !== parentDir) { // Avoid infinite recursion at root
              await fs.access(grandParent, fs.constants.W_OK);
              writable = true;
            }
          } catch {
            writable = false;
          }
        }
      }

      // Suggest permissions if needed
      let suggestedPermissions;
      if (exists && stats && !writable) {
        suggestedPermissions = {
          uid: this.isWindows ? 0 : process.getuid?.() || 1000,
          gid: this.isWindows ? 0 : process.getgid?.() || 1000,
          mode: '755'
        };
      }

      return {
        valid: true,
        exists,
        writable,
        message: exists 
          ? (writable ? 'Path exists and is writable' : 'Path exists but is not writable')
          : 'Path does not exist but can be created',
        suggested_permissions: suggestedPermissions
      };

    } catch (error: any) {
      return {
        valid: false,
        exists: false,
        writable: false,
        message: `Path validation failed: ${error.message}`
      };
    }
  }

  /**
   * Creates a directory with optional permissions
   */
  async createDirectory(request: CreateDirectoryRequest): Promise<OperationResult> {
    try {
      // Validate the path first
      const validation = await this.validatePath(request.path);
      if (!validation.valid) {
        return {
          success: false,
          message: 'Path validation failed',
          error: validation.message
        };
      }

      if (validation.exists) {
        return {
          success: true,
          message: 'Directory already exists'
        };
      }

      // Create the directory
      const normalizedPath = path.resolve(request.path);
      await fs.mkdir(normalizedPath, { recursive: true });

      // Set permissions if specified and not on Windows
      if (request.permissions && !this.isWindows) {
        const permResult = await this.setPermissions({
          path: normalizedPath,
          uid: request.permissions.uid || process.getuid?.() || 1000,
          gid: request.permissions.gid || process.getgid?.() || 1000,
          mode: request.permissions.mode || '755'
        });

        if (!permResult.success) {
          return {
            success: false,
            message: 'Directory created but failed to set permissions',
            error: permResult.error
          };
        }
      }

      return {
        success: true,
        message: `Directory created successfully at ${normalizedPath}`
      };

    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to create directory',
        error: error.message
      };
    }
  }

  /**
   * Sets permissions on a file or directory
   */
  async setPermissions(request: SetPermissionsRequest): Promise<OperationResult> {
    try {
      if (this.isWindows) {
        return {
          success: true,
          message: 'Permission setting is not supported on Windows'
        };
      }

      // Validate the path
      const validation = await this.validatePath(request.path);
      if (!validation.valid || !validation.exists) {
        return {
          success: false,
          message: 'Cannot set permissions on non-existent or invalid path',
          error: validation.message
        };
      }

      const normalizedPath = path.resolve(request.path);

      // Validate permission values
      if (!this.isValidMode(request.mode)) {
        return {
          success: false,
          message: 'Invalid permission mode',
          error: 'Mode must be a valid octal string (e.g., "755", "644")'
        };
      }

      if (request.uid < 0 || request.gid < 0) {
        return {
          success: false,
          message: 'Invalid user or group ID',
          error: 'UID and GID must be non-negative integers'
        };
      }

      // Set ownership
      try {
        await fs.chown(normalizedPath, request.uid, request.gid);
      } catch (error: any) {
        if (error.code === 'EPERM') {
          return {
            success: false,
            message: 'Permission denied: insufficient privileges to change ownership',
            error: 'You may need to run with elevated privileges (sudo)'
          };
        }
        throw error;
      }

      // Set file mode
      const mode = parseInt(request.mode, 8);
      await fs.chmod(normalizedPath, mode);

      return {
        success: true,
        message: `Permissions set successfully: ${request.mode} (${request.uid}:${request.gid})`
      };

    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to set permissions',
        error: error.message
      };
    }
  }

  /**
   * Gets current permissions for a path
   */
  async checkPermissions(targetPath: string): Promise<PermissionInfo> {
    try {
      const normalizedPath = path.resolve(targetPath);
      const stats = await fs.stat(normalizedPath);

      const mode = stats.mode.toString(8).slice(-3);
      const uid = stats.uid;
      const gid = stats.gid;

      // Check access permissions
      let readable = false;
      let writable = false;
      let executable = false;

      try {
        await fs.access(normalizedPath, fs.constants.R_OK);
        readable = true;
      } catch {}

      try {
        await fs.access(normalizedPath, fs.constants.W_OK);
        writable = true;
      } catch {}

      try {
        await fs.access(normalizedPath, fs.constants.X_OK);
        executable = true;
      } catch {}

      return {
        uid,
        gid,
        mode,
        readable,
        writable,
        executable
      };

    } catch (error: any) {
      // Return default values if path doesn't exist or can't be accessed
      return {
        uid: 0,
        gid: 0,
        mode: '000',
        readable: false,
        writable: false,
        executable: false
      };
    }
  }

  /**
   * Gets disk usage information for a path
   */
  async getDiskUsage(targetPath: string): Promise<{ total: number; used: number; available: number } | null> {
    try {
      const normalizedPath = path.resolve(targetPath);
      
      if (this.isWindows) {
        // Use PowerShell on Windows
        const { stdout } = await execAsync(
          `powershell "Get-WmiObject -Class Win32_LogicalDisk | Where-Object {$_.DeviceID -eq '${path.parse(normalizedPath).root.replace('\\', '')}'} | Select-Object Size,FreeSpace | ConvertTo-Json"`
        );
        
        const diskInfo = JSON.parse(stdout);
        return {
          total: parseInt(diskInfo.Size),
          used: parseInt(diskInfo.Size) - parseInt(diskInfo.FreeSpace),
          available: parseInt(diskInfo.FreeSpace)
        };
      } else {
        // Use df on Unix-like systems
        const { stdout } = await execAsync(`df -B1 "${normalizedPath}" | tail -1`);
        const parts = stdout.trim().split(/\s+/);
        
        return {
          total: parseInt(parts[1]),
          used: parseInt(parts[2]),
          available: parseInt(parts[3])
        };
      }
    } catch (error) {
      return null;
    }
  }

  // Private helper methods

  private containsPathTraversal(targetPath: string): boolean {
    // Check for various path traversal patterns
    const dangerousPatterns = [
      /\.\./,           // Standard path traversal
      /~\//,            // Home directory access
      /\/\.\./,         // Absolute path traversal
      /\.\.\\/,         // Windows path traversal
      /%2e%2e/i,        // URL encoded path traversal
      /%252e%252e/i,    // Double URL encoded path traversal
    ];

    return dangerousPatterns.some(pattern => pattern.test(targetPath));
  }

  private isPathAllowed(normalizedPath: string): boolean {
    if (this.isWindows) {
      // On Windows, allow any path (Windows has different security model)
      return true;
    }

    // Check if the path starts with any of the allowed base paths
    return this.allowedBasePaths.some(basePath => {
      const resolvedBasePath = path.resolve(basePath);
      return normalizedPath.startsWith(resolvedBasePath);
    });
  }

  private isValidMode(mode: string): boolean {
    // Check if mode is a valid octal string (3 digits, each 0-7)
    return /^[0-7]{3}$/.test(mode);
  }

  /**
   * Safely joins paths and validates the result
   */
  safePath(...segments: string[]): string {
    // Check each segment for path traversal before joining
    for (const segment of segments) {
      if (this.containsPathTraversal(segment)) {
        throw new Error('Path traversal detected in path segments');
      }
    }
    
    const joined = path.join(...segments);
    const resolved = path.resolve(joined);
    
    return resolved;
  }

  /**
   * Creates a temporary directory for operations
   */
  async createTempDirectory(prefix = 'homelab-'): Promise<string> {
    try {
      const tempDir = await fs.mkdtemp(path.join(this.isWindows ? process.env.TEMP || 'C:\\temp' : '/tmp', prefix));
      return tempDir;
    } catch (error: any) {
      throw new Error(`Failed to create temporary directory: ${error.message}`);
    }
  }

  /**
   * Cleans up a temporary directory
   */
  async cleanupTempDirectory(tempDir: string): Promise<void> {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error: any) {
      // Log error but don't throw - cleanup failures shouldn't break the main operation
      console.warn(`Failed to cleanup temporary directory ${tempDir}: ${error.message}`);
    }
  }
}