# Troubleshooting

Common issues and solutions when using Aship.

## Installation Issues

### Node.js Version Compatibility

**Problem:** Aship fails to install or run with older Node.js versions.

**Solution:**
```bash
# Check Node.js version
node --version

# Aship requires Node.js 18.0.0 or higher
# Update Node.js using nvm (recommended)
nvm install 18
nvm use 18

# Or download from nodejs.org
```

### Permission Errors During Installation

**Problem:** `EACCES` permission errors when installing globally.

**Solution:**
```bash
# Option 1: Use npx (recommended)
npx aship --version

# Option 2: Fix npm permissions
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH

# Option 3: Use sudo (not recommended)
sudo npm install -g aship
```

## Configuration Issues

### Invalid YAML Syntax

**Problem:** `aship.yml` fails to parse due to syntax errors.

**Symptoms:**
```
Error: Invalid YAML syntax in aship.yml
```

**Solution:**
```bash
# Validate YAML syntax
python -c "import yaml; yaml.safe_load(open('aship.yml'))"

# Or use online YAML validator
# Common issues:
# - Incorrect indentation (use spaces, not tabs)
# - Missing quotes around special characters
# - Inconsistent list formatting
```

**Example Fix:**
```yaml
# Wrong
vars:
  environment:
    type: choice
    choices: [dev, staging, prod]  # Missing quotes

# Correct
vars:
  environment:
    type: choice
    choices: ["dev", "staging", "prod"]
```

### Playbook Not Found

**Problem:** Aship cannot find the specified playbook file.

**Symptoms:**
```
Error: Playbook not found: playbooks/deploy.yml
```

**Solution:**
```bash
# Check file exists
ls -la playbooks/deploy.yml

# Verify path in aship.yml is correct
# Paths are relative to aship.yml location
```

### Variable Validation Errors

**Problem:** Variable definitions have invalid configurations.

**Common Issues:**
- Invalid variable types
- Missing required fields
- Invalid choice values

**Solution:**
```yaml
# Check variable type is valid
vars:
  environment:
    type: choice  # Valid: string, number, bool, choice, multiselect, password, list
    choices: ["dev", "prod"]
    default: "dev"  # Must be in choices array
    required: true  # Boolean value
```

## Connection Issues

### SSH Connection Failures

**Problem:** Cannot connect to target servers.

**Symptoms:**
```
Error: Connection failed to user@host:22
Permission denied (publickey,password)
```

**Diagnosis:**
```bash
# Test SSH connection manually
ssh user@host

# Check SSH key permissions
ls -la ~/.ssh/
chmod 600 ~/.ssh/id_rsa
chmod 644 ~/.ssh/id_rsa.pub

# Verify SSH agent
ssh-add -l
ssh-add ~/.ssh/id_rsa
```

**Solutions:**

1. **SSH Key Issues:**
```bash
# Generate new SSH key if needed
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"

# Copy public key to server
ssh-copy-id user@host

# Or manually add to authorized_keys
cat ~/.ssh/id_rsa.pub | ssh user@host "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

2. **Password Authentication:**
```yaml
# In .aship/servers.yml
servers:
  - name: "server-1"
    hostname: "192.168.1.10"
    user: "deploy"
    port: 22
    description: "Server 1"
    # Note: Password authentication is handled interactively
    # or through SSH agent/key files
```

3. **SSH Agent Authentication:**
```bash
# Start SSH agent
eval $(ssh-agent)
ssh-add ~/.ssh/id_rsa

# SSH agent authentication is used automatically
# when no identity_file is specified
```

### Host Key Verification Failed

**Problem:** SSH host key verification failures.

**Symptoms:**
```
Host key verification failed
```

**Solutions:**

1. **Add host to known_hosts:**
```bash
ssh-keyscan -H hostname >> ~/.ssh/known_hosts
```

2. **Disable host key checking (less secure):**
```bash
export ANSIBLE_HOST_KEY_CHECKING=False
```

3. **Configure in ansible.cfg:**
```ini
[defaults]
host_key_checking = False
```

### Network Connectivity Issues

**Problem:** Cannot reach target servers.

**Diagnosis:**
```bash
# Test network connectivity
ping hostname
telnet hostname 22
nmap -p 22 hostname

# Check DNS resolution
nslookup hostname
dig hostname
```

**Solutions:**
- Verify server is running and accessible
- Check firewall rules
- Verify network configuration
- Use IP address instead of hostname

## Ansible Issues

### Ansible Not Found

**Problem:** Aship cannot find Ansible installation.

**Symptoms:**
```
Error: ansible-playbook command not found
```

**Solution:**
```bash
# Install Ansible
pip install ansible

