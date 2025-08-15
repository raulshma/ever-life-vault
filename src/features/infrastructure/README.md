# Infrastructure Management

This feature provides comprehensive Docker infrastructure management capabilities, including Docker Compose configuration editing, secrets management, and now **Docker configuration import functionality**.

## Features

### Core Infrastructure Management
- **Configuration Editor**: Visual editor for Docker Compose configurations
- **Service Management**: Define and configure Docker services with advanced options
- **Volume & Network Configuration**: Set up persistent storage and networking
- **Validation**: Client and server-side validation of configurations
- **YAML Preview**: Real-time preview of generated Docker Compose YAML

### 🆕 Docker Configuration Import
The infrastructure feature now includes powerful import capabilities for Docker configurations:

#### 1. Docker Compose Import
- **Direct YAML Input**: Paste Docker Compose YAML content directly
- **File Upload**: Drag and drop or browse for docker-compose.yml files
- **Validation**: Automatic validation of imported YAML structure
- **Smart Parsing**: Intelligent parsing with helpful warnings and suggestions

#### 2. Docker Command Conversion
Convert Docker `run` commands to Docker Compose format automatically:

**Supported Docker Options:**
- `-p, --publish` - Port mappings (e.g., `8080:80`, `8080:80/tcp`)
- `-v, --volume` - Volume mounts (e.g., `/host:/container:ro`)
- `-e, --env` - Environment variables (e.g., `KEY=value`, `KEY`)
- `--name` - Container name
- `-w, --workdir` - Working directory
- `--restart` - Restart policy
- `--memory` - Memory limits
- `--cpus` - CPU limits

**Example Conversion:**
```bash
# Input: Docker run command
docker run -d --name nginx-web -p 8080:80 -v /host/path:/var/www/html:ro -e NGINX_HOST=example.com --restart unless-stopped nginx:alpine

# Output: Docker Compose service
services:
  nginx-web:
    image: nginx:alpine
    ports:
      - "8080:80"
    volumes:
      - /host/path:/var/www/html:ro
    environment:
      - NGINX_HOST=example.com
    restart: unless-stopped
```

### Secrets Management
- **Secure Storage**: Encrypted storage of sensitive configuration data
- **Template System**: Reusable secret templates for common patterns
- **Injection Preview**: Preview how secrets will be injected into configurations
- **Import/Export**: Backup and restore secret configurations

### Backup & Restore
- **Full Configuration Backup**: Export all configurations and secrets
- **Selective Restore**: Choose which configurations to restore
- **Version Control**: Track changes and maintain configuration history

## Usage

### Importing Docker Configurations

1. **Open Configuration Editor**: Navigate to the infrastructure section
2. **Click Import Button**: Use the "Import Configuration" button in the header
3. **Choose Import Method**:
   - **Docker Compose**: Paste YAML or upload file
   - **Docker Command**: Paste a `docker run` command
   - **File Upload**: Select a docker-compose.yml file
4. **Review & Import**: Validate the imported configuration and import

### Creating New Configurations

1. **Basic Information**: Set stack name and description
2. **Services**: Define container services with images, ports, volumes, etc.
3. **Volumes**: Configure persistent storage
4. **Networks**: Set up container networking
5. **Validation**: Use built-in validation to check configuration
6. **Preview**: Switch to YAML preview mode to see generated output

## Architecture

### Components
- `ConfigurationEditor`: Main configuration editing interface
- `DockerImportDialog`: Import dialog with multiple import methods
- `ServiceDefinitionForm`: Service configuration forms
- `VolumeConfigurationForm`: Volume configuration forms
- `NetworkConfigurationForm`: Network configuration forms
- `YamlPreview`: YAML output preview
- `ValidationDisplay`: Validation results and error display

### Utilities
- `dockerUtils.ts`: Core Docker parsing and conversion logic
- `parseDockerCommand()`: Converts Docker run commands to Compose
- `importDockerCompose()`: Imports Docker Compose YAML
- `generateDockerComposeYaml()`: Generates YAML from configuration

### Types
- `DockerComposeConfig`: Main configuration interface
- `ServiceDefinition`: Service configuration structure
- `VolumeDefinition`: Volume configuration structure
- `NetworkDefinition`: Network configuration structure
- `DockerCommandParseResult`: Command parsing result
- `DockerComposeImportResult`: Compose import result

## Best Practices

### Docker Command Conversion
- Use specific image tags instead of `latest`
- Include resource limits for production deployments
- Add health checks for critical services
- Review converted configurations before deployment

### Configuration Management
- Use descriptive names for stacks and services
- Document environment-specific configurations
- Implement proper secret management for sensitive data
- Regular backup of configurations

### Validation
- Always validate configurations before deployment
- Address warnings and suggestions
- Test configurations in development environments first
- Use the preview mode to review generated YAML

## Examples

### Simple Web Application
```yaml
version: '3.8'
name: web-app
services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"
    volumes:
      - ./html:/var/www/html:ro
    environment:
      - NGINX_HOST=example.com
    restart: unless-stopped
```

### Multi-Service Stack
```yaml
version: '3.8'
name: full-stack-app
services:
  frontend:
    image: node:16-alpine
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
    working_dir: /app
    command: npm start
    depends_on:
      - backend
  
  backend:
    image: python:3.9-alpine
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/app
    depends_on:
      - db
  
  db:
    image: postgres:13-alpine
    environment:
      - POSTGRES_DB=app
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## Testing

Run the test suite to ensure all functionality works correctly:

```bash
npm test -- src/features/infrastructure/utils/__tests__/dockerUtils.test.ts
```

## Future Enhancements

- **Advanced YAML Parsing**: Full YAML parsing with js-yaml library
- **Dockerfile Import**: Import and analyze Dockerfiles
- **Compose Version Detection**: Automatic version detection and migration
- **Template Library**: Pre-built configuration templates
- **CI/CD Integration**: Export configurations for deployment pipelines
