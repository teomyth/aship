# Aship Examples

This directory contains example projects that demonstrate different aship features and use cases.

## 📁 Available Examples

### `getting-started/` - Complete Feature Demonstration
A comprehensive getting started project that demonstrates all aship core features including variable collection, caching, and different playbook types.

### `single-playbook/` - Default Playbook Behavior
A minimal project with only one playbook to demonstrate the default playbook auto-selection feature.

## 🚀 Quick Start

```bash
# Enter the getting started project
cd examples/getting-started

# Option 1: Run the quick demo (non-interactive)
./quick-demo.sh

# Option 2: Run the full interactive demo
./demo.sh

# Option 3: Try commands manually
aship hello                    # Simple greeting
aship setup                   # Full variable collection demo
aship deploy                  # Deployment simulation
```

## 🎯 Feature Demonstrations

### 1. Smart Variable Collection
```bash
aship setup                    # Interactive collection of all variables
aship setup --skip-vars        # Skip variable collection
aship setup -y                 # Use defaults, no interaction
```

### 2. Host Data Management
```bash
aship host clear --usage       # Clear host usage history
aship host clear --recent      # Clear recent connection data
aship host clear --all         # Clear all host-related data
```

### 3. Different Run Modes
```bash
aship setup -v                 # Verbose output
aship setup --vv               # More verbose output
aship setup --vvv              # Maximum verbosity
```

## 📋 Demonstrated Variable Types

- **String**: `app_name`
- **Integer**: `app_port`
- **Boolean**: `enable_debug`
- **Choice**: `app_environment`
- **List**: `features`
- **Dict**: `config`
- **Password**: `secret_key`

## 🎮 Learning Path

1. **Basic Usage**: Run `aship hello` for a simple greeting
2. **Variable Collection**: Experience `aship setup` interactive process
3. **Host Management**: Learn `aship host` commands
4. **Advanced Options**: Try different command line options

## 🎬 Demo Scripts

### `quick-demo.sh`
- **Non-interactive demonstration**
- Shows project structure and configuration
- Displays help information
- Lists all available features
- Perfect for getting an overview

### `demo.sh`
- **Full interactive demonstration**
- Guides you through each feature step-by-step
- Includes variable collection, caching, and management
- Provides explanations and pauses between steps
- Best for hands-on learning

## 📝 Notes

This is a pure demonstration project that runs locally and doesn't require real servers. All playbooks use `localhost` with `connection: local` for safe execution.

### What You'll Learn

1. **Variable Collection**: How aship intelligently collects and validates variables
2. **Data Persistence**: How variables are cached and reused across runs
3. **Type System**: Different variable types and their validation
4. **Host Management**: How to view and manage host configurations
5. **Project Structure**: Best practices for organizing aship projects

### Technical Details

- **Server Configuration**: Uses a dummy local server configuration
- **Playbooks**: Simple demonstration playbooks with clear output
- **Variables**: Covers all supported variable types
- **Safety**: All operations are local and safe to run
