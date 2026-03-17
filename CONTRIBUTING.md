# Contributing to The Gruvs

Thank you for your interest in contributing! Here's how you can help.

## Getting Started

1. Fork the repository.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/the-gruvs.git
   cd the-gruvs
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

- **Start dev server:**
  ```bash
  npm run start   # for all platforms
  npm run web     # web only
  ```

- **Run tests:**
  ```bash
  npm test
  ```

- **Lint & format:**
  ```bash
  npm run lint
  npm run format
  ```

## Code Style

- Follow the `.eslintrc.json` and `.prettierrc` rules.
- Run `npm run format` before committing.
- Keep components small and focused.
- Add comments for complex logic.

## Commit Messages

Use clear, concise commit messages:
- ✨ `feat: add new feature`
- 🐛 `fix: resolve bug`
- 📚 `docs: update documentation`
- 🎨 `style: format code`
- ♻️ `refactor: restructure code`
- ✅ `test: add/update tests`

## Pull Requests

1. Ensure all tests pass: `npm test`
2. Ensure code is formatted: `npm run format`
3. Write a clear PR description.
4. Link related issues.
5. Request review from maintainers.

## Reporting Issues

- Check existing issues first.
- Provide clear reproduction steps.
- Include device/OS info.
- Share relevant logs or screenshots.

## Questions?

Feel free to open a discussion or issue. We're here to help!

---

Happy coding! 🎉
