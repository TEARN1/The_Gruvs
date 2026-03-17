# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Cross-platform Expo/React Native app scaffold
- Basic to-do/event list functionality
- Local persistence via AsyncStorage (mobile) and localStorage (web)
- Docker setup for web deployment
- GitHub Actions CI workflow for web builds
- ESLint, Prettier, and Jest configuration
- MIT License

### Changed
- Initial release preparation

### Fixed
- N/A

## [0.1.0] - 2026-02-28

### Added
- Initial project setup
- `App.js` with simple event list UI
- `package.json` with Expo, React, React Native dependencies
- `app.json` with Expo configuration
- `eas.json` for Expo Application Services builds
- `Dockerfile` for containerized web builds
- GitHub Actions workflow for CI
- `.gitignore` and basic project structure
- Development scripts: start, web, build:web, android, ios

---

## Release Notes

### How to Release

1. Update version in `package.json` and `app.json`.
2. Update `CHANGELOG.md` with changes.
3. Commit and tag: `git tag v0.2.0`
4. Push to GitHub: `git push origin main --tags`
5. Create GitHub Release from tag.
6. (Optional) Build and publish to app stores via EAS.

---

[Unreleased]: https://github.com/yourusername/the-gruvs
[0.1.0]: https://github.com/yourusername/the-gruvs/releases/tag/v0.1.0
