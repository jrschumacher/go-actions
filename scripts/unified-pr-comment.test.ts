import { UnifiedPRComment, updateUnifiedComment, storeJobResults, loadAllResults } from './unified-pr-comment';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { DefaultArtifactClient } from '@actions/artifact';

// Mock dependencies
jest.mock('@actions/core');
jest.mock('@actions/github');
jest.mock('@actions/artifact');
jest.mock('fs/promises');

const mockCore = core as jest.Mocked<typeof core>;
const mockGithub = github as jest.Mocked<typeof github>;

describe('UnifiedPRComment', () => {
  let commenter: UnifiedPRComment;
  const mockOctokit = {
    rest: {
      issues: {
        listComments: jest.fn(),
        createComment: jest.fn(),
        updateComment: jest.fn()
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    commenter = new UnifiedPRComment();
    
    // Setup GitHub context mock
    Object.defineProperty(github, 'context', {
      value: {
        eventName: 'pull_request',
        repo: { owner: 'test-owner', repo: 'test-repo' },
        issue: { number: 123 }
      },
      writable: true
    });

    mockGithub.getOctokit.mockReturnValue(mockOctokit as any);
    mockCore.getInput.mockReturnValue('test-token');
  });

  describe('updateComment', () => {
    it('should skip when not a pull request', async () => {
      Object.defineProperty(github, 'context', {
        value: { eventName: 'push' },
        writable: true
      });

      await commenter.updateComment({});

      expect(mockOctokit.rest.issues.listComments).not.toHaveBeenCalled();
    });

    it('should skip when no GitHub token', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      mockCore.getInput.mockReturnValue('');
      process.env.GITHUB_TOKEN = '';

      await commenter.updateComment({});

      expect(consoleSpy).toHaveBeenCalledWith('No GitHub token found, skipping PR comment');
      consoleSpy.mockRestore();
    });

    it('should create new comment when none exists', async () => {
      const results = {
        test: { status: 'success' as const, coverage: '85%' }
      };

      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: []
      } as any);

      await commenter.updateComment(results);

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        body: expect.stringContaining('# Go Actions Report')
      });
    });

    it('should update existing comment', async () => {
      const results = {
        test: { status: 'success' as const, coverage: '90%' }
      };

      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: [{
          id: 456,
          user: { type: 'Bot' },
          body: 'Old comment\n# Go Actions Report\nOld content'
        }]
      } as any);

      await commenter.updateComment(results);

      expect(mockOctokit.rest.issues.updateComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        comment_id: 456,
        body: expect.stringContaining('Coverage: 90%')
      });
    });

    it('should handle empty results', async () => {
      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: []
      } as any);

      await commenter.updateComment({});

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        body: expect.stringContaining('No CI jobs have run yet')
      });
    });
  });

  describe('formatUnifiedComment', () => {
    it('should format successful test results', () => {
      const results = {
        test: { status: 'success' as const, coverage: '85%' }
      };

      const comment = (commenter as any).formatUnifiedComment(results);

      expect(comment).toContain('# Go Actions Report');
      expect(comment).toContain('✅ **Tests** (85% coverage)');
      expect(comment).toContain('Coverage: 85%');
      expect(comment).toContain('Excellent test coverage');
    });

    it('should format failed benchmark results', () => {
      const results = {
        benchmark: { 
          status: 'failure' as const, 
          error: 'Test failed',
          config: { args: '-bench=.', count: 3 }
        }
      };

      const comment = (commenter as any).formatUnifiedComment(results);

      expect(comment).toContain('❌ **Benchmarks** (failed)');
      expect(comment).toContain('**Benchmarks failed!**');
      expect(comment).toContain('Test failed');
    });

    it('should format mixed results', () => {
      const results = {
        test: { status: 'success' as const, coverage: '75%' },
        lint: { status: 'failure' as const, error: 'Lint error' },
        benchmark: { status: 'success' as const, config: { args: '-bench=.', count: 1 } }
      };

      const comment = (commenter as any).formatUnifiedComment(results);

      expect(comment).toContain('✅ **Tests** (75% coverage)');
      expect(comment).toContain('🚨 **Lint** **- Issues Found!**');
      expect(comment).toContain('✅ **Benchmarks**');
    });

    it('should format self-validation results', () => {
      const results = {
        selfValidate: { 
          status: 'success' as const, 
          actionsFound: ['ci', 'release'],
          errors: []
        }
      };

      const comment = (commenter as any).formatUnifiedComment(results);

      expect(comment).toContain('✅ **Validated**');
      expect(comment).toContain('**Actions configured:** ci, release');
    });
  });

  describe('getOverallStatus', () => {
    it('should return success when all jobs succeed', () => {
      const results = {
        test: { status: 'success' as const },
        lint: { status: 'success' as const }
      };

      const status = (commenter as any).getOverallStatus(results);
      expect(status).toBe('success');
    });

    it('should return failure when any job fails', () => {
      const results = {
        test: { status: 'success' as const },
        lint: { status: 'failure' as const }
      };

      const status = (commenter as any).getOverallStatus(results);
      expect(status).toBe('failure');
    });

    it('should return success when no results', () => {
      const status = (commenter as any).getOverallStatus({});
      expect(status).toBe('success');
    });
  });
});

