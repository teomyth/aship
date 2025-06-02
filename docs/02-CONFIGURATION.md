# Configuration Reference

This document provides a comprehensive reference for configuring Aship projects.

## aship.yml Reference

The `aship.yml` file is the main configuration file for your Aship project. It defines playbooks, variables, tags, and other project settings.

### Basic Structure

```yaml
# Project metadata
name: "Project Name"
description: "Project description"

# Playbook definitions
playbooks:
  playbook-name: "path/to/playbook.yml"

# Variable definitions
vars:
  variable-name:
    type: "variable-type"
    description: "Variable description"
    # ... other options

# Tag configuration
tags:
  # Tag definitions with descriptions
  tag1: "Tag 1 description"
  tag2: "Tag 2 description"

  # Default and groups
  default: ["tag1"]
  group-name: ["tag1", "tag2"]

# Ansible configuration (optional)
ansible:
  configPath: "ansible.cfg"
```

### Project Metadata

```yaml
name: "My Ansible Project"
description: "Deploys web application to multiple environments"
```

- **name** (string): Human-readable project name
- **description** (string): Project description

### Playbooks

Define one or more playbooks for your project:

```yaml
playbooks:
  # Single playbook
  deploy: "deploy.yml"

  # Multiple playbooks
  setup: "playbooks/setup.yml"
  deploy: "playbooks/deploy.yml"
  rollback: "playbooks/rollback.yml"
```

**Key Points:**
- If only one playbook is defined, running `aship` without arguments will execute it
- Playbook paths are relative to the `aship.yml` file location
- Use descriptive names for easy identification

### Variables

Variables are collected interactively before playbook execution. Aship supports multiple variable types with validation and default values.

#### Basic Variable Structure

```yaml
vars:
  variable_name:
    type: "string"              # Variable type (required)
    description: "Description"  # User-friendly description
    default: "default-value"    # Default value
    required: true              # Whether variable is required
    group: "Group Name"         # Logical grouping for display
```

## Variable Types

### String Variables

```yaml
vars:
  app_name:
    type: string
    description: "Application name"
    default: "myapp"
    required: true
    pattern: "^[a-z][a-z0-9-]*$"  # Optional regex validation
```

**Options:**
- **pattern** (string): Regular expression for validation
- **default** (string): Default value
- **required** (boolean): Whether the variable is required

### Integer Variables

```yaml
vars:
  port:
    type: int
    description: "Application port"
    default: 8080
    required: true
    min: 1000
    max: 9999
```

**Options:**
- **default** (number): Default numeric value
- **required** (boolean): Whether the variable is required
- **min** (number): Minimum allowed value
- **max** (number): Maximum allowed value

### Boolean Variables

```yaml
vars:
  enable_ssl:
    type: bool
    description: "Enable SSL/TLS"
    default: true
    required: false
```

**Options:**
- **default** (boolean): Default boolean value
- **required** (boolean): Whether the variable is required

### Choice Variables

Single selection from predefined options:

```yaml
vars:
  environment:
    type: choice
    description: "Target environment"
    choices: ["development", "staging", "production"]
    default: "development"
    required: true
```

**Options:**
- **choices** (array): List of available options
- **default** (string): Default choice (must be in choices)
- **required** (boolean): Whether the variable is required

### Multiselect Variables

Multiple selections from predefined options:

```yaml
vars:
  features:
    type: multiselect
    description: "Features to enable"
    choices: ["auth", "logging", "monitoring", "caching"]
    default: ["auth", "logging"]
    required: false
```

**Options:**
- **choices** (array): List of available options
- **default** (array): Default selections (must be subset of choices)
- **required** (boolean): Whether at least one selection is required

### Password Variables

Secure password input with masking:

```yaml
vars:
  db_password:
    type: password
    description: "Database password"
    required: true
```

**Options:**
- **required** (boolean): Whether the variable is required
- **Note**: Password variables don't support default values for security

### List Variables

Comma-separated list input:

```yaml
vars:
  allowed_ips:
    type: list
    description: "Allowed IP addresses"
    default: ["127.0.0.1", "::1"]
    required: false
```

**Options:**
- **default** (array): Default list values
- **required** (boolean): Whether the variable is required

## Advanced Variable Features

### Variable Groups

Organize variables into logical groups for better user experience:

```yaml
vars:
  # Application settings
  app_name:
    type: string
    description: "Application name"
    group: "Application"

  app_version:
    type: string
    description: "Application version"
    group: "Application"

  # Database settings
  db_host:
    type: string
    description: "Database host"
    group: "Database"

  db_port:
    type: int
    description: "Database port"
    group: "Database"
```

### Multi-line Descriptions

Provide detailed descriptions with formatting:

```yaml
vars:
  ssl_config:
    type: choice
    description: |
      SSL/TLS configuration mode

      • auto: Automatic certificate management
      • manual: Manual certificate configuration
      • disabled: No SSL/TLS encryption
    choices: ["auto", "manual", "disabled"]
    default: "auto"
```



## Tags Configuration

Tags help organize and selectively execute parts of your playbooks. Aship uses a flexible flat format that supports multiple ways to define tags:

### Tag Definition Formats

