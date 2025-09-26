# Claude Development Guidelines

## Code Verification Requirements

After making code changes and before declaring a task complete, you MUST:

1. Run `npm run verify` to ensure:
   - All TypeScript types are correct (via typecheck)

2. For significant changes or before releases, run `npm run verify:full` to also:
   - Ensure the project builds successfully

## Verification Commands

- `npm run verify` - Quick verification (typecheck only)
- `npm run verify:full` - Full verification (typecheck + build)

Always run verification after:
- Updating type definitions
- Modifying API client code
- Adding new features
- Fixing bugs
- Refactoring code

If verification fails, fix all issues before proceeding.

## Code Style Guidelines

### When Removing Code
- Actually remove code that is no longer needed - don't comment it out
- Don't add comments explaining what was removed
- Keep the codebase clean and free of clutter
- The git history tracks what was removed if needed later

### Type Updates
- API types are the source of truth
- When API types change, update the codebase to match
- Don't create new types to work around API changes
- Ask for clarification if unsure about type changes