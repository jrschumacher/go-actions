/**
 * Entry point for the unified comment bundle
 * Exports all functions needed by GitHub Actions workflows
 */
export { UnifiedPRComment, CIResults, TestJobResult, LintJobResult, BenchmarkJobResult, SecurityJobResult, SelfValidateJobResult, PRCommentOptions, updateUnifiedComment, setProcessingState, storeJobResults, loadAllResults, } from './unified-pr-comment';
export { postUnifiedComment } from './action-comment';
