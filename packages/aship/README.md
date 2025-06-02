# aship

[![npm version](https://badge.fury.io/js/aship.svg)](https://badge.fury.io/js/aship)

**aship** is a zero-config Ansible tool for simplified deployments and flexible host management.

This is the main CLI package that provides the `aship` command-line interface.

## 🎯 Why aship?

### The Ansible Challenge

While Ansible is powerful for infrastructure automation, it often presents challenges in daily operations:

- **Complex Command Syntax**: Remembering lengthy `ansible-playbook` commands with multiple parameters
- **Variable Management**: Manually passing variables through command line or separate files
- **Host Management**: Maintaining inventory files and connection details across environments
- **Tag Coordination**: Managing complex tag combinations for different deployment scenarios
- **Repetitive Setup**: Writing the same boilerplate configurations for each project

### What aship Solves

aship addresses these pain points by providing:

- **Interactive Workflows**: Guided prompts replace complex command memorization
- **Centralized Configuration**: Single `aship.yml` file manages all project settings
- **Smart Variable Handling**: Rich input types with validation and secure password handling
- **Simplified Host Management**: Built-in host configuration with connection testing
- **Tag Orchestration**: Predefined tag groups for common deployment patterns

## 🚀 When to Use aship

### ✅ Perfect For

- **Development Teams**: Simplify Ansible adoption for developers new to infrastructure automation
- **Frequent Deployments**: Streamline repetitive deployment workflows with consistent configurations
- **Multi-Environment Projects**: Manage different environments (dev/staging/prod) with variable-driven deployments
- **Interactive Operations**: When you need guided prompts for safe production deployments
- **Team Collaboration**: Standardize deployment processes across team members
- **CI/CD Integration**: Combine interactive development workflows with automated pipeline deployments

### ❌ When NOT to Use

- **Simple One-off Tasks**: For basic Ansible ad-hoc commands, native `ansible` CLI is sufficient
- **Highly Customized Workflows**: Complex automation requiring extensive Ansible plugins or custom modules
- **Performance-Critical Automation**: When milliseconds matter and CLI overhead is unacceptable
- **Legacy Ansible Projects**: Existing projects with complex inventory structures that can't be easily migrated
- **Pure Infrastructure as Code**: When you prefer declarative configuration management over interactive tools

### 🎯 Best Practices

- **Start Small**: Begin with simple playbooks and gradually add complexity
- **Environment Separation**: Use aship's variable system to manage environment-specific configurations
- **Tag Strategy**: Design meaningful tag groups that match your deployment patterns
- **Host Organization**: Group hosts logically and use descriptive names for easy identification
- **Security First**: Use password variables for sensitive data and test connections before deployment
- **Team Standards**: Establish consistent `aship.yml` patterns across your organization

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

### Install aship

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

aship will guide you through:
1. **Server Selection** - Choose from configured servers, inventory, or manual input
2. **Variable Collection** - Provide values for defined variables
3. **Tag Selection** - Choose which Ansible tags to execute
4. **Execution** - Run the playbook with your configuration

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

### Host Management
```bash
# List configured hosts
aship host list

# Add a new host
aship host add

# Test host connection
aship host test host-name

# Export hosts to file
aship host export --format yaml --output hosts.yml
```

### Inventory Management
```bash
# Generate Ansible inventory
aship inventory generate

# Show inventory content
aship inventory show
```

### Execute Ansible Commands
```bash
# Run arbitrary Ansible modules
aship exec all command -a "uptime"
aship exec web service -a "name=nginx state=started"
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

### Host Configuration

Hosts are managed through the CLI commands:

```bash
# Add hosts interactively
aship host add

# Add hosts with parameters
aship host add --name "production-web" --hostname "prod.example.com" --user "deploy"

# List all hosts
aship host list

# Export hosts to file
aship host export --format yaml --output hosts.yml
```

## 🌟 Variable Types

aship supports rich variable types with validation and interactive prompts:

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

## 📖 Additional Resources

For examples, troubleshooting, and development information:

**📚 [Project Repository on GitHub](https://github.com/teomyth/aship)**
- Example projects and tutorials
- Troubleshooting guides
- Development and contribution guides

## 🔗 Related Packages

This package depends on:
- **[@aship/core](https://www.npmjs.com/package/@aship/core)** - Core functionality for Ansible management
- **[@aship/cli](https://www.npmjs.com/package/@aship/cli)** - Command-line interface implementation

## 📄 License

MIT License - see [LICENSE](https://github.com/teomyth/aship/blob/main/LICENSE) for details.