```yaml
tags:
  # Method 1: Individual tags with descriptions
  common: "Basic system setup and configuration"
  app: "Application deployment and configuration"
  database: "Database setup and migrations"

  # Method 2: Tag list without descriptions
  tags: ["backup", "restore", "cleanup"]

  # Method 3: Mixed approach
  monitoring: "Monitoring and alerting setup"
  tags: ["maintenance", "debug"]

  # Default tags to run if none specified
  default: ["common", "app"]

  # Predefined tag groups
  quick: ["app"]
  full: ["common", "app", "database", "monitoring"]
  maintenance: ["backup", "cleanup"]
```

### Configuration Rules

- **String values** define individual tags with descriptions: `tag_name: "description"`
- **Array values** can be:
  - `tags: [...]` - List of tag names without descriptions
  - `default: [...]` - Default selected tags
  - `group_name: [...]` - Tag group definitions
- **Mixed usage** is supported - you can combine descriptions and tag lists

### Examples

#### Simple Tags with Descriptions
```yaml
tags:
  setup: "Initial system setup"
  deploy: "Application deployment"
  cleanup: "Post-deployment cleanup"
  default: ["setup", "deploy"]
```

#### Tag List Format
```yaml
tags:
  tags: ["web", "database", "cache", "monitoring"]
  default: ["web"]
  production: ["web", "database", "cache", "monitoring"]
  development: ["web"]
```

#### Mixed Format
```yaml
tags:
  # Described tags
  common: "Basic system setup"
  security: "Security hardening"

  # Tag list for simple tags
  tags: ["backup", "restore", "maintenance"]

  # Defaults and groups
  default: ["common"]
  full: ["common", "security", "backup"]
  quick: ["common"]
```



## Ansible Configuration

Optional Ansible settings for the project:

```yaml
ansible:
  configPath: "ansible.cfg"           # Path to custom ansible.cfg file
```

**Configuration Options:**
- **configPath** (string): Path to custom Ansible configuration file

## Best Practices

### 1. Use Descriptive Names

```yaml
# Good
vars:
  database_connection_timeout:
    type: int
    description: "Database connection timeout in seconds"

# Avoid
vars:
  timeout:
    type: int
    description: "Timeout"
```

### 2. Provide Clear Descriptions

```yaml
vars:
  deployment_strategy:
    type: choice
    description: |
      Deployment strategy for rolling updates

      • blue-green: Zero-downtime deployment with environment switching
      • rolling: Gradual replacement of instances
      • recreate: Stop all instances then start new ones
    choices: ["blue-green", "rolling", "recreate"]
```

### 3. Use Appropriate Defaults

```yaml
vars:
  log_level:
    type: choice
    description: "Application log level"
    choices: ["debug", "info", "warn", "error"]
    default: "info"  # Safe default for production
```

### 4. Group Related Variables

```yaml
vars:
  # Database configuration
  db_host:
    type: string
    group: "Database"

  db_port:
    type: int
    group: "Database"

  # Application configuration
  app_port:
    type: int
    group: "Application"
```

### 5. Use Validation

```yaml
vars:
  email:
    type: string
    description: "Administrator email"
    pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
    required: true
```

## Configuration Examples

### Simple Web Application

```yaml
name: "Web Application Deployment"
description: "Deploy a simple web application"

playbooks:
  deploy: "deploy.yml"

vars:
  environment:
    type: choice
    description: "Target environment"
    choices: ["dev", "staging", "prod"]
    default: "dev"

  app_version:
    type: string
    description: "Application version"
    default: "latest"

tags:
  # Tag definitions with descriptions (new flat format)
  common: "Basic system setup"
  app: "Application deployment"
  nginx: "Nginx configuration"

  # Default and groups
  default: ["common", "app"]
  quick: ["app"]
  full: ["common", "app", "nginx"]
```

### Complex Multi-Service Application

```yaml
name: "Microservices Platform"
description: "Deploy microservices platform with database and monitoring"

playbooks:
  deploy: "playbooks/deploy.yml"
  rollback: "playbooks/rollback.yml"
  maintenance: "playbooks/maintenance.yml"

vars:
  environment:
    type: choice
    description: "Target environment"
    choices: ["development", "staging", "production"]
    required: true
    group: "Environment"

  services:
    type: multiselect
    description: "Services to deploy"
    choices: ["api", "web", "worker", "scheduler"]
    default: ["api", "web"]
    group: "Services"

  enable_monitoring:
    type: bool
    description: "Enable monitoring stack"
    default: true
    group: "Features"

  database_password:
    type: password
    description: "Database password"
    required: true
    group: "Database"

tags:
  # Tag definitions with descriptions (new flat format)
  common: "Basic system setup"
  database: "Database setup and migrations"
  api: "API service deployment"
  web: "Web frontend deployment"
  monitoring: "Monitoring and alerting"

  # Default and groups
  default: ["common", "api", "web"]
  minimal: ["common", "api"]
  standard: ["common", "database", "api", "web"]
  full: ["common", "database", "api", "web", "monitoring"]
```

## Runtime Files

Aship creates a `.aship/` directory in your project for runtime data:

```
.aship/
├── vars.yml              # Cached variable values (auto-generated)
└── servers.yml           # Project-specific server configurations
```

**Note:** For server configuration details, see [Server Configuration](./03-SERVER-CONFIGURATION.md).

This configuration system provides flexibility while maintaining simplicity, allowing you to create sophisticated deployment workflows with minimal setup.
