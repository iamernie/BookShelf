# Contributing to BookShelf

Thank you for your interest in contributing to BookShelf V2!

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- Git

### Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/BookShelfV2.git
   cd BookShelfV2
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Visit** http://localhost:5173

## Development Standards

See [DEVELOPMENT.md](DEVELOPMENT.md) for detailed coding standards, patterns, and architecture guidelines.

## Git Workflow

### Branching Strategy

- `main` - Production-ready code
- `feature/feature-name` - New features
- `fix/bug-description` - Bug fixes
- `refactor/what-changed` - Code refactoring

### Commit Messages

We use conventional commits:

```
feat: add audiobook playback support
fix: resolve book search pagination issue
refactor: simplify book card component
docs: update deployment guide
chore: update dependencies
```

### Pull Request Process

1. **Fork the repository** and create your branch from `main`
2. **Make your changes** following the coding standards
3. **Test your changes** thoroughly
4. **Update documentation** if needed
5. **Submit a pull request** with:
   - Clear title and description
   - Reference to related issues
   - Screenshots for UI changes

## Code Review

- PRs require at least one approval
- Address feedback constructively
- Keep PRs focused and reasonably sized

## Reporting Issues

### Bug Reports

Include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment (OS, browser, BookShelf version)
- Screenshots if applicable

### Feature Requests

Include:
- Clear description of the feature
- Use case and benefits
- Mockups or examples if available

## Code of Conduct

Be respectful, inclusive, and constructive. We're all here to build something great together.

## Questions?

- Open a discussion on GitHub
- Check existing issues and documentation

---

**Happy contributing!** 🚀
