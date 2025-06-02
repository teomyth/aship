# Server Configuration

This document covers server configuration and connection management in Aship.

## Overview

Aship supports multiple ways to specify target servers:

1. **Configured Servers** - Pre-configured servers in `.aship/servers.yml`
2. **Connection History** - Recently used connections (automatic)
3. **Inventory Files** - Existing Ansible inventory files
4. **Manual Input** - Interactive server specification

## Server Configuration Files

### Project-Specific Servers

Configure servers for a specific project in `.aship/servers.yml`:

```yaml
servers:
  - name: "production-web-1"
    hostname: "prod-web-1.example.com"
    user: "deploy"
    port: 22
    description: "Production web server #1"
    tags: ["web", "production"]
    variables:
      environment: "production"
      server_role: "web"
    identity_file: "~/.ssh/production_key"

  - name: "staging-server"
    hostname: "staging.example.com"
    user: "ubuntu"
    port: 22
    # No identity_file specified - will use SSH default authentication flow
```

### Global Servers

Configure servers globally in `~/.aship/servers.yml`:

```yaml
servers:
  - name: "personal-vps"
    hostname: "vps.example.com"
    user: "root"
    port: 22
    description: "Personal VPS server"
    identity_file: "~/.ssh/personal_key"
```

## Authentication

Aship follows SSH's standard authentication flow, which provides security and simplicity:

1. **SSH Key Authentication (Preferred)**
   - If `identity_file` is specified, that key is tried first
   - If not specified, SSH tries default keys (`~/.ssh/id_rsa`, `~/.ssh/id_ed25519`, etc.)
   - SSH agent keys are also tried automatically

2. **Password Authentication (Fallback)**
   - If key authentication fails, Aship will prompt for a password
   - Passwords are never stored in configuration files for security

### Specify a Custom SSH Key

```yaml
servers:
  - name: "my-server"
    hostname: "example.com"
    user: "deploy"
    identity_file: "~/.ssh/custom_key"  # Optional: specify custom key
```

### Use Default SSH Authentication

```yaml
servers:
  - name: "my-server"
    hostname: "example.com"
    user: "deploy"
    # No identity_file specified - uses SSH default authentication flow
```

## Server Fields Reference

### Required Fields

- **name** (string): Unique server identifier
- **hostname** (string): Server hostname or IP address
- **user** (string): SSH username

### Optional Fields

- **port** (number): SSH port (default: 22)
- **identity_file** (string): Path to SSH private key (optional)
- **description** (string): Human-readable description
- **tags** (array): Server tags for grouping and filtering
- **variables** (object): Server-specific variables passed to Ansible

## Connection History

Aship automatically maintains connection history in `~/.aship/connection-history.json`:

```json
[
  {
    "host": "prod.example.com",
    "user": "deploy",
    "port": 22,
    "lastUsed": 1705312200000,
    "count": 5
  }
]
```

**Management Commands:**
```bash
# Clear connection history
aship cache clear connections

# List cache status
aship cache list
```

## Server Management Commands

### Add Server Interactively

```bash
aship server add
```

### List Configured Servers

```bash
aship server list
```

### Test Server Connection

```bash
aship server test server-name
```

### Remove Server

```bash
aship server remove server-name
```

## Inventory Integration

Aship can use existing Ansible inventory files:

```bash
# Use specific inventory file
aship deploy -i inventory/production.ini

# Use inventory directory
aship deploy -i inventory/
```

**Supported Inventory Formats:**
- INI format
- YAML format
- Dynamic inventory scripts

## Security Best Practices

### SSH Key Management

1. **Use SSH keys instead of passwords** when possible
2. **Store keys securely** with proper file permissions (600)
3. **Use SSH agent** for key management
4. **Rotate keys regularly**

### Password Security

1. **Avoid storing passwords in plain text**
2. **Use environment variables** for sensitive data
3. **Consider using SSH keys** instead
4. **Use secure password managers**

### Network Security

1. **Use non-standard SSH ports** when possible
2. **Configure firewall rules** appropriately
3. **Enable SSH key-only authentication**
4. **Disable root login** when possible

## Troubleshooting

### Connection Issues

```bash
# Test SSH connection manually
ssh user@hostname -p port

# Check SSH configuration
ssh -v user@hostname

# Test with Aship
aship server test server-name
```

### Authentication Problems

```bash
# Check SSH key permissions
ls -la ~/.ssh/

# Test SSH agent
ssh-add -l

# Add key to agent
ssh-add ~/.ssh/your_key
```

### Common Error Solutions

**"Permission denied (publickey)"**
- Check SSH key path and permissions
- Verify key is added to SSH agent
- Confirm public key is in server's authorized_keys

**"Connection refused"**
- Verify server is running and accessible
- Check port number and firewall rules
- Test network connectivity

**"Host key verification failed"**
- Add host to known_hosts: `ssh-keyscan hostname >> ~/.ssh/known_hosts`
- Or disable host key checking (less secure)

## Examples

### Development Environment

```yaml
servers:
  - name: "dev-vm"
    hostname: "192.168.1.100"
    user: "vagrant"
    port: 2222
    description: "Local development VM"
    tags: ["development", "local"]
    identity_file: "~/.vagrant.d/insecure_private_key"
```

### Production Environment

```yaml
servers:
  - name: "prod-web-1"
    hostname: "web1.prod.example.com"
    user: "deploy"
    port: 22
    description: "Production web server #1"
    tags: ["production", "web"]
    variables:
      environment: "production"
      server_role: "web"
      backup_enabled: true
    identity_file: "~/.ssh/production_deploy_key"

  - name: "prod-db-1"
    hostname: "db1.prod.example.com"
    user: "deploy"
    port: 22
    description: "Production database server"
    tags: ["production", "database"]
    variables:
      environment: "production"
      server_role: "database"
      backup_enabled: true
    identity_file: "~/.ssh/production_deploy_key"
```

This server configuration system provides flexible and secure server management while maintaining simplicity for common use cases.
