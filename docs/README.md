# Aship Documentation

Welcome to the Aship documentation! Aship is an interactive Ansible CLI that simplifies playbook execution with smart prompts and streamlined configuration.

## Table of Contents

- [Getting Started](./01-GETTING-STARTED.md) - Quick start guide and installation
- [Configuration](./02-CONFIGURATION.md) - Project configuration reference (aship.yml)
- [Server Configuration](./03-SERVER-CONFIGURATION.md) - Server and connection management
- [CLI Reference](./04-CLI-REFERENCE.md) - Command line interface documentation
- [Examples](./05-EXAMPLES.md) - Usage examples and best practices
- [Troubleshooting](./06-TROUBLESHOOTING.md) - Common issues and solutions

## Quick Links

- [Installation Guide](./01-GETTING-STARTED.md#installation)
- [Project Configuration Reference](./02-CONFIGURATION.md#aship-yml-reference)
- [Variable Types](./02-CONFIGURATION.md#variable-types)
- [Server Configuration](./03-SERVER-CONFIGURATION.md)
- [Server Management Commands](./04-CLI-REFERENCE.md#server-management)
- [Example Projects](./05-EXAMPLES.md)

## Overview

Aship simplifies Ansible by providing:

- **Interactive Server Selection**: Choose from configured servers, connection history, or inventory hosts
- **Variable Management**: Define and collect variables with rich type support
- **Tag-based Execution**: Organize and select Ansible tags for targeted deployments
- **Connection Management**: Automatic SSH connection handling and credential management
- **Project Configuration**: Simple YAML-based project setup

## Key Features

### 🚀 **Simplified Workflow**
- One command to run playbooks: `aship [playbook]`
- Interactive prompts for server selection and variable input
- Automatic inventory and variable file generation

### 🔧 **Rich Variable Types**
- String, number, boolean, choice, multiselect
- Password fields with masking
- Validation and default values
- Variable grouping for organization

### 🌐 **Flexible Server Management**
- Configure servers in `.aship/servers.yml`
- Use existing Ansible inventory files
- Connection history for quick access
- Manual server input support

### 🏷️ **Tag Management**
- Define tag groups for common deployment scenarios
- Interactive tag selection with descriptions
- Support for Ansible's native tag system

### 📁 **Project Organization**
- Simple `aship.yml` configuration file
- Support for multiple playbooks per project
- Environment-specific configurations

## Getting Started

1. **Install Aship**:
   ```bash
   npm install -g aship
   ```

2. **Initialize a project**:
   ```bash
   aship init
   ```

3. **Configure your project** in `aship.yml`

4. **Run your playbook**:
   ```bash
   aship
   ```

For detailed instructions, see the [Getting Started Guide](./01-GETTING-STARTED.md).

## Community and Support

- **GitHub**: [https://github.com/teomyth/aship](https://github.com/teomyth/aship)
- **Issues**: [Report bugs and request features](https://github.com/teomyth/aship/issues)
- **Discussions**: [Community discussions](https://github.com/teomyth/aship/discussions)

## License

MIT License - see [LICENSE](../LICENSE) for details.