# Or using package manager
# Ubuntu/Debian
sudo apt update
sudo apt install ansible

# macOS
brew install ansible

# Verify installation
ansible --version
ansible-playbook --version
```

### Ansible Configuration Issues

**Problem:** Ansible configuration conflicts or errors.

**Solutions:**

1. **Check Ansible configuration:**
```bash
ansible-config dump
ansible-config view
```

2. **Use custom ansible.cfg:**
```ini
[defaults]
inventory = inventory/hosts
remote_user = deploy
private_key_file = ~/.ssh/id_rsa
host_key_checking = False
timeout = 30

[ssh_connection]
ssh_args = -o ControlMaster=auto -o ControlPersist=60s
pipelining = True
```

3. **Override with environment variables:**
```bash
export ANSIBLE_CONFIG=/path/to/ansible.cfg
export ANSIBLE_INVENTORY=/path/to/inventory
export ANSIBLE_REMOTE_USER=deploy
```

### Privilege Escalation Issues

**Problem:** Cannot run commands with sudo.

**Symptoms:**
```
sudo: a password is required
```

**Solutions:**

1. **Configure passwordless sudo:**
```bash
# On target server
sudo visudo
# Add: deploy ALL=(ALL) NOPASSWD:ALL
```

2. **Use become password:**
```bash
aship deploy --ask-become-pass
```

3. **Set become password in configuration:**
```yaml
# In server configuration
servers:
  - name: "server-1"
    hostname: "192.168.1.10"
    user: "deploy"
    port: 22
    description: "Server 1"
    # Note: become_password is handled interactively
    # Use --ask-become-pass for sudo password prompts
```

## Performance Issues

### Slow Execution

**Problem:** Aship/Ansible execution is very slow.

**Solutions:**

1. **Enable SSH pipelining:**
```ini
[ssh_connection]
pipelining = True
```

2. **Use SSH connection multiplexing:**
```ini
[ssh_connection]
ssh_args = -o ControlMaster=auto -o ControlPersist=60s
```

3. **Reduce gathering facts:**
```yaml
# In playbook
- hosts: all
  gather_facts: no  # Skip if not needed
```

4. **Use parallel execution:**
```bash
aship deploy --forks 10
```

### Memory Issues

**Problem:** High memory usage during execution.

**Solutions:**
- Reduce batch sizes in rolling updates
- Use streaming for large file transfers
- Limit concurrent connections

## Debug and Logging

### Enable Debug Output

```bash
# Enable debug mode
aship deploy --debug

# Enable verbose Ansible output
aship deploy --verbose

# Multiple verbosity levels
aship deploy -vvv
```

### Check Log Files

```bash
# Aship logs (if configured)
tail -f ~/.aship/logs/aship.log

# System logs
journalctl -u ssh
tail -f /var/log/auth.log
```

### Environment Variables for Debugging

```bash
# Enable debug output
export DEBUG=aship:*
export ANSOR_LOG_LEVEL=debug

# Ansible debugging
export ANSIBLE_DEBUG=1
export ANSIBLE_VERBOSITY=3
```

## Common Error Messages

### "Failed to load connections: Unexpected end of JSON input"

**Cause:** Corrupted connection history file.

**Solution:**
```bash
# Remove corrupted file
rm ~/.aship/connection-history.json

# Or clear all cache
aship cache clear connections
```

### "Variable configuration from playbook is not implemented yet"

**Cause:** This is an informational message, not an error.

**Solution:** This message indicates Aship is using manual variable configuration instead of automatic playbook parsing. This is the intended behavior.

### "No playbook specified and no default found"

**Cause:** No playbook argument provided and multiple playbooks defined.

**Solution:**
```bash
# Specify playbook name
aship deploy

# Or define only one playbook in aship.yml for auto-selection
```

## Getting Help

### Enable Verbose Output

```bash
aship deploy --verbose --debug
```

### Check Configuration

```bash
# Check if configuration file exists and is valid
cat aship.yml

# List configured servers
aship server list

# List cache status
aship cache list
```

### Community Support

- **GitHub Issues**: [Report bugs](https://github.com/teomyth/aship/issues)
- **Discussions**: [Community help](https://github.com/teomyth/aship/discussions)
- **Documentation**: [Full documentation](https://github.com/teomyth/aship/docs)

### Collecting Debug Information

When reporting issues, include:

1. **Version information:**
```bash
aship --version
ansible --version
node --version
```

2. **Configuration files:**
- `aship.yml` (remove sensitive data)
- `.aship/servers.yml` (remove passwords)

3. **Error output:**
```bash
aship deploy --debug --verbose 2>&1 | tee debug.log
```

4. **Environment information:**
- Operating system
- Network configuration
- SSH setup
