# BMAD Manager

A desktop application for managing BMAD (Business/Mission Analysis & Design) workflows and agent sessions.

## Features

- **Project Detection**: Automatically detects BMAD-enabled projects
- **Agent Roster**: Browse and launch BMAD agents from a visual interface
- **Session Management**: Create, resume, and manage Claude CLI sessions
- **Terminal Integration**: Embedded terminal with full PTY support

## Installation

Download the latest release for your platform from the [Releases](../../releases) page:

| Platform | File |
|----------|------|
| macOS (Apple Silicon) | `.dmg` ending in `aarch64` |
| macOS (Intel) | `.dmg` ending in `x86_64` |
| Windows | `.msi` installer |
| Linux | `.AppImage` (portable) or `.deb` (Debian/Ubuntu) |

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS version)
- [Rust](https://rustup.rs/) (stable)
- Platform-specific dependencies:
  - **Ubuntu/Debian**: `sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`
  - **macOS**: Xcode Command Line Tools
  - **Windows**: Visual Studio Build Tools

### Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

### Running Tests

```bash
# TypeScript type checking
npm run check

# Rust tests
cd src-tauri && cargo test
```

## License

MIT
