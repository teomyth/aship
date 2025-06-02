# Getting Started with aship

This is a simple demonstration project that showcases aship's core features through two focused examples.

## What This Example Demonstrates

### 🎯 Core aship Features
- **Variable Collection**: Interactive configuration with validation
- **Tag-Based Execution**: Run specific parts of your playbook
- **Clear Output**: See exactly what aship is doing
- **Simple Integration**: Works seamlessly with Ansible

### 📋 Variable Types Showcased
- **String**: `app_name`, `ssh_key_source`, `project_name` - Text input with validation
- **Choice**: `environment` - Select from predefined options
- **Integer**: `port`, `ssh_port` - Number input with min/max validation
- **Boolean**: `enable_ssl` - True/false toggle
- **List**: `services` - Multiple text values
- **Multi-select**: `frameworks` - Choose multiple from options
- **Password**: `admin_password` - Secure masked input

### 🏷️ Tag Functionality
- **info**: Display application information and variables
- **setup**: Setup application environment
- **deploy**: Deploy application services
- **test**: Run application tests

**Default tags**: `info` and `setup` are selected automatically

## Available Playbooks

### 1. `demo` - Complete Feature Demonstration
Shows all aship variable types and tag functionality in one comprehensive example.

### 2. `setup-ssh` - SSH Key Management
Demonstrates real-world SSH key import and security configuration.

## Quick Start

1. **Navigate to this directory:**
   ```bash
   cd examples/getting-started
   ```

2. **Run the demo playbook (interactive mode):**
   ```bash
   aship demo
   ```
   This will guide you through:
   - Variable collection with smart defaults
   - Tag selection (or use defaults)
   - Clear execution with immediate feedback

3. **Try the SSH setup playbook:**
   ```bash
   aship setup-ssh
   ```
   This demonstrates real SSH key management functionality.

4. **Try different modes:**
   ```bash
   # Use defaults, skip all prompts
   aship demo -y

   # Skip variable collection
   aship demo -S

   # Run specific tags only
   aship demo --tags info
   aship demo --tags setup,deploy

   # Set variables directly
   aship demo -e "app_name=my-app,port=8080"
   ```

## What You'll See

When you run the demo, aship will:

1. **Collect variables** - Interactive prompts with defaults
2. **Show tag options** - Choose which parts to run
3. **Display execution plan** - See variables and command
4. **Run playbook** - Clear output showing each step
5. **Show results** - Immediate feedback on what happened

### Sample Output
```
📋 Variables collected by aship:

Application Settings:
• App Name: hello-aship
• Environment: development
• Port: 3000
• SSL Enabled: false

Services & Frameworks:
• Services: web, api
• Frameworks: express, react
```

## Understanding the Files

### `aship.yml` - Project Configuration
```yaml
# Two core playbooks demonstrating aship features
playbooks:
  demo: playbooks/demo.yml
  setup-ssh: playbooks/setup-ssh.yml

# Simple variables for demonstration
vars:
  app_name:
    type: string
    description: Application name for deployment
    default: "hello-aship"
    required: true

  ssh_key_source:
    type: string
    description: SSH key source for importing public keys
    default: "gh:your-username"
    required: true
```

### `playbooks/demo.yml` - Demo Playbook
- Uses `debug` tasks to show clear output
- Each tag produces specific, understandable results
- Variables are displayed in a user-friendly format
- No complex operations - just clear demonstrations

### `playbooks/setup-ssh.yml` - SSH Setup Playbook
- Demonstrates real SSH key management functionality
- Shows conditional logic based on key source type
- Simulates actual SSH configuration tasks
- Provides practical automation examples

## Learning Objectives

After running this example, you'll understand:

- ✅ How aship collects and validates variables
- ✅ How tag selection controls execution
- ✅ How variables are passed to Ansible
- ✅ How to structure a simple aship project
- ✅ How different variable types work
- ✅ How to use command-line options

## Experiment and Learn

Try modifying:

1. **Variable defaults** in `aship.yml`
2. **Tag selections** when running
3. **Command-line options** for different behaviors
4. **Playbook tasks** to see different outputs

## Next Steps

1. **Explore other examples** in the parent directory
2. **Create your own aship project** using `aship init`
3. **Read the documentation** for advanced features
4. **Try with real Ansible playbooks** in your projects

---

💡 **Tip**: This example is designed to be safe and educational. All tasks use `debug` to show output without making system changes.

## 📝 Files

- `aship.yml` - Configuration with comprehensive variable examples
- `playbooks/demo.yml` - Complete feature demonstration
- `playbooks/setup-ssh.yml` - SSH key management automation
- `inventory/hosts.yml` - Local host inventory
- `.aship/` - Cache directory (created automatically)

## 🔑 SSH Key Source Examples

Valid formats for the `ssh_key_source` variable:
- `gh:username` or `github:username` - Import from GitHub
- `gl:username` or `gitlab:username` - Import from GitLab
- `lp:username` - Import from Launchpad
- `https://example.com/keys` - Import from direct URL

This demonstrates how aship can handle complex, real-world configuration requirements with clear user guidance.
