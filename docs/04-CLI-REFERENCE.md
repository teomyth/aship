# CLI Reference

Complete reference for all Aship command line interface commands and options.

## Global Options

These options are available for all commands:

```bash
aship [command] [options]
```

**Global Options:**
- `--help, -h` - Show help information
- `--version, -V` - Show version number
- `--verbose, -v` - Enable verbose output
- `--debug` - Enable debug output
- `--config <path>` - Specify custom config file path (default: `aship.yml`)

## Core Commands

### `aship [playbook]`

Run an Ansible playbook with interactive configuration.

```bash
# Run default playbook (if only one is defined)
aship

# Run specific playbook
aship deploy

# Run with options
aship deploy --tags web,database --verbose
```

**Arguments:**
- `playbook` (optional) - Name of the playbook to run (as defined in `aship.yml`)

**Options:**
- `-s, --server <servers>` - Target server(s) to run on (comma-separated)
- `-h, --host <host>` - Directly specify a host to connect to
- `-u, --user <user>` - Username for connection
- `-p, --password <pass>` - Password for connection
- `-k, --key <path>` - SSH key for connection
- `--reuse` - Reuse previous connection information without prompting
- `-S, --skip-vars` - Skip variable collection, use defaults/existing values
- `-y, --yes` - Skip all prompts and use defaults
- `-q, --quiet` - Suppress all output except errors
- `--debug` - Enable debug mode

**Ansible Options:**
All standard ansible-playbook options are supported and passed through automatically, including:
- `--tags, -t <tags>` - Only run plays and tasks tagged with these values
- `--skip-tags <tags>` - Only run plays and tasks whose tags do not match these values
- `--limit, -l <subset>` - Further limit selected hosts to an additional pattern
- `--extra-vars, -e <vars>` - Set additional variables as key=value or YAML/JSON
- `--check` - Don't make any changes; instead, try to predict some of the changes
- `--diff` - When changing (small) files and templates, show the differences
- `--inventory, -i <path>` - Specify inventory host path or comma separated host list
- `--become` - Run operations with become (nopasswd implied)
- `--become-user <user>` - Run operations as this user (default=root)
- `--ask-become-pass` - Ask for privilege escalation password
- `--vault-id <id>` - The vault identity to use
- `--ask-vault-pass` - Ask for vault password

**Examples:**
```bash
# Basic deployment
aship deploy

# Deploy with specific tags
aship deploy --tags "common,app" --debug

# Dry run deployment
aship deploy --check --diff

# Deploy to specific hosts
aship deploy --limit "web-servers"

# Deploy with extra variables
aship deploy --extra-vars "version=1.2.3,debug=true"

# Non-interactive deployment
aship deploy --skip-vars --yes

# Deploy to specific server
aship deploy --server "production-web"

# Deploy with direct host connection
aship deploy --host "192.168.1.10" --user "deploy" --key "~/.ssh/id_rsa"
```

### `aship init`

Initialize a new Aship project in the current directory.

```bash
aship init [options]
```

**Options:**
- `-y, --yes` - Skip prompts and use defaults
- `--minimal` - Create minimal configuration without playbook definitions

**Examples:**
```bash
# Interactive initialization
aship init

# Initialize with defaults (non-interactive)
aship init --yes

# Create minimal configuration
aship init --minimal
```

### `aship exec`

Execute a single task on target servers (ansible command).

```bash
aship exec [pattern] [module] [options]
```

**Arguments:**
- `pattern` (optional) - Host pattern to target (default: all)
- `module` (optional) - Module name to execute (default: command)

**Options:**
- `-s, --server <servers>` - Target server(s) to run on (comma-separated)
- `-h, --host <host>` - Directly specify a host to connect to
- `-u, --user <user>` - Username for connection
- `-p, --password <pass>` - Password for connection
- `-k, --key <path>` - SSH key for connection
- `--reuse` - Reuse previous connection information without prompting
- `-m, --module <module>` - Module name to execute
- `-a, --args <args>` - Module arguments
- `--non-interactive` - Run in non-interactive mode

**Examples:**
```bash
# Run shell command on all hosts
aship exec all command --args "uptime"

# Check service status
aship exec all service --args "name=nginx state=started"

# Run command on specific server
aship exec --server "web-1" --module shell --args "systemctl status nginx"

# Run with direct host connection
aship exec --host "192.168.1.10" --user "admin" --module command --args "df -h"
```

## Server Management

### `aship server list`

List configured servers and connection history.

```bash
aship server list [options]
```

**Options:**
- `--json` - Output in JSON format
- `--filter-tag <tag>` - Filter servers by tag

**Examples:**
```bash
# List all servers
aship server list

# List in JSON format
aship server list --json

# Filter by tag
aship server list --filter-tag "production"
```

### `aship server add`

Add a new server configuration.

```bash
aship server add [options]
```

