# Contributing to HyperX Terminal

Thank you for your interest in contributing to HyperX Terminal! This document provides guidelines and best practices for contributing to this high-performance trading interface.

## 🚀 Quick Start

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/new-terminal-hyperx.git`
3. Install dependencies: `pnpm install`
4. Create a branch: `git checkout -b feature/your-feature-name`
5. Make your changes
6. Run tests: `pnpm test`
7. Commit: `git commit -m "feat: add your feature"`
8. Push: `git push origin feature/your-feature-name`
9. Open a Pull Request

## 📋 Development Setup

### Prerequisites

- Node.js >= 22.0.0
- pnpm >= 10.0.0
- PostgreSQL >= 14
- Git

### Environment Setup

```bash
# Copy environment files
cp .env.example .env
cp apps/web/.env.example apps/web/.env  # if exists

# Set up database
pnpm prisma:migrate

# Start development
pnpm dev
```

## 🏗️ Project Structure

```
new-terminal-hyperx/
├── apps/
│   ├── web/          # Frontend (React + Vite)
│   ├── api/          # Backend API (Fastify)
│   └── ws/           # WebSocket server
├── packages/
│   └── types/        # Shared TypeScript types
└── docs/             # Documentation
```

## 📝 Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, semicolons, etc)
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `test:` - Adding or updating tests
- `chore:` - Build process or auxiliary tool changes

Examples:
```
feat: add real-time orderbook updates
fix: resolve WebSocket reconnection issue
docs: update API documentation for trades
perf: optimize chart rendering with virtual scrolling
```

## 🎨 Code Style

### TypeScript

- Use strict TypeScript settings
- Prefer `interface` over `type` for object shapes
- Use explicit return types on public functions
- Avoid `any` - use `unknown` with type guards

### React

- Use functional components with hooks
- Prefer composition over inheritance
- Use Zustand for global state
- Use TanStack Query for server state

### CSS/Tailwind

- Use Tailwind utility classes
- Follow mobile-first responsive design
- Use CSS variables for theme colors
- Maintain consistent spacing (multiples of 4px)

## 🔍 Code Review Process

1. All changes require a Pull Request
2. PRs must pass CI checks (lint, typecheck, tests)
3. At least one approval from a maintainer required
4. Address review feedback promptly
5. Keep PRs focused and reasonably sized

## 🧪 Testing

### Unit Tests

```bash
# Run all tests
pnpm test

# Run specific package
pnpm test:web
pnpm test:api

# Run with coverage
pnpm test:coverage
```

### Test Guidelines

- Test business logic, not implementation details
- Mock external services (APIs, WebSockets)
- Use meaningful test descriptions
- Follow Arrange-Act-Assert pattern

## 🎯 Performance Guidelines

As a high-performance trading terminal, we have strict performance requirements:

### Rendering

- Use `React.memo` for pure components receiving frequent updates
- Use `useMemo` for expensive calculations
- Use `useCallback` for functions passed to optimized children
- Implement virtual scrolling for large lists (>100 items)

### State Management

- Keep global state minimal
- Use local state when possible
- Batch state updates
- Avoid prop drilling with composition

### WebSocket Data

- Throttle high-frequency updates (orderbook, trades)
- Use requestAnimationFrame for visual updates
- Implement backpressure handling
- Buffer and batch updates

## 🔐 Security

- Never commit secrets or API keys
- Use environment variables for configuration
- Validate all user inputs with Zod
- Sanitize data before rendering
- Follow OWASP guidelines

## 📚 Documentation

- Update README.md for user-facing changes
- Update docs/ for architecture changes
- Add JSDoc comments for public APIs
- Include code examples where helpful

## 🐛 Reporting Bugs

When reporting bugs, please include:

1. Clear description of the issue
2. Steps to reproduce
3. Expected vs actual behavior
4. Screenshots (if applicable)
5. Environment details (OS, browser, Node version)
6. Console errors or stack traces

## 💡 Feature Requests

We welcome feature requests! Please:

1. Check existing issues first
2. Describe the use case clearly
3. Explain why it benefits users
4. Consider implementation complexity

## 🏆 Recognition

Contributors will be:
- Listed in README.md acknowledgments
- Mentioned in release notes
- Invited to contributor Discord channel

## 📞 Questions?

- Discord: [Join our server](https://discord.gg/hyperx)
- Email: dev@hyperx.io
- Open a GitHub Discussion

## ⚖️ License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for helping make HyperX Terminal better!**
