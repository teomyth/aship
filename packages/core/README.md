# @aship/core

[![npm version](https://badge.fury.io/js/@aship/core.svg)](https://badge.fury.io/js/@aship/core)

Core library for aship, providing APIs and utilities for Ansible management, SSH connections, and configuration handling.

This package contains the core business logic and can be used independently to build custom Ansible management tools.

## 🏗️ Architecture

This package provides:
- **Configuration Management**: Project and server configuration handling with YAML/JSON support
- **Ansible Integration**: Playbook execution, inventory management, and parameter handling
- **SSH Management**: Connection handling, authentication, and session management
- **Server Management**: Server configuration, connection testing, and permission detection
- **Schema Validation**: Zod-based validation for all configuration formats
- **Utility Functions**: File operations, network connectivity, and retry mechanisms

## 📦 Installation

### Prerequisites

- **Node.js** 18.0.0 or higher

### Install

```bash
# Install as dependency
npm install @aship/core

# Or using pnpm
pnpm add @aship/core
```

## 🔧 API Usage

### Configuration Management

```typescript
import { ConfigurationManager, RuntimeConfigManager } from '@aship/core';

// Load project configuration
const configManager = new ConfigurationManager('/path/to/aship.yml');
const config = await configManager.loadConfig();

// Manage runtime configuration (hosts, cache)
const runtimeManager = new RuntimeConfigManager('/path/to/project');
const servers = await runtimeManager.loadServers();
```

### Ansible Execution

```typescript
import { AnsibleExecutor } from '@aship/core';

// Execute an Ansible playbook
const executor = new AnsibleExecutor();
const result = await executor.executePlaybook({
  servers: [{ hostname: 'example.com', user: 'deploy', port: 22 }],
  playbook: 'playbooks/deploy.yml',
  extraVars: {
    environment: 'production',
    version: '1.2.3'
  },
  ansibleArgs: ['--tags', 'web,database', '--verbose'],
  cwd: '/path/to/project'
});

// Execute Ansible modules directly
const moduleResult = await executor.executeAnsible({
  servers: [{ hostname: 'example.com', user: 'deploy', port: 22 }],
  pattern: 'all',
  module: 'shell',
  args: 'uptime',
  cwd: '/path/to/project'
});
```

### Host Management

```typescript
import { HostManager, DirectoryManager } from '@aship/core';

// Host management
const directoryManager = new DirectoryManager();
const hostManager = new HostManager(directoryManager);

// Add a host
await hostManager.addHost({
  hostname: 'prod.example.com',
  user: 'deploy',
  port: 22,
  description: 'Production web server',
  source: 'manual'
}, 'production-web');

// Get all hosts
const hosts = await hostManager.getHosts();
```

### SSH Connection Management

```typescript
import { testConnectionWithRetry, connectToServer } from '@aship/core';

// Test SSH connection
const result = await testConnectionWithRetry({
  hostname: 'example.com',
  user: 'deploy',
  port: 22,
  identity_file: '~/.ssh/id_rsa'
});

// Establish SSH connection
const connection = await connectToServer({
  hostname: 'example.com',
  user: 'deploy',
  port: 22
});
```

## 📖 Complete Documentation

For comprehensive documentation, examples, and usage patterns:

**📚 [Complete Documentation on GitHub](https://github.com/teomyth/aship)**
- API reference and examples
- Integration guides and patterns
- Development documentation
- Example projects using @aship/core

## 🔗 Related Packages

- **[aship](https://www.npmjs.com/package/aship)** - Main user-facing CLI package
- **[@aship/cli](https://www.npmjs.com/package/@aship/cli)** - CLI implementation package

## 🧪 Testing

```bash
# Run core tests
pnpm test

# Run tests in development mode
pnpm test:dev
```

## 🔌 Extensibility

The core package is designed to be extensible:

```typescript
// Custom configuration manager
class CustomConfigManager extends ConfigurationManager {
  async loadConfig() {
    // Custom configuration loading logic
    return super.loadConfig();
  }
}

// Custom Ansible executor
class CustomAnsibleExecutor extends AnsibleExecutor {
  async executePlaybook(options) {
    // Custom pre-execution logic
    return super.executePlaybook(options);
  }
}
```

## 🤝 Contributing

This package is part of the aship project. Please refer to the [main project documentation](https://github.com/teomyth/aship) for contribution guidelines.

## 📄 License

MIT License - see [LICENSE](https://github.com/teomyth/aship/blob/main/LICENSE) for details.
