# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

1. **Do NOT** create a public GitHub issue for security vulnerabilities
2. Email security concerns to the project maintainers
3. Include the following information:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your report within 48 hours
- **Assessment**: We will assess the vulnerability and determine its severity
- **Timeline**: We aim to address critical vulnerabilities within 7 days
- **Disclosure**: We will coordinate with you on disclosure timing

### Security Measures

This application implements the following security measures:

- **Content Security Policy (CSP)**: Restricts resource loading to prevent XSS attacks
- **Tauri Security Model**: Uses Tauri's secure IPC communication between frontend and backend
- **Dependency Auditing**: Regular security audits via `cargo audit` and `npm audit`
- **Automated Updates**: Dependabot monitors dependencies for known vulnerabilities

### Out of Scope

The following are generally not considered security vulnerabilities:

- Bugs that require physical access to the user's machine
- Issues in third-party dependencies (report to the upstream project)
- Social engineering attacks

## Security Best Practices for Users

1. Keep BMAD Manager updated to the latest version
2. Only open projects from trusted sources
3. Review Claude CLI commands before execution
4. Use the application on trusted networks

## License

This security policy is provided for informational purposes. The BMAD Manager application is provided "as is" without warranty. See the LICENSE file for full terms.
