# Aship

[![npm version](https://badge.fury.io/js/aship.svg)](https://badge.fury.io/js/aship)

**Aship** is an interactive Ansible CLI that simplifies playbook execution with smart prompts, variable management, and streamlined server configuration.

This is the main CLI package that provides the `aship` command-line interface.

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

```bash
# Initialize a new project
mkdir my-ansible-project
cd my-ansible-project
aship init

# Run a playbook with interactive prompts
aship deploy

# Or run the default playbook (if only one is defined)
aship
```

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

### Cache Management
```bash
# List cache status
aship cache list

# Clear specific cache
aship cache clear connections
aship cache clear variables
```

## 📖 Documentation

### 📚 Complete Documentation
- **[Getting Started](../../docs/01-GETTING-STARTED.md)** - Installation and quick start guide
- **[Configuration Reference](../../docs/02-CONFIGURATION.md)** - Complete configuration documentation
- **[Server Configuration](../../docs/03-SERVER-CONFIGURATION.md)** - Server and connection management
- **[CLI Reference](../../docs/04-CLI-REFERENCE.md)** - All commands and options
- **[Examples](../../docs/05-EXAMPLES.md)** - Real-world usage examples
- **[Troubleshooting](../../docs/06-TROUBLESHOOTING.md)** - Common issues and solutions

### 🏗️ Architecture Documentation
- **[Core Package](../core/README.md)** - Core functionality and APIs
- **[CLI Package](../cli/README.md)** - Command-line interface implementation

### 💡 Examples
- **[Getting Started Example](../../examples/getting-started/)** - Comprehensive feature demonstration
- **[Single Playbook Example](../../examples/single-playbook/)** - Simple single-playbook setup

## 🔗 Related Packages

This package depends on:
- **[@aship/core](../core/)** - Core functionality for Ansible management
- **[@aship/cli](../cli/)** - Command-line interface implementation

## 📄 License

MIT License - see [LICENSE](../../LICENSE) for details.
