# Aship

[![npm version](https://badge.fury.io/js/aship.svg)](https://badge.fury.io/js/aship)

**Aship** is a zero-config Ansible tool for simplified deployments and flexible host management.

## ✨ Key Features

- **🚀 Simplified Workflow**: One command to run playbooks with interactive guidance
- **🔧 Rich Variable Types**: String, number, boolean, choice, multiselect, password, and list variables
- **🌐 Flexible Server Management**: Configure servers, use inventory files, or manual input
- **🏷️ Tag Management**: Organize and select Ansible tags with predefined groups
- **📁 Project Configuration**: Simple YAML-based project setup with `aship.yml`
- **🔄 Connection Management**: Automatic SSH handling with connection history
- **⚡ Interactive Experience**: Smart prompts with validation and defaults
- **🛡️ Security**: Password masking and SSH key management

## 📦 Installation

### Prerequisites

- **Node.js** 18.0.0 or higher
- **Ansible** installed and accessible in your PATH
- **SSH access** to your target servers

### Install Aship

```bash
# Install globally via npm
npm install -g aship

# Or using pnpm
pnpm add -g aship

# Or using yarn
yarn global add aship

# Verify installation
aship --version
```

## 🚀 Quick Start

### 1. Initialize a Project

```bash
mkdir my-ansible-project
cd my-ansible-project
aship init
```

### 2. Configure Your Project

Edit the generated `aship.yml`:

```yaml
name: "My Project"
description: "Example Ansible project"

playbooks:
  deploy: "playbooks/deploy.yml"

vars:
  environment:
    type: choice
    description: "Target environment"
    choices: ["dev", "staging", "prod"]
    default: "dev"
    required: true

tags:
  # Tag definitions with descriptions
  common: "Basic system setup"
  app: "Application deployment"
  database: "Database operations"

  # Default and groups
  default: ["common", "app"]
  quick: ["app"]
  full: ["common", "app", "database"]
```

### 3. Run Your Playbook

```bash
# Run with interactive prompts
aship deploy

# Or run the default playbook (if only one is defined)
aship
```

Aship will guide you through:
1. **Server Selection** - Choose from configured servers, inventory, or manual input
2. **Variable Collection** - Provide values for defined variables
3. **Tag Selection** - Choose which Ansible tags to execute
4. **Execution** - Run the playbook with your configuration

## 📖 Documentation

### 📚 User Documentation
- **[Getting Started](./docs/01-GETTING-STARTED.md)** - Installation and quick start guide
- **[Configuration Reference](./docs/02-CONFIGURATION.md)** - Complete configuration documentation
- **[Server Configuration](./docs/03-SERVER-CONFIGURATION.md)** - Server and connection management
- **[CLI Reference](./docs/04-CLI-REFERENCE.md)** - All commands and options
- **[Examples](./docs/05-EXAMPLES.md)** - Real-world usage examples
- **[Troubleshooting](./docs/06-TROUBLESHOOTING.md)** - Common issues and solutions

### 🏗️ Architecture Documentation
- **[Core Package](./packages/core/README.md)** - Core functionality and APIs
- **[CLI Package](./packages/cli/README.md)** - Command-line interface implementation
- **[Main Package](./packages/aship/README.md)** - Main CLI package

### 💡 Examples & Tutorials
- **[Getting Started Example](./examples/getting-started/)** - Comprehensive feature demonstration
- **[Single Playbook Example](./examples/single-playbook/)** - Simple single-playbook setup
- **[Example Projects Overview](./examples/README.md)** - All available examples

## 🎯 Core Commands

### Run Playbooks

```bash
# Run with interactive prompts
aship [playbook-name]

# Run with specific options
aship deploy --tags web,database --verbose

# Non-interactive mode
aship deploy --skip-vars --yes
```

### Server Management

```bash
# List configured servers
aship server list

# Add a new server
aship server add

# Test server connection
aship server test server-name
```

### Execute Ansible Commands

```bash
# Run arbitrary Ansible modules
aship exec shell --args "uptime"
aship exec service --args "name=nginx state=started"
```

### Cache Management

```bash
# List cache status
aship cache list

# Clear specific cache
aship cache clear connections
aship cache clear variables
```

## ⚙️ Configuration

### Project Configuration (`aship.yml`)

```yaml
name: "My Application"
description: "Deploy web application"

# Define playbooks
playbooks:
  deploy: "playbooks/deploy.yml"
  rollback: "playbooks/rollback.yml"

# Define variables with rich types
vars:
  environment:
    type: choice
    description: "Target environment"
    choices: ["dev", "staging", "production"]
    default: "dev"
    required: true

  app_version:
    type: string
    description: "Application version"
    default: "latest"

  features:
    type: multiselect
    description: "Features to enable"
    choices: ["auth", "logging", "monitoring"]
    default: ["auth", "logging"]

  admin_password:
    type: password
    description: "Admin password"
    required: true

# Define tags with descriptions and groups
tags:
  # Tag definitions with descriptions
  common: "Basic system setup"
  app: "Application deployment"
  database: "Database operations"
  monitoring: "Monitoring setup"

  # Default and groups
  default: ["common", "app"]
  quick: ["app"]
  full: ["common", "app", "database", "monitoring"]
```

### Server Configuration (`.aship/servers.yml`)

```yaml
servers:
  - name: "production-web"
    hostname: "prod.example.com"
    user: "deploy"
    port: 22
    description: "Production web server"
    identity_file: "~/.ssh/production_key"

  - name: "staging-server"
    hostname: "staging.example.com"
    user: "ubuntu"
    port: 22
    description: "Staging server"
```

## 🌟 Variable Types

Aship supports rich variable types with validation and interactive prompts:

| Type | Description | Example |
|------|-------------|---------|
| `string` | Text input with optional pattern validation | Application name, version |
| `int` | Integer input with min/max validation | Port numbers, timeouts |
| `bool` | Boolean true/false | Enable features, debug mode |
| `choice` | Single selection from predefined options | Environment, deployment strategy |
| `multiselect` | Multiple selections from options | Features to enable, services to deploy |
| `password` | Masked password input | Database passwords, API keys |
| `list` | Comma-separated list input | IP addresses, hostnames |

## 🏷️ Tag Management

Organize your Ansible tasks with tag groups:

```yaml
tags:
  # Tag definitions with descriptions
  common: "Basic system setup"
  app: "Application deployment"
  db: "Database operations"
  backup: "Backup operations"
  cleanup: "Cleanup tasks"

  # Default tags when none specified
  default: ["common", "app"]

  # Predefined tag groups
  quick: ["app"]                    # Fast deployment
  full: ["common", "app", "db"]     # Complete deployment
  maintenance: ["backup", "cleanup"] # Maintenance tasks
```

## 🔄 Workflow Examples

### Basic Deployment

```bash
# Initialize project
aship init

# Configure aship.yml with your playbooks and variables
# Run deployment
aship deploy
```

### CI/CD Integration

```bash
# Non-interactive deployment for CI/CD
aship deploy \
  --skip-vars \
  --yes \
  --tags "app" \
  --extra-vars "version=1.2.3,environment=production"
```

### Multi-Environment Setup

```yaml
# aship.yml
vars:
  environment:
    type: choice
    choices: ["dev", "staging", "prod"]
    required: true

# Use custom ansible configuration
ansible:
  configPath: "ansible.cfg"
```

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

---

**Made with ❤️ by the Aship team**
