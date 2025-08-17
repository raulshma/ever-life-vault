export interface DockerComposeConfig {
    id: string;
    user_id: string;
    name: string;
    description?: string;
    compose_content: string;
    created_at: string;
    updated_at: string;
    metadata: {
        services: ServiceDefinition[];
        volumes: VolumeDefinition[];
        networks: NetworkDefinition[];
    };
}
export interface ServiceDefinition {
    name: string;
    image: string;
    ports: PortMapping[];
    environment: EnvironmentVariable[];
    volumes: VolumeMount[];
    depends_on?: string[];
    restart_policy?: 'no' | 'always' | 'on-failure' | 'unless-stopped';
    user_id?: number;
    group_id?: number;
    memory_limit?: string;
    cpu_limit?: string;
    health_check?: string;
    working_dir?: string;
    command?: string;
}
export interface PortMapping {
    host_port: number;
    container_port: number;
    protocol: 'tcp' | 'udp';
}
export interface EnvironmentVariable {
    key: string;
    value: string;
    is_secret: boolean;
}
export interface VolumeMount {
    host_path: string;
    container_path: string;
    mode: 'ro' | 'rw';
    uid?: number;
    gid?: number;
    permissions?: string;
}
export interface VolumeDefinition {
    name: string;
    driver?: string;
    driver_opts?: Record<string, string>;
}
export interface NetworkDefinition {
    name: string;
    driver?: string;
    driver_opts?: Record<string, string>;
}
export interface Secret {
    id: string;
    user_id: string;
    key: string;
    encrypted_value: string;
    created_at: string;
    updated_at: string;
}
export interface SecretTemplate {
    id: string;
    user_id: string;
    name: string;
    description?: string;
    template: Record<string, string>;
    created_at: string;
    updated_at: string;
}
export interface SecretFormData {
    key: string;
    value: string;
    description?: string;
}
export interface SecretImportData {
    secrets: SecretFormData[];
    overwrite_existing: boolean;
}
export interface SecretExportData {
    secrets: Array<{
        key: string;
        description?: string;
    }>;
    exported_at: string;
    total_count: number;
}
export interface SecretInjectionPreview {
    original_compose: string;
    injected_compose: string;
    placeholders_found: string[];
    missing_secrets: string[];
}
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}
export interface ValidationError {
    field: string;
    message: string;
    line?: number;
    column?: number;
}
export interface ValidationWarning {
    field: string;
    message: string;
    line?: number;
    column?: number;
}
export interface PathValidationResult {
    valid: boolean;
    exists: boolean;
    writable: boolean;
    message: string;
    suggested_permissions?: {
        uid: number;
        gid: number;
        mode: string;
    };
}
export interface PermissionInfo {
    uid: number;
    gid: number;
    mode: string;
    readable: boolean;
    writable: boolean;
    executable: boolean;
}
export interface CreateDirectoryRequest {
    path: string;
    permissions?: {
        uid?: number;
        gid?: number;
        mode?: string;
    };
}
export interface SetPermissionsRequest {
    path: string;
    uid: number;
    gid: number;
    mode: string;
}
export interface OperationResult {
    success: boolean;
    message: string;
    error?: string;
}
export interface BackupData {
    version: string;
    created_at: string;
    configurations: DockerComposeConfig[];
    secrets: Omit<Secret, 'encrypted_value'>[];
    metadata: {
        total_configs: number;
        total_secrets: number;
        export_type: 'full' | 'selective';
    };
}
export interface RestoreOptions {
    overwrite_existing: boolean;
    selective_restore: {
        config_ids?: string[];
        secret_keys?: string[];
    };
}
export interface RestoreResult {
    success: boolean;
    imported_configs: number;
    imported_secrets: number;
    skipped_configs: string[];
    skipped_secrets: string[];
    errors: string[];
}
//# sourceMappingURL=types.d.ts.map