import { loadAllResults, updateUnifiedComment } from './unified-pr-comment';
import * as core from '@actions/core';

export async function postUnifiedComment() {
  try {
    console.log('Loading stored CI results for unified comment...');
    
    const results = loadAllResults();
    console.log('Loaded results:', JSON.stringify(results, null, 2));
    
    if (Object.keys(results).length === 0) {
      console.log('No CI results found, skipping unified comment');
      return;
    }
    
    await updateUnifiedComment(results);
    console.log('Unified PR comment updated successfully');
  } catch (error) {
    console.error('Failed to post unified comment:', error);
    // Don't fail the workflow if commenting fails
  }
}

// Export for direct use in GitHub Actions
export async function main() {
  await postUnifiedComment();
}