describe('static methods', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear environment variables
    delete process.env.GO_ACTIONS_TEST_RESULTS;
    delete process.env.GO_ACTIONS_LINT_RESULTS;
  });

  describe('storeResults', () => {
    it('should store results in environment', async () => {
      const testResults = { status: 'success', coverage: '80%' };
      
      await UnifiedPRComment.storeResults('test', testResults);

      // Should skip when not in GitHub Actions environment
      expect(mockCore.exportVariable).not.toHaveBeenCalled();
      expect(mockCore.setOutput).toHaveBeenCalledWith(
        'test_results',
        JSON.stringify(testResults)
      );
    });
  });

  describe('loadStoredResults', () => {
    it('should load stored results from artifacts', async () => {
      const testResults = { status: 'success', coverage: '85%' };
      const lintResults = { status: 'failure', error: 'Lint failed' };
      
      // Mock artifact client
      const mockArtifactClient = {
        listArtifacts: jest.fn().mockResolvedValue({
          artifacts: [
            { id: 1, name: 'go-actions-test' },
            { id: 2, name: 'go-actions-lint' }
          ]
        }),
        downloadArtifact: jest.fn().mockResolvedValue({}),
      };
      
      (DefaultArtifactClient as jest.MockedClass<typeof DefaultArtifactClient>).mockImplementation(() => mockArtifactClient as any);
      
      const fs = require('fs/promises');
      fs.readFile = jest.fn()
        .mockResolvedValueOnce(JSON.stringify(testResults))
        .mockResolvedValueOnce(JSON.stringify(lintResults));

      const results = await UnifiedPRComment.loadStoredResults();

      // Should return empty object when not in GitHub Actions environment
      expect(results).toEqual({});
    });

    it('should handle malformed JSON gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const mockArtifactClient = {
        listArtifacts: jest.fn().mockResolvedValue({
          artifacts: [{ id: 1, name: 'go-actions-test' }]
        }),
        downloadArtifact: jest.fn().mockResolvedValue({}),
      };
      
      (DefaultArtifactClient as jest.MockedClass<typeof DefaultArtifactClient>).mockImplementation(() => mockArtifactClient as any);
      
      const fs = require('fs/promises');
      fs.readFile = jest.fn().mockResolvedValue('invalid json');

      const results = await UnifiedPRComment.loadStoredResults();

      expect(results).toEqual({});
      expect(consoleSpy).toHaveBeenCalledWith(
        'Skipping artifact download - not in GitHub Actions environment'
      );
      
      consoleSpy.mockRestore();
    });

    it('should return empty object when no results stored', async () => {
      const mockArtifactClient = {
        listArtifacts: jest.fn().mockResolvedValue({ artifacts: [] }),
      };
      
      (DefaultArtifactClient as jest.MockedClass<typeof DefaultArtifactClient>).mockImplementation(() => mockArtifactClient as any);
      
      const results = await UnifiedPRComment.loadStoredResults();
      
      expect(results).toEqual({});
    });
  });
});

describe('exported functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateUnifiedComment', () => {
    it('should work with results', async () => {
      Object.defineProperty(github, 'context', {
        value: { eventName: 'push' },
        writable: true
      });

      const results = { test: { status: 'success' as const } };
      await updateUnifiedComment(results);

      // Should exit early due to non-PR event
      expect(mockGithub.getOctokit).not.toHaveBeenCalled();
    });
  });

  describe('storeJobResults', () => {
    it('should store job results', async () => {
      const results = { status: 'success', coverage: '90%' };
      
      await storeJobResults('test', results);

      // Should skip when not in GitHub Actions environment  
      expect(mockCore.exportVariable).not.toHaveBeenCalled();
    });
  });

  describe('loadAllResults', () => {
    it('should load all results', async () => {
      const mockArtifactClient = {
        listArtifacts: jest.fn().mockResolvedValue({
          artifacts: [{ id: 1, name: 'go-actions-test' }]
        }),
        downloadArtifact: jest.fn().mockResolvedValue({}),
      };
      
      (DefaultArtifactClient as jest.MockedClass<typeof DefaultArtifactClient>).mockImplementation(() => mockArtifactClient as any);
      
      const fs = require('fs/promises');
      fs.readFile = jest.fn().mockResolvedValue(JSON.stringify({ status: 'success' }));
      
      const results = await loadAllResults();
      
      // Should return empty object when not in GitHub Actions environment
      expect(results).toEqual({});
    });
  });
});