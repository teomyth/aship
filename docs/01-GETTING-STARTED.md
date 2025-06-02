# Getting Started with Aship

This guide will help you get up and running with Aship quickly.

## Installation

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
```

### Verify Installation

```bash
aship --version
```

## Quick Start

### 1. Initialize a New Project

Create a new directory for your project and initialize it:

```bash
mkdir my-ansible-project
cd my-ansible-project
aship init
```

This will create an `aship.yml` configuration file with basic settings.

### 2. Configure Your Project

Edit the generated `aship.yml` file:

```yaml
# aship.yml
name: "My Ansible Project"
description: "Example project configuration"

# Define your playbooks
playbooks:
  deploy: "playbooks/deploy.yml"
  setup: "playbooks/setup.yml"

# Define variables that will be collected interactively
vars:
  environment:
    type: choice
    description: "Target environment"
    choices: ["development", "staging", "production"]
    default: "development"
    required: true

  app_version:
    type: string
    description: "Application version to deploy"
    default: "latest"
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
  quick: ["common", "app"]
  full: ["common", "app", "database", "monitoring"]
```

### 3. Create Your Playbooks

Create the playbooks directory and add your Ansible playbooks:

```bash
mkdir -p playbooks
```

Example `playbooks/deploy.yml`:

```yaml
---
- name: Deploy Application
  hosts: all
  become: yes
  vars:
    env: "{{ environment }}"
    version: "{{ app_version }}"

  tasks:
    - name: Update system packages
      apt:
        update_cache: yes
      tags: [common]

    - name: Deploy application
      copy:
        content: "Deploying {{ version }} to {{ env }}"
        dest: "/tmp/deployment-info.txt"
      tags: [app]
```

### 4. Configure Servers (Optional)

You can configure servers in `.aship/servers.yml` for quick access:

```bash
mkdir -p .aship
```

Create `.aship/servers.yml`:

```yaml
servers:
  - name: "web-server-1"
    hostname: "192.168.1.10"
    user: "deploy"
    port: 22
    description: "Web server 1"
    identity_file: "~/.ssh/id_rsa"

  - name: "web-server-2"
    hostname: "192.168.1.11"
    user: "deploy"
    port: 22
    description: "Web server 2"
```

### 5. Run Your Playbook

Now you can run your playbook:

```bash
# Run the default playbook (if only one is defined)
aship

# Or specify a playbook
aship deploy

# Run with specific options
aship deploy --tags common,app --verbose
```

Aship will guide you through:
1. **Server Selection**: Choose from configured servers, inventory, or manual input
2. **Variable Collection**: Provide values for defined variables
3. **Tag Selection**: Choose which Ansible tags to execute
4. **Execution**: Run the Ansible playbook with your selections

## Next Steps

- **Learn about [Configuration](./02-CONFIGURATION.md)** - Detailed configuration options
- **Explore [CLI Reference](./04-CLI-REFERENCE.md)** - All available commands
- **Check [Examples](./05-EXAMPLES.md)** - Real-world usage examples
- **Read [Troubleshooting](./06-TROUBLESHOOTING.md)** - Common issues and solutions

## Example Workflow

Here's a typical workflow with Aship:

1. **Initialize**: `aship init`
2. **Configure**: Edit `aship.yml` with your variables and playbooks
3. **Setup servers**: Configure `.aship/servers.yml` or use existing inventory
4. **Deploy**: `aship deploy`
5. **Select server**: Choose from the interactive list
6. **Set variables**: Provide values through interactive prompts
7. **Choose tags**: Select which parts of the playbook to run
8. **Execute**: Aship runs Ansible with your configuration

The beauty of Aship is that it remembers your choices, making subsequent deployments faster and more consistent.