**Options:**
- `--name <name>` - Server name
- `--host <host>` - Server host (IP or hostname)
- `--port <port>` - SSH port (default: 22)
- `--user <user>` - SSH username
- `--auth-type <type>` - Authentication type (key, password, or agent)
- `--key-path <path>` - Path to SSH key (for key authentication)
- `--password <password>` - SSH password (for password authentication)
- `--tags <tags>` - Comma-separated list of tags for the server
- `--non-interactive` - Run in non-interactive mode (requires all necessary options)

**Examples:**
```bash
# Interactive server addition
aship server add

# Add server with SSH key authentication
aship server add --name "web-1" --host "192.168.1.10" --user "deploy" --auth-type "key" --key-path "~/.ssh/id_rsa"

# Add server with password authentication
aship server add --name "db-1" --host "192.168.1.20" --user "admin" --auth-type "password" --password "secret"

# Add server with tags
aship server add --name "prod-web" --host "prod.example.com" --user "deploy" --tags "production,web"
```

### `aship server edit`

Edit an existing server configuration.

```bash
aship server edit <name> [options]
```

**Arguments:**
- `name` - Name of the server to edit

**Examples:**
```bash
# Edit server interactively
aship server edit web-1
```

### `aship server remove`

Remove a server configuration.

```bash
aship server remove <name> [options]
```

**Arguments:**
- `name` - Name of the server to remove

**Options:**
- `--force` - Force removal without confirmation

**Examples:**
```bash
# Remove server with confirmation
aship server remove web-1

# Remove without confirmation
aship server remove web-1 --force
```

### `aship server test`

Test connection to a server.

```bash
aship server test <name> [options]
```

**Arguments:**
- `name` (optional) - Name of the server to test

**Options:**
- `--non-interactive` - Run in non-interactive mode (requires server name)
- `--quiet` - Show minimal output (only success/failure)
- `--json` - Output result as JSON

**Examples:**
```bash
# Test server connection
aship server test web-1

# Test with minimal output
aship server test web-1 --quiet

# Test with JSON output
aship server test web-1 --json
```

## Cache Management

### `aship cache list`

List cached data (connections, variables, etc.).

```bash
aship cache list [options]
```

**Options:**
- `--format <format>` - Output format: `table`, `json` (default: `table`)
- `--details` - Show detailed information for connections

### `aship cache clear`

Clear cached data.

```bash
aship cache clear [type] [options]
```

**Arguments:**
- `type` (optional) - Cache type to clear: `vars`, `connections`, `variable-history` (default: all types)

**Options:**
- `--all` - Clear all cache types
- `--force, -f` - Clear without confirmation
- `--dry-run` - Show what would be cleared without actually clearing
- `--max-age <duration>` - Only clear entries older than specified duration

**Examples:**
```bash
# Clear all cache
aship cache clear

# Clear only variable cache
aship cache clear vars

# Clear only connection cache
aship cache clear connections

# Clear without confirmation
aship cache clear --force
```

## Environment Variables

Aship respects several environment variables:

- `ANSOR_CONFIG` - Path to configuration file (overrides `--config`)
- `ANSOR_LOG_LEVEL` - Log level: `debug`, `info`, `warn`, `error`
- `ANSOR_NO_COLOR` - Disable colored output
- `ANSIBLE_CONFIG` - Path to Ansible configuration file
- `ANSIBLE_INVENTORY` - Default inventory file
- `ANSIBLE_HOST_KEY_CHECKING` - SSH host key checking

## Exit Codes

Aship uses standard exit codes:

- `0` - Success
- `1` - General error
- `2` - Ansible execution failed
- `3` - Configuration error
- `4` - Connection error
- `130` - Interrupted by user (Ctrl+C)

## Configuration File Locations

Aship looks for configuration files in the following order:

1. `--config` option value
2. `ANSOR_CONFIG` environment variable
3. `aship.yml` in current directory
4. `aship.yaml` in current directory

Server configurations are stored in:
- `.aship/servers.yml` (project-specific, YAML format)
- `~/.aship/servers.yml` (global configuration, YAML format)

## Tips and Best Practices

### 1. Use Aliases for Common Commands

```bash
# Add to your shell profile
alias deploy="aship deploy"
alias quick-deploy="aship deploy --tags quick --yes"
```

### 2. Environment-Specific Configurations

```bash
# Use different configs for different environments
aship deploy --config aship.prod.yml
aship deploy --config aship.staging.yml
```

### 3. Combine with Shell Scripts

```bash
#!/bin/bash
# deploy.sh
set -e

echo "Building application..."
npm run build

echo "Deploying to production..."
aship deploy --tags "app" --extra-vars "version=$(git rev-parse --short HEAD)"

echo "Deployment complete!"
```

### 4. Use Inventory Files

```bash
# Use existing Ansible inventory
aship deploy --inventory inventory/production.ini
```

### 5. Debug Connection Issues

```bash
# Enable debug output for connection troubleshooting
aship deploy --debug
```
