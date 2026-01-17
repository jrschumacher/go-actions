// Entry point for ci-action bundle
export { extractCoverage } from './coverage-extractor';
export { runBenchmarks } from './benchmark-runner';
export * from './ci-action';
export { UnifiedPRComment, updateUnifiedComment, loadAllResults } from './unified-pr-comment';
export { postUnifiedComment } from './action-comment';
export { default as actionComment } from './action-comment';
// Note: action-ci.ts was removed as it duplicated ci-action.ts functionality
// The CIAction class from ci-action.ts is the canonical implementation