# Contributing to aship

We welcome contributions to aship! This document provides guidelines for contributing to the project.

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18.0.0 or higher
- **pnpm** (recommended package manager)
- **Git** for version control
- **Ansible** for testing functionality

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/aship.git
   cd aship
   ```

2. **Quick Setup (Recommended)**
   ```bash
   # One command does everything: install + build + link + test
   pnpm dev:setup
   ```

   **Or step by step:**

3. **Install Dependencies**
   ```bash
   pnpm install
   ```

4. **Build the Project**
   ```bash
   pnpm build
   ```

5. **Link for Local Development**
   ```bash
   pnpm dev:link
   ```

6. **Verify Installation**
   ```bash
   aship --version
   ```

## 🏗️ Project Structure

This is a monorepo with the following packages:

```
packages/
├── core/          # Core library (@aship/core)
├── cli/           # CLI implementation (@aship/cli)
└── aship/         # Main user package (aship)
```

### Package Responsibilities

- **@aship/core**: Core business logic, APIs, and utilities
- **@aship/cli**: OCLIF-based CLI implementation
- **aship**: Main user-facing package that wraps @aship/cli

## 🔧 Development Workflow

### 🚀 Quick Development Scripts

For efficient development, use these one-command scripts:

```bash
# Complete development setup (install + build + link + test)
pnpm dev:setup

# Reset development environment (clean + setup)
pnpm dev:reset

# Quick code check (fix + test)
pnpm dev:check

# Link/unlink for testing
pnpm dev:link            # build + link globally
pnpm dev:unlink          # unlink from global
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in development mode
pnpm test:dev

# Run tests with coverage
pnpm test:coverage
```

### Code Quality

```bash
# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Fix all issues (lint + format)
pnpm fix
```

### Building

```bash
# Build all packages
pnpm build

# Build sequentially (for dependency order)
pnpm build:sequential

# Clean build artifacts
pnpm clean
```

## 📝 Coding Standards

### TypeScript Guidelines

- Use strict TypeScript configuration
- Prefer explicit types over `any`
- Use proper JSDoc comments for public APIs
- Follow existing naming conventions

### Code Style

- Use Biome for formatting and linting
- Follow existing patterns in the codebase
- Write descriptive commit messages
- Keep functions focused and small

### Testing

- Write unit tests for new functionality
- Use integration tests for complex workflows
- Mock external dependencies appropriately
- Ensure tests are deterministic and fast

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Environment Information**
   - Node.js version
   - Operating system
   - aship version

2. **Steps to Reproduce**
   - Clear, numbered steps
   - Expected vs actual behavior
   - Any error messages

3. **Additional Context**
   - Relevant configuration files
   - Log output (with sensitive data removed)

## ✨ Feature Requests

For new features:

1. **Check Existing Issues** - Avoid duplicates
2. **Describe the Problem** - What need does this address?
3. **Propose a Solution** - How should it work?
4. **Consider Alternatives** - What other approaches exist?

## 🔄 Pull Request Process

### Before Submitting

1. **Create an Issue** - Discuss the change first
2. **Fork the Repository** - Work in your own fork
3. **Create a Feature Branch** - Use descriptive names
4. **Write Tests** - Ensure good coverage
5. **Update Documentation** - Keep docs current

### PR Guidelines

1. **Clear Description** - Explain what and why
2. **Link Issues** - Reference related issues
3. **Small, Focused Changes** - One feature per PR
4. **Pass All Checks** - Tests, linting, etc.

### Review Process

- Maintainers will review PRs promptly
- Address feedback constructively
- Be patient during the review process
- PRs require approval before merging

## 📚 Documentation

### Writing Documentation

- Use clear, concise language
- Include practical examples
- Follow existing formatting patterns
- Test all code examples

### Documentation Types

- **User Documentation**: packages/aship/README.md
- **API Documentation**: packages/core/README.md
- **Technical Documentation**: packages/cli/README.md
- **Examples**: examples/ directory

## 🏷️ Release Process

Releases are managed by maintainers:

1. **Version Bumping** - Using conventional commits
2. **Changelog Generation** - Automated from commits
3. **Package Publishing** - To npm registry
4. **Git Tagging** - Version tags created

### Commit Message Format

Follow conventional commits:

```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## 🤝 Community Guidelines

### Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Maintain a professional tone

### Getting Help

- **GitHub Issues** - For bugs and features
- **GitHub Discussions** - For questions and ideas
- **Documentation** - Check existing docs first

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🙏 Recognition

Contributors are recognized in:
- Release notes
- Project documentation
- GitHub contributor graphs

Thank you for contributing to aship! 🚀
