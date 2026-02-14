# Contributing to L'Amigo

Thank you for your interest in contributing to L'Amigo! This document provides guidelines and instructions for contributing to the project.

## Development Setup

### Prerequisites
- Node.js 16+ and npm
- Google Chrome browser
- Git

### Getting Started

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/l-amigo.git
   cd l-amigo
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Build the Extension**
   ```bash
   npm run build
   ```

4. **Load in Chrome**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` directory

### Development Workflow

- **Development Build**: `npm run dev` (with hot reload)
- **Production Build**: `npm run build`
- **Run Tests**: `npm test`
- **Lint Code**: `npm run lint`

## Code Style Guidelines

### TypeScript
- Use **strict mode** (`strict: true` in tsconfig.json)
- Prefer `const` over `let`, avoid `var`
- Use explicit types for function parameters and return values
- Use interfaces for object shapes

### React
- Use **functional components** with hooks
- Keep components focused and single-purpose
- Extract reusable logic into custom hooks
- Use descriptive prop names

### Naming Conventions
- **Files**: `kebab-case.ts`, `PascalCase.tsx` for components
- **Variables/Functions**: `camelCase`
- **Classes/Interfaces**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`

### Comments
- Use JSDoc for public APIs
- Explain "why", not "what"
- Keep comments concise and up-to-date

## Project Structure

```
src/
├── background/       # Service worker logic
│   ├── background.ts # Main background script
│   └── sync-manager.ts # GitHub sync logic
├── content/          # Content scripts for LeetCode
│   ├── leetcode-monitor.ts
│   └── profile-manager.ts
├── popup/            # React UI components
│   ├── App.tsx
│   ├── SettingsTab.tsx
│   └── ...
├── services/         # API and storage abstractions
│   ├── leetcode.ts
│   ├── github.ts
│   └── storage.ts
└── types/            # TypeScript type definitions
```

## Pull Request Process

### Before Submitting

1. **Test Your Changes**
   - Run `npm run build` to ensure no build errors
   - Test the extension manually in Chrome
   - Run `npm test` if tests exist

2. **Follow Code Style**
   - Ensure your code follows the style guidelines above
   - Run `npm run lint` to check for issues

3. **Write Clear Commit Messages**
   ```
   feat: add keyboard shortcut for quick sync
   fix: resolve profile loading race condition
   docs: update README with new features
   ```

### Submitting a PR

1. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes**
   - Keep commits focused and atomic
   - Write descriptive commit messages

3. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```
   - Open a PR on GitHub
   - Fill out the PR template
   - Link any related issues

4. **Respond to Feedback**
   - Address review comments promptly
   - Push updates to the same branch

## Testing

### Manual Testing Checklist
- [ ] Extension builds without errors
- [ ] All tabs in popup work correctly
- [ ] Friend tracking and comparison features work
- [ ] GitHub sync completes successfully
- [ ] No console errors in background or content scripts

### Writing Tests
- Place tests in `tests/` directory
- Name test files `*.test.ts`
- Use Jest for unit tests
- Mock Chrome APIs when necessary

## Reporting Issues

### Bug Reports
Include:
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Browser version and OS
- Extension version

### Feature Requests
Include:
- Clear description of the feature
- Use case and motivation
- Proposed implementation (optional)

## Code of Conduct

- Be respectful and constructive
- Welcome newcomers and help them learn
- Focus on what is best for the community
- Show empathy towards other contributors

## Questions?

- Open a [GitHub Discussion](https://github.com/FTS18/l-amigo/discussions)
- Check existing [Issues](https://github.com/FTS18/l-amigo/issues)
- Review the [Documentation](https://lamigo.netlify.app/docs.html)

## License

By contributing to L'Amigo, you agree that your contributions will be licensed under the MIT License.
