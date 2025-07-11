import * as core from '@actions/core';
import * as github from '@actions/github';
import { UnifiedPRComment, CIResults } from './unified-pr-comment';

/**
 * Posts unified CI results comment to pull requests
 * Consolidates all comment logic in one place for better testing and maintenance
 */
export async function postUnifiedComment(githubToken?: string): Promise<void> {
  try {
    // Only run on pull requests
    if (github.context.eventName !== 'pull_request') {
      console.log('Not a pull request, skipping comment');
      return;
    }

    console.log('Loading stored CI results for unified comment...');
    
    // Load all stored CI results from artifacts
    const allResults = await UnifiedPRComment.loadStoredResults();
    console.log('Loaded results:', JSON.stringify(allResults, null, 2));
    
    // Check if we have any results to report
    const hasResults = Object.keys(allResults).some(key => {
      const result = allResults[key as keyof CIResults];
      return result && result.status !== 'skipped';
    });
    
    if (!hasResults) {
      console.log('No CI results found to report');
      return;
    }
    
    // Create the unified comment using the existing updateComment method
    const commenter = new UnifiedPRComment();
    await commenter.updateComment(allResults);
    
    console.log('Unified comment posted successfully');
    
  } catch (error) {
    console.error('Failed to post unified comment:', error);
    // Don't fail the workflow if commenting fails
    core.warning(`Comment posting failed: ${error}`);
  }
}

// Default export for simple function call
export default async function() {
  const githubToken = process.env.INPUT_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  await postUnifiedComment(githubToken);
}