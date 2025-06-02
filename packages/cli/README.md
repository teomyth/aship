# Aship CLI

A zero-config Ansible tool for simplified deployments and flexible host management.

## 🚀 Features

- **Interactive Host Management**: Add, edit, and manage SSH hosts with ease
- **Smart Inventory Generation**: Automatically generate Ansible inventory from configured hosts
- **Flexible Execution**: Run playbooks and ad-hoc commands with dynamic host selection
- **Multiple Data Sources**: Import hosts from SSH config, JSON/YAML files, or manual entry
- **Usage Analytics**: Track host usage and connection statistics
- **Command Aliases**: Convenient shortcuts for common operations

## 📦 Installation

```bash
npm install -g @aship/cli
```

## 🎯 Quick Start

```bash
# Initialize a new project
aship init

# Add a host interactively
aship host add

# List all hosts
aship host list

# Generate inventory
aship inventory generate

# Run a playbook
aship run playbook.yml
```

## 📚 Usage Examples

### Host Management

```bash
# List all configured hosts
aship host list

# List hosts with usage statistics
aship host list --usage

# List hosts with detailed information
aship host list --verbose

# Filter hosts by source
aship host list --source manual

# Output in JSON format
aship host list --format json

# Add a new host interactively
aship host add

# Add a host with specific parameters
aship host add --name web-server --hostname 192.168.1.100 --user ubuntu

# Add host and test connection
aship host add --hostname example.com --test

# Add host non-interactively
aship host add --non-interactive --hostname 192.168.1.100 --user ubuntu

# Remove a host
aship host remove web-server

# Remove host interactively
aship host remove --interactive

# Edit host configuration
aship host edit web-server

# Edit host with specific changes
aship host edit web-server --hostname new.example.com --port 2222

# Show detailed host information
aship host show web-server

# Show host info with usage statistics
aship host show web-server --usage

# Test host connection
aship host test web-server

# Test all hosts
aship host test --all

# Import hosts from SSH config
aship host import --ssh-config

# Import hosts from file
aship host import --file hosts.json

# Export hosts to JSON
aship host export --format json --output hosts.json

# Export hosts to Ansible inventory
aship host export --format ansible --output inventory.yml

# Clear usage history
aship host clear --usage

# Clear recent connections
aship host clear --recent

# Using aliases for common operations
aship host create -n web-server -h 192.168.1.100 -u ubuntu
aship host rm web-server -f
aship host ping --all
aship hosts -u
aship host info web-server
```

### Inventory Management

```bash
# Generate inventory to console
aship inventory generate

# Generate inventory to file
aship inventory generate --output inventory.yml

# Generate in JSON format
aship inventory generate --format json

# Filter hosts by pattern
aship inventory generate --filter "web-*"

# Filter by source type
aship inventory generate --source manual

# Custom group name
aship inventory generate --group production_hosts

# Include/exclude specific hosts
aship inventory generate --include web-1,web-2 --exclude db-1

# Show inventory preview
aship inventory show

# Show only host count
aship inventory show --count

# Show only hosts section
aship inventory show --hosts-only

# Inject aship hosts into existing inventory
aship inventory inject inventory.yml

# Dry run injection (preview changes)
aship inventory inject inventory.yml --dry-run

# Inject with backup
aship inventory inject inventory.yml --backup

# Force overwrite existing hosts
aship inventory inject inventory.yml --force

# Using aliases for inventory commands
aship inventory gen --output inventory.yml
aship inventory preview --format json
aship inventory merge inventory.yml --backup
```

### Playbook Execution

```bash
# Run playbook interactively
aship run [playbook-name]

# Run with different options
aship run setup -S                    # Skip variable configuration
aship run setup -y                    # Use all defaults
aship run deploy -e "env=prod"        # With extra variables
aship run setup --tags common --check # With Ansible options
aship run deploy -H web-prod-1        # Using aship hosts
aship run deploy -i custom.yml        # With custom inventory

# Run with mixed inventory modes
aship run deploy -H web-1,web-2 -i base.yml --inventory-mode inject

# Initialize new project
aship init
aship initialize --yes
aship setup --minimal
```

### Task Execution

```bash
# Execute ansible modules
aship exec all command -a "uptime"

# Execute on specific pattern
aship exec web setup -a "name=nginx state=present"

# Use specific module
aship exec -m ping

# Execute on specific host
aship exec -h 192.168.1.100 -m command -a "ls -la"

# Execute on named server
aship exec -s web-server -m service -a "name=nginx state=started"

# Non-interactive execution
aship exec all command -a "whoami" --non-interactive
```

## 🔄 Command Compatibility

All commands from the original CLI are supported:

- `init` → `aship init`
- `run` → `aship run`
- `host list` → `aship host list`
- `host add` → `aship host add`

### Command Aliases

The CLI supports convenient aliases for common operations:

**Host Commands:**
- `aship host add` = `aship host create` = `aship host new`
- `aship host remove` = `aship host rm` = `aship host delete` = `aship host del`
- `aship host list` = `aship host ls` = `aship hosts`
- `aship host show` = `aship host info` = `aship host get` = `aship host describe`
- `aship host edit` = `aship host update` = `aship host modify` = `aship host change`
- `aship host test` = `aship host ping` = `aship host check` = `aship host connect`
- `aship host import` = `aship host load` = `aship host sync`
- `aship host export` = `aship host save` = `aship host dump` = `aship host backup`
- `aship host clear` = `aship host clean` = `aship host reset` = `aship host purge`

**Inventory Commands:**
- `aship inventory generate` = `aship inventory gen` = `aship inventory create`
- `aship inventory show` = `aship inventory preview` = `aship inventory view`
- `aship inventory inject` = `aship inventory merge` = `aship inventory add`

**Project Commands:**
- `aship init` = `aship initialize` = `aship setup`

## 📖 Command Reference

### Global Options

- `--help`: Show help information
- `--version`: Show version information
- `--verbose`: Enable verbose output
- `--quiet`: Suppress non-essential output
- `--no-color`: Disable colored output

### Run Command

The `run` command supports all Ansible options and aship-specific features:

```bash
aship run [PLAYBOOK] [OPTIONS]
```

**Aship-specific Options:**
- `-H, --hosts <hosts>`: Comma-separated list of aship host names
- `-S, --skip-vars`: Skip variable configuration prompts
- `-y, --yes`: Use default values for all prompts
- `--inventory-mode <mode>`: How to handle inventory (replace|inject|merge)

**Standard Ansible Options:**
- `-i, --inventory <file>`: Specify inventory file
- `-e, --extra-vars <vars>`: Set additional variables
- `--tags <tags>`: Only run plays and tasks tagged with these values
- `--skip-tags <tags>`: Skip plays and tasks with these tags
- `--check`: Run in check mode (dry run)
- `--diff`: Show differences when changing files
- `-v, --verbose`: Verbose mode (-vvv for more)

### Host Commands

**List Hosts:**
```bash
aship host list [OPTIONS]
```

Options:
- `-u, --usage`: Show usage statistics
- `-s, --source <type>`: Filter by source (manual|ssh_config|imported)
- `-f, --format <format>`: Output format (table|json)
- `-v, --verbose`: Show detailed information
- `-q, --quiet`: Show only host names

**Add Host:**
```bash
aship host add [OPTIONS]
```

Aliases: `host:create`, `host:new`

Options:
- `-n, --name <n>`: Host name
- `-h, --hostname <hostname>`: Host hostname (IP or hostname)
- `-p, --port <port>`: SSH port (default: 22)
- `-u, --user <user>`: SSH username
- `-i, --identity-file <path>`: Path to SSH identity file
- `-d, --description <desc>`: Host description
- `--non-interactive`: Run in non-interactive mode
- `-t, --test`: Test connection after adding
- `-f, --force`: Overwrite existing host

**Remove Host:**
```bash
aship host remove [NAME] [OPTIONS]
```

Aliases: `host:rm`, `host:delete`, `host:del`

Options:
- `-f, --force`: Skip confirmation prompt
- `-i, --interactive`: Select host interactively
- `--keep-usage`: Keep usage history when removing

**Edit Host:**
```bash
aship host edit [NAME] [OPTIONS]
```

Aliases: `host:update`, `host:modify`, `host:change`

Options:
- `-i, --interactive`: Select host interactively
- `--hostname <hostname>`: New hostname
- `--port <port>`: New SSH port
- `--user <user>`: New SSH username
- `--identity-file <path>`: New SSH identity file
- `--description <desc>`: New description
- `--non-interactive`: Run in non-interactive mode
- `--test`: Test connection after editing
- `--clear-identity`: Clear SSH identity file
- `--clear-description`: Clear description

**Show Host:**
```bash
aship host show [NAME] [OPTIONS]
```

Aliases: `host:info`, `host:get`, `host:describe`

Options:
- `-i, --interactive`: Select host interactively
- `-u, --usage`: Show usage statistics
- `-f, --format <format>`: Output format (table|json)
- `-r, --relative-time`: Show relative time

**Test Host:**
```bash
aship host test [NAME] [OPTIONS]
```

Aliases: `host:ping`, `host:check`, `host:connect`

Options:
- `-i, --interactive`: Select host interactively
- `-a, --all`: Test all configured hosts
- `-v, --verbose`: Show detailed connection information
- `-t, --timeout <seconds>`: Connection timeout
- `--update-usage`: Update usage statistics on success

**Import Hosts:**
```bash
aship host import [SOURCE] [OPTIONS]
```

Aliases: `host:load`, `host:sync`

Options:
- `--ssh-config`: Import from SSH config file
- `-f, --file <path>`: Import from JSON/YAML file
- `--filter <pattern>`: Filter hosts by pattern
- `--force`: Overwrite existing hosts
- `-d, --dry-run`: Show what would be imported
- `-i, --interactive`: Interactively select hosts

**Export Hosts:**
```bash
aship host export [OPTIONS]
```

Aliases: `host:save`, `host:dump`, `host:backup`

Options:
- `-f, --format <format>`: Export format (json|yaml|ssh-config|ansible)
- `-o, --output <file>`: Output file path
- `--filter <pattern>`: Filter hosts by pattern
- `-s, --source <type>`: Filter by source type
- `--include-usage`: Include usage statistics
- `-p, --pretty`: Pretty print output (JSON)
- `-g, --group <n>`: Group name for Ansible format

**Clear Host Data:**
```bash
aship host clear [OPTIONS]
```

Aliases: `host:clean`, `host:reset`, `host:purge`

Options:
- `-u, --usage`: Clear usage history
- `-r, --recent`: Clear recent connections
- `-a, --all`: Clear all host-related data
- `-f, --force`: Skip confirmation prompt

## 🤝 Contributing

This package is part of the Aship project. Please refer to the main project documentation for contribution guidelines.

## 📄 License

MIT - see the main project LICENSE file for details.
