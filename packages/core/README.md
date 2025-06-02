# @aship/core

[![npm version](https://badge.fury.io/js/@aship/core.svg)](https://badge.fury.io/js/@aship/core)

Core library for Aship, providing APIs and utilities for Ansible management, SSH connections, and configuration handling.

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

```bash
# Install as dependency
npm install @aship/core

# Or using pnpm
pnpm add @aship/core
```

## 🔧 API Usage

### Configuration Management

```typescript
import { ConfigManager, RuntimeConfigManager } from '@aship/core';

// Load project configuration
const configManager = new ConfigManager('/path/to/project');
const config = await configManager.loadConfig();

// Manage runtime configuration (servers, cache)
const runtimeManager = new RuntimeConfigManager('/path/to/project');
const servers = await runtimeManager.loadServers();
```

### Ansible Execution

```typescript
import { AnsibleExecutor } from '@aship/core';

// Execute an Ansible playbook
const executor = new AnsibleExecutor();
const result = await executor.executePlaybook({
  playbook: 'playbooks/deploy.yml',
  inventory: 'inventory/hosts.yml',
  extraVars: {
    environment: 'production',
    version: '1.2.3'
  },
  tags: ['web', 'database'],
  verbose: true
});

// Execute Ansible modules directly
const moduleResult = await executor.executeModule({
  module: 'shell',
  args: 'uptime',
  inventory: 'localhost,',
  connection: 'local'
});
```

### Server Management

```typescript
import { ServerManager, GlobalServerManager } from '@aship/core';

// Project-specific server management
const serverManager = new ServerManager('/path/to/project');
const servers = await serverManager.getServers();

// Global server management
const globalManager = new GlobalServerManager();
await globalManager.addServer({
  name: 'production-web',
  hostname: 'prod.example.com',
  user: 'deploy',
  port: 22,
  description: 'Production web server'
});
```

### SSH Connection Management

```typescript
import { testConnection, connectToServer } from '@aship/core';

// Test SSH connection
const result = await testConnection({
  hostname: 'example.com',
  user: 'deploy',
  port: 22,
  identity_file: '~/.ssh/id_rsa'
});

// Establish SSH connection with automatic authentication
const connection = await connectToServer({
  hostname: 'example.com',
  user: 'deploy',
  port: 22
});
```

### Schema Validation

```typescript
import {
  AshipConfigSchema,
  ServersConfigSchema,
  ServerConfigSchema
} from '@aship/core';

// Validate project configuration
const config = AshipConfigSchema.parse(configData);

// Validate server configuration
const servers = ServersConfigSchema.parse(serversData);

// Validate individual server
const server = ServerConfigSchema.parse(serverData);
```

## 📖 Documentation

### 📚 User Documentation
- **[Getting Started](../../docs/01-GETTING-STARTED.md)** - Installation and quick start guide
- **[Configuration Reference](../../docs/02-CONFIGURATION.md)** - Complete configuration documentation
- **[Server Configuration](../../docs/03-SERVER-CONFIGURATION.md)** - Server management guide
- **[Examples](../../docs/05-EXAMPLES.md)** - Real-world usage examples
- **[Troubleshooting](../../docs/06-TROUBLESHOOTING.md)** - Common issues and solutions

### 🏗️ Developer Documentation
- **[CLI Package](../cli/README.md)** - Command-line interface implementation
- **[Main Package](../aship/README.md)** - Main CLI package

### 💡 Examples
- **[Getting Started Example](../../examples/getting-started/)** - Core functionality demonstration
- **[Single Playbook Example](../../examples/single-playbook/)** - Simple core usage

## 🔗 Dependencies

This package depends on:
- **[zod](https://www.npmjs.com/package/zod)** - Schema validation
- **[js-yaml](https://www.npmjs.com/package/js-yaml)** - YAML parsing and serialization
- **[node-ssh](https://www.npmjs.com/package/node-ssh)** - SSH client functionality
- **[execa](https://www.npmjs.com/package/execa)** - Process execution
- **[chalk](https://www.npmjs.com/package/chalk)** - Terminal styling

## 🧪 Testing

```bash
# Run core tests
pnpm test:core

# Run specific test categories
pnpm test packages/core/tests/unit/
pnpm test packages/core/tests/integration/

# Run with coverage
pnpm test:coverage
```

## 🛠️ Development

### Project Structure
```
packages/core/
├── src/
│   ├── ansible/          # Ansible integration
│   │   ├── executor.ts   # Playbook execution
│   │   └── inventory.ts  # Inventory management
│   ├── config/           # Configuration management
│   │   ├── manager.ts    # Project configuration
│   │   └── runtime-config-manager.ts
│   ├── schemas/          # Zod validation schemas
│   │   ├── aship-config.ts
│   │   └── servers-config.ts
│   ├── server/           # Server management
│   │   ├── manager.ts    # Project servers
│   │   └── global-manager.ts
│   ├── ssh/              # SSH functionality
│   │   ├── connection.ts # Connection handling
│   │   └── permissions.ts
│   └── utils/            # Utility functions
├── tests/                # Test files
│   ├── unit/            # Unit tests
│   ├── integration/     # Integration tests
│   └── fixtures/        # Test fixtures
└── README.md            # This file
```

### Key Components

- **Ansible**: Playbook execution and module management
- **Config**: Project and runtime configuration handling
- **Schemas**: Zod-based validation for all data structures
- **Server**: Server configuration and management
- **SSH**: Connection handling and authentication
- **Utils**: Shared utility functions and helpers

## 🔌 Extensibility

The core package is designed to be extensible:

```typescript
// Custom configuration manager
class CustomConfigManager extends ConfigManager {
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

## 📄 License

MIT License - see [LICENSE](../../LICENSE) for details.
