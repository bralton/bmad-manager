# CLAUDE.md - BMAD Manager Development Guide

## Quick Reference: Common Pitfalls to Avoid

### 1. Rust ↔ TypeScript Serialization

**ALWAYS use `#[serde(rename_all = "camelCase")]` for Tauri command structs:**
```rust
// CORRECT
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MyStruct {
    pub project_path: String,  // Serializes as "projectPath"
    pub user_name: String,     // Serializes as "userName"
}

// WRONG - will cause runtime errors
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MyStruct {
    pub project_path: String,  // Serializes as "project_path" - TypeScript won't match
}
```

### 2. Tauri Invoke Parameter Naming

**Parameter names in `invoke()` must match Rust function parameter names exactly:**
```typescript
// If Rust has: pub async fn my_command(session_id: String, options: Options)
// Then TypeScript must use:
invoke('my_command', { sessionId: '...', options: {...} })  // WRONG - sessionId vs session_id
invoke('my_command', { session_id: '...', options: {...} }) // CORRECT
```

### 3. Optional Fields Need Defaults

**Always add `#[serde(default)]` for optional Rust struct fields:**
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub name: String,
    #[serde(default)]  // Required for optional fields
    pub description: Option<String>,
    #[serde(default)]  // Required for fields with defaults
    pub enabled: bool,
}
```

### 4. Svelte 5 Patterns

**Use runes consistently:**
```svelte
<script lang="ts">
  // Props
  let { data, onClose }: { data: MyType; onClose?: () => void } = $props();

  // Local state
  let count = $state(0);

  // Derived values
  let doubled = $derived(count * 2);

  // Store access (reactive)
  let project = $derived($currentProject);
</script>
```

### 5. Error Types for Tauri

**All error enums need `Serialize` for IPC:**
```rust
#[derive(Debug, Error, Serialize)]  // Serialize is required!
pub enum MyError {
    #[error("Something failed: {0}")]
    Failed(String),
}
```

---

## Project Structure

```
bmad-manager/
├── src-tauri/src/           # Rust backend
│   ├── lib.rs               # Module declarations + Tauri setup
│   ├── project/             # Project detection
│   ├── bmad_parser/         # BMAD file parsing
│   ├── process_manager/     # Claude CLI + PTY
│   ├── session_registry/    # SQLite persistence
│   ├── settings/            # User settings
│   └── initializer/         # Git + BMAD init
├── src/                     # Svelte frontend
│   ├── lib/
│   │   ├── components/      # UI components
│   │   ├── stores/          # Svelte stores
│   │   ├── services/        # Tauri IPC wrappers
│   │   └── types/           # TypeScript types
│   └── routes/              # SvelteKit routes
└── _bmad-output/            # BMAD artifacts
```

## Commands

```bash
npm run tauri dev      # Development server
npm run tauri build    # Production build
cargo test             # Run Rust tests
npm run check          # TypeScript check
```

## Testing

- All stories should have unit tests
- Run `cargo test` before marking story done
- Run `npm run check` to verify TypeScript

---

## Story Quality Gates

> Added after Epic 2 Phase Detection Incident (2026-02-17). See `epic-2-retro-phase-detection-2026-02-17.md`.

### For Parser/Data-Handling Stories

**"Show Me The Files" Gate - Definition of Ready:**

Before any story that parses or processes existing files is marked Ready for Dev:

- [ ] Developer has READ at least 3 real examples of target files
- [ ] All schema variants documented in story dev notes
- [ ] ACs reference actual field values from real files, not assumed values
- [ ] Evidence in story: file paths examined, relevant frontmatter/fields noted

**Required Story Section:**
```markdown
### Validated Against (REQUIRED for parser stories)
Files examined before implementation:
| File | Relevant Fields | Notes |
|------|-----------------|-------|
| _bmad-output/implementation-artifacts/1-1-example.md | status: done | Story status, not artifact |
```

### For All Stories

**Assumptions Log (Required):**

Every story must explicitly list assumptions that would invalidate the implementation:

```markdown
### Assumptions (if wrong, story fails)
- All files in target directory use the same schema
- Status values are limited to: x, y, z
- [List any assumption that, if wrong, breaks the implementation]
```

**Same-Session Bug Rule:**

> If implementation reveals requirements were wrong and spawns bugs in the SAME session, the original story is NOT done. Either fix in-story or explicitly acknowledge the scope miss and create follow-up with adjusted estimates.

### Design Doc Validation

Architecture/design documents must include a "Validated Against Real Data" section:

```markdown
### Validated Against Real Data
| File | Relevant Fields | Notes |
|------|-----------------|-------|
| path/to/actual/file.md | field: value | Matches/differs from assumption |
```

Do not design against concepts. Design against actual files.
