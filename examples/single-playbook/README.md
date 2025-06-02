# Single Playbook Example

This example demonstrates the **default playbook auto-selection** feature of aship.

## 🎯 Purpose

When a project has only one playbook defined, aship automatically selects it when you run `aship` without any arguments.

## 📋 Project Structure

```
single-playbook/
├── aship.yml          # Project configuration with one playbook
├── site.yml          # The single playbook file
└── README.md         # This file
```

## 🚀 Usage

### Automatic Selection
```bash
# Enter the example directory
cd examples/single-playbook

# Run without specifying playbook name - it will auto-select 'main'
aship

# This is equivalent to:
aship main
```

### Manual Selection
```bash
# You can still specify the playbook name explicitly
aship main

# Or use the file path directly
aship site.yml
```

## 🔍 What Happens

1. **Auto-detection**: When you run `aship`, the system detects there's only one playbook (`main`)
2. **Auto-selection**: It automatically selects that playbook without prompting
3. **Normal flow**: Proceeds with server selection and variable collection as usual

## 📝 Configuration

The `aship.yml` file contains:
```yaml
name: test-single-playbook
description: Test project with single playbook

# Only one playbook defined
playbooks:
  main: site.yml

vars:
  app_name:
    type: string
    description: Application name
    default: "test-app"
    required: true
```

## 💡 Benefits

- **Simplified workflow**: No need to remember or type playbook names
- **Better UX**: Especially useful for simple projects with one main playbook
- **Consistent behavior**: Works the same whether you have one or multiple playbooks

## 🔄 Comparison

| Project Type | Command | Behavior |
|--------------|---------|----------|
| Single playbook | `aship` | Auto-selects the only playbook |
| Multiple playbooks | `aship` | Prompts to choose from available playbooks |
| Any project | `aship <name>` | Runs the specified playbook |
