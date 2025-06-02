# Aship Tests

This directory contains tests for the Aship project. The tests are organized by type:

## Test Types

- **Unit Tests** (`tests/unit/`): Tests for individual functions and classes in isolation. These tests should be fast and not depend on external resources.
- **Integration Tests** (`tests/integration/`): Tests that verify how different parts of the system work together. These tests may use the file system and other local resources.
- **Manual Tests** (`tests/manual/`): Tests that require special setup or external resources (like SSH servers). These tests are meant to be run manually, not as part of automated testing.

## Test Helpers

The `tests/helpers/` directory contains utility functions and classes to help with testing:

- `fs-helper.ts`: Utilities for managing temporary directories and files in tests.

## Running Tests

- Run all tests: `npm test`
- Run unit tests only: `npx vitest run tests/unit`
- Run integration tests only: `npx vitest run tests/integration`
- Run manual tests: `npx vitest run tests/manual` (requires manual setup)

## Best Practices

1. **Unit Tests**:
   - Should be fast and isolated
   - Should not depend on external resources
   - Use mocks sparingly, only when necessary

2. **Integration Tests**:
   - Can use the file system and other local resources
   - Should clean up after themselves
   - Use the `TestFileSystem` class to manage temporary files and directories

3. **Manual Tests**:
   - Should include clear instructions for setup
   - Should be well-documented
   - Should be run manually before releases
