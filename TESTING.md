# Testing Guide

This document describes how to run tests for HomeScreen Hero.

## Backend Tests (Python/pytest)

### Setup

1. Install test dependencies:
   ```bash
   pip install -r homescreen_hero/requirements.txt
   pip install -r homescreen_hero/requirements-dev.txt
   ```

### Running Tests

From the project root directory:

```bash
# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test file
pytest tests/test_rotation.py

# Run specific test class or function
pytest tests/test_rotation.py::TestPassesGapRule
pytest tests/test_rotation.py::TestPassesGapRule::test_gap_requirement_met

# Run with coverage report
pytest --cov=homescreen_hero --cov-report=html

# Run tests in parallel (requires pytest-xdist)
pytest -n auto
```

### Test Structure

- `tests/` - All test files
- `tests/conftest.py` - Shared fixtures and configuration
- `tests/test_rotation.py` - Tests for rotation logic
- `tests/test_config.py` - Tests for configuration schema

### Coverage Reports

After running with `--cov-report=html`, open `htmlcov/index.html` in your browser to view detailed coverage.

## Frontend Tests (Vitest/React Testing Library)

### Setup

1. Navigate to frontend directory:
   ```bash
   cd homescreen-hero-ui
   ```

2. Install dependencies (if not already installed):
   ```bash
   npm install
   ```

### Running Tests

```bash
# Run tests in watch mode (interactive)
npm test

# Run tests once and exit
npm run test:run

# Run tests with UI interface
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Test Structure

- `src/components/__tests__/` - Component tests
- `src/test/setup.ts` - Test setup and global configuration

### Writing Tests

Component tests use React Testing Library:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

## Continuous Integration

Tests should be run in CI/CD pipeline before merging. Example GitHub Actions workflow:

```yaml
- name: Run backend tests
  run: |
    pip install -r homescreen_hero/requirements.txt
    pip install -r homescreen_hero/requirements-dev.txt
    pytest

- name: Run frontend tests
  run: |
    cd homescreen-hero-ui
    npm install
    npm run test:run
```

## Test Coverage Goals

- **Backend**: Aim for >80% coverage on core modules (rotation, config, integrations)
- **Frontend**: Aim for >70% coverage on components and utilities

## Adding New Tests

When adding new features:

1. **Backend**: Add tests in `tests/test_<module>.py`
2. **Frontend**: Add tests in `src/components/__tests__/<Component>.test.tsx`
3. Ensure all edge cases are covered
4. Update this documentation if adding new test patterns

## Troubleshooting

### Backend

**Import errors**: Ensure you're running pytest from the project root and homescreen_hero is in your Python path.

**Database errors**: Tests use in-memory SQLite by default. If you see DB errors, check fixture setup in conftest.py.

### Frontend

**Module not found**: Make sure all dependencies are installed with `npm install`

**Test timeout**: Increase timeout in vite.config.ts:
```typescript
test: {
  testTimeout: 10000, // 10 seconds
}
```

**jsdom errors**: Ensure jsdom is installed and environment is set to 'jsdom' in vite.config.ts
