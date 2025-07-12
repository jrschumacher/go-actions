"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const unified_pr_comment_1 = require("./unified-pr-comment");
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const artifact_1 = require("@actions/artifact");
// Mock dependencies
jest.mock('@actions/core');
jest.mock('@actions/github');
jest.mock('@actions/artifact');
jest.mock('fs/promises');
const mockCore = core;
const mockGithub = github;
describe('UnifiedPRComment', () => {
    let commenter;
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
        commenter = new unified_pr_comment_1.UnifiedPRComment();
        // Setup GitHub context mock
        Object.defineProperty(github, 'context', {
            value: {
                eventName: 'pull_request',
                repo: { owner: 'test-owner', repo: 'test-repo' },
                issue: { number: 123 }
            },
            writable: true
        });
        mockGithub.getOctokit.mockReturnValue(mockOctokit);
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
                test: { status: 'success', coverage: '85%' }
            };
            mockOctokit.rest.issues.listComments.mockResolvedValue({
                data: []
            });
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
                test: { status: 'success', coverage: '90%' }
            };
            mockOctokit.rest.issues.listComments.mockResolvedValue({
                data: [{
                        id: 456,
                        user: { type: 'Bot' },
                        body: 'Old comment\n# Go Actions Report\nOld content'
                    }]
            });
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
            });
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
                test: { status: 'success', coverage: '85%' }
            };
            const comment = commenter.formatUnifiedComment(results);
            expect(comment).toContain('# Go Actions Report');
            expect(comment).toContain('✅ **Tests** (85% coverage)');
            expect(comment).toContain('Coverage: 85%');
            expect(comment).toContain('Excellent test coverage');
        });
        it('should format failed benchmark results', () => {
            const results = {
                benchmark: {
                    status: 'failure',
                    error: 'Test failed',
                    config: { args: '-bench=.', count: 3 }
                }
            };
            const comment = commenter.formatUnifiedComment(results);
            expect(comment).toContain('❌ **Benchmarks** (failed)');
            expect(comment).toContain('**Benchmarks failed!**');
            expect(comment).toContain('Test failed');
        });
        it('should format mixed results', () => {
            const results = {
                test: { status: 'success', coverage: '75%' },
                lint: { status: 'failure', error: 'Lint error' },
                benchmark: { status: 'success', config: { args: '-bench=.', count: 1 } }
            };
            const comment = commenter.formatUnifiedComment(results);
            expect(comment).toContain('✅ **Tests** (75% coverage)');
            expect(comment).toContain('🚨 **Lint** **- Issues Found!**');
            expect(comment).toContain('✅ **Benchmarks**');
        });
        it('should format self-validation results', () => {
            const results = {
                selfValidate: {
                    status: 'success',
                    actionsFound: ['ci', 'release'],
                    errors: []
                }
            };
            const comment = commenter.formatUnifiedComment(results);
            expect(comment).toContain('✅ **Validated**');
            expect(comment).toContain('**Actions configured:** ci, release');
        });
    });
    describe('getOverallStatus', () => {
        it('should return success when all jobs succeed', () => {
            const results = {
                test: { status: 'success' },
                lint: { status: 'success' }
            };
            const status = commenter.getOverallStatus(results);
            expect(status).toBe('success');
        });
        it('should return failure when any job fails', () => {
            const results = {
                test: { status: 'success' },
                lint: { status: 'failure' }
            };
            const status = commenter.getOverallStatus(results);
            expect(status).toBe('failure');
        });
        it('should return success when no results', () => {
            const status = commenter.getOverallStatus({});
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
            await unified_pr_comment_1.UnifiedPRComment.storeResults('test', testResults);
            // Should skip when not in GitHub Actions environment
            expect(mockCore.exportVariable).not.toHaveBeenCalled();
            expect(mockCore.setOutput).toHaveBeenCalledWith('test_results', JSON.stringify(testResults));
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
            artifact_1.DefaultArtifactClient.mockImplementation(() => mockArtifactClient);
            const fs = require('fs/promises');
            fs.readFile = jest.fn()
                .mockResolvedValueOnce(JSON.stringify(testResults))
                .mockResolvedValueOnce(JSON.stringify(lintResults));
            const results = await unified_pr_comment_1.UnifiedPRComment.loadStoredResults();
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
            artifact_1.DefaultArtifactClient.mockImplementation(() => mockArtifactClient);
            const fs = require('fs/promises');
            fs.readFile = jest.fn().mockResolvedValue('invalid json');
            const results = await unified_pr_comment_1.UnifiedPRComment.loadStoredResults();
            expect(results).toEqual({});
            expect(consoleSpy).toHaveBeenCalledWith('Skipping artifact download - not in GitHub Actions environment');
            consoleSpy.mockRestore();
        });
        it('should return empty object when no results stored', async () => {
            const mockArtifactClient = {
                listArtifacts: jest.fn().mockResolvedValue({ artifacts: [] }),
            };
            artifact_1.DefaultArtifactClient.mockImplementation(() => mockArtifactClient);
            const results = await unified_pr_comment_1.UnifiedPRComment.loadStoredResults();
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
            const results = { test: { status: 'success' } };
            await (0, unified_pr_comment_1.updateUnifiedComment)(results);
            // Should exit early due to non-PR event
            expect(mockGithub.getOctokit).not.toHaveBeenCalled();
        });
    });
    describe('storeJobResults', () => {
        it('should store job results', async () => {
            const results = { status: 'success', coverage: '90%' };
            await (0, unified_pr_comment_1.storeJobResults)('test', results);
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
            artifact_1.DefaultArtifactClient.mockImplementation(() => mockArtifactClient);
            const fs = require('fs/promises');
            fs.readFile = jest.fn().mockResolvedValue(JSON.stringify({ status: 'success' }));
            const results = await (0, unified_pr_comment_1.loadAllResults)();
            // Should return empty object when not in GitHub Actions environment
            expect(results).toEqual({});
        });
    });
});
//# sourceMappingURL=unified-pr-comment.test.js.map