# aship

**aship** is a zero-config Ansible tool for simplified deployments and flexible host management.

## 🎯 Project Overview

This monorepo contains tools that make Ansible deployment simple and interactive:

- **Interactive playbook execution** with smart prompts
- **Flexible host management** with multiple data sources
- **Rich variable types** with validation
- **Tag-based execution** with predefined groups

## 📦 Published Packages

### Main Tools
- **[aship](https://www.npmjs.com/package/aship)** - Main CLI tool for end users
- **[@aship/cli](https://www.npmjs.com/package/@aship/cli)** - CLI implementation package

### Libraries
- **[@aship/core](https://www.npmjs.com/package/@aship/core)** - Core library for developers

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.0.0 or higher
- **Ansible** installed and accessible in your PATH

### Install and Use

```bash
# Install the main tool
npm install -g aship

# Or using pnpm
pnpm add -g aship

# Initialize a project
mkdir my-project && cd my-project
aship init

# Run a playbook
aship deploy
```

## 📖 Documentation

For detailed usage, configuration, and examples, see the individual package documentation:

- **[aship](./packages/aship/README.md)** - Complete user guide and command reference
- **[@aship/cli](./packages/cli/README.md)** - Technical CLI implementation details
- **[@aship/core](./packages/core/README.md)** - API documentation for developers

## 💡 Examples

- **[Getting Started Example](./examples/getting-started/)** - Comprehensive feature demonstration
- **[Single Playbook Example](./examples/single-playbook/)** - Simple single-playbook setup
- **[Example Projects Overview](./examples/README.md)** - All available examples

## �️ Development

This is a monorepo containing multiple packages. For development setup:

### 🚀 Quick Development Setup

```bash
# Clone the repository
git clone https://github.com/teomyth/aship.git
cd aship

# One-command setup (install + build + link + test)
pnpm dev:setup
```

### 📋 Individual Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Link for local development
pnpm dev:link
```

### 🔧 Development Scripts

```bash
# Complete development setup
pnpm dev:setup          # install + build + link + test

# Reset development environment
pnpm dev:reset           # clean + dev:setup

# Quick code check
pnpm dev:check           # fix + test

# Link/unlink for testing
pnpm dev:link            # build + link globally
pnpm dev:unlink          # unlink from global
```

### Package Structure
- **packages/core** - Core functionality library
- **packages/cli** - CLI implementation
- **packages/aship** - Main user-facing package
- **examples/** - Example projects and tutorials

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](./CONTRIBUTING.md) for details.

## �📄 License

MIT License - see [LICENSE](./LICENSE) for details.

---

**Made with ❤️ by the aship team**
