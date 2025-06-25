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
exports.UnifiedPRComment = void 0;
exports.updateUnifiedComment = updateUnifiedComment;
exports.storeJobResults = storeJobResults;
exports.loadAllResults = loadAllResults;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
class UnifiedPRComment {
    constructor(options = {}) {
        this.workingDirectory = options.workingDirectory || '.';
    }
    async updateComment(results) {
        // Only run on pull requests
        if (github.context.eventName !== 'pull_request') {
            return;
        }
        const token = core.getInput('github-token') || process.env.GITHUB_TOKEN;
        if (!token) {
            console.log('No GitHub token found, skipping PR comment');
            return;
        }
        const octokit = github.getOctokit(token);
        const comment = this.formatUnifiedComment(results);
        // Find existing go-actions comment
        const { data: comments } = await octokit.rest.issues.listComments({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            issue_number: github.context.issue.number,
        });
        const botComment = comments.find(c => c.user?.type === 'Bot' &&
            c.body?.includes('## 🚀 Go Actions CI Results'));
        if (botComment) {
            // Update existing comment
            await octokit.rest.issues.updateComment({
                owner: github.context.repo.owner,
                repo: github.context.repo.repo,
                comment_id: botComment.id,
                body: comment
            });
            console.log('Updated unified CI results comment');
        }
        else {
            // Create new comment
            await octokit.rest.issues.createComment({
                owner: github.context.repo.owner,
                repo: github.context.repo.repo,
                issue_number: github.context.issue.number,
                body: comment
            });
            console.log('Created new unified CI results comment');
        }
    }
    formatUnifiedComment(results) {
        const sections = [];
        const hasAnyResults = Object.keys(results).some(key => results[key] && results[key].status !== 'skipped');
        if (!hasAnyResults) {
            return this.formatEmptyComment();
        }
        // Header
        const overallStatus = this.getOverallStatus(results);
        const emoji = overallStatus === 'success' ? '✅' : overallStatus === 'failure' ? '❌' : '⚠️';
        sections.push(`## 🚀 Go Actions CI Results`);
        sections.push('');
        sections.push(`**Overall Status:** ${emoji} ${overallStatus.toUpperCase()}`);
        sections.push('');
        // Summary table
        sections.push(this.formatSummaryTable(results));
        sections.push('');
        // Detailed sections
        if (results.test && results.test.status !== 'skipped') {
            sections.push(this.formatTestSection(results.test));
            sections.push('');
        }
        if (results.lint && results.lint.status !== 'skipped') {
            sections.push(this.formatLintSection(results.lint));
            sections.push('');
        }
        if (results.benchmark && results.benchmark.status !== 'skipped') {
            sections.push(this.formatBenchmarkSection(results.benchmark));
            sections.push('');
        }
        if (results.selfValidate && results.selfValidate.status !== 'skipped') {
            sections.push(this.formatSelfValidateSection(results.selfValidate));
            sections.push('');
        }
        // Footer
        sections.push('---');
        sections.push('*Generated by [go-actions](https://github.com/jrschumacher/go-actions)*');
        return sections.join('\n');
    }
    getOverallStatus(results) {
        const statuses = Object.values(results)
            .filter(result => result && result.status !== 'skipped')
            .map(result => result.status);
        if (statuses.length === 0)
            return 'success';
        if (statuses.every(status => status === 'success'))
            return 'success';
        if (statuses.some(status => status === 'failure'))
            return 'failure';
        return 'partial';
    }
    formatSummaryTable(results) {
        const rows = ['| Job | Status | Details |', '|-----|--------|---------|'];
        if (results.test && results.test.status !== 'skipped') {
            const emoji = results.test.status === 'success' ? '✅' : '❌';
            const details = results.test.coverage ? `Coverage: ${results.test.coverage}` : '';
            rows.push(`| Tests | ${emoji} ${results.test.status} | ${details} |`);
        }
        if (results.lint && results.lint.status !== 'skipped') {
            const emoji = results.lint.status === 'success' ? '✅' : '❌';
            rows.push(`| Lint | ${emoji} ${results.lint.status} | |`);
        }
        if (results.benchmark && results.benchmark.status !== 'skipped') {
            const emoji = results.benchmark.status === 'success' ? '✅' : '❌';
            const details = results.benchmark.config ?
                `${results.benchmark.config.count} runs with \`${results.benchmark.config.args}\`` : '';
            rows.push(`| Benchmarks | ${emoji} ${results.benchmark.status} | ${details} |`);
        }
        if (results.selfValidate && results.selfValidate.status !== 'skipped') {
            const emoji = results.selfValidate.status === 'success' ? '✅' : '❌';
            const details = results.selfValidate.actionsFound.length > 0 ?
                `Actions: ${results.selfValidate.actionsFound.join(', ')}` : '';
            rows.push(`| Validation | ${emoji} ${results.selfValidate.status} | ${details} |`);
        }
        return rows.join('\n');
    }
    formatTestSection(test) {
        if (test.status === 'success' && test.coverage) {
            const coveragePercent = parseFloat(test.coverage.replace('%', ''));
            const emoji = coveragePercent >= 80 ? '🎉' : coveragePercent >= 60 ? '⚠️' : '🚨';
            return `### 🧪 Tests ${coveragePercent >= 80 ? '✅' : '⚠️'}

**Coverage: ${test.coverage}**

${emoji} ${coveragePercent >= 80 ?
                'Excellent test coverage!' :
                coveragePercent >= 60 ?
                    'Good coverage, consider adding more tests.' :
                    'Low test coverage detected. Please add more tests.'}

<details>
<summary>Coverage Guidelines</summary>

- 🎉 **80%+**: Excellent coverage
- ⚠️ **60-79%**: Good coverage, room for improvement  
- 🚨 **<60%**: Needs more tests

</details>`;
        }
        else if (test.status === 'failure') {
            return `### 🧪 Tests ❌

**Tests failed!**

${test.error ? `**Error:** ${test.error}` : 'Please check the test logs for details.'}`;
        }
        return `### 🧪 Tests ✅

All tests passed successfully!`;
    }
    formatLintSection(lint) {
        if (lint.status === 'success') {
            return `### 🔍 Lint ✅

Code quality checks passed!`;
        }
        else {
            return `### 🔍 Lint ❌

**Linting failed!**

${lint.error ? `**Error:** ${lint.error}` : 'Please check the lint logs for details.'}`;
        }
    }
    formatBenchmarkSection(benchmark) {
        if (benchmark.status === 'success') {
            return `### ⚡ Benchmarks ✅

Benchmarks completed successfully!

${benchmark.config ? `**Configuration:**
- Args: \`${benchmark.config.args}\`
- Runs: ${benchmark.config.count}` : ''}

🏃‍♂️ All benchmark tests passed. Performance metrics have been captured.`;
        }
        else {
            return `### ⚡ Benchmarks ❌

**Benchmarks failed!**

${benchmark.error ? `**Error:** ${benchmark.error}` : ''}

${benchmark.config ? `**Configuration:**
- Args: \`${benchmark.config.args}\`
- Runs: ${benchmark.config.count}` : ''}

Please check your benchmark functions and try again.`;
        }
    }
    formatSelfValidateSection(selfValidate) {
        if (selfValidate.status === 'success') {
            return `### 🔍 Configuration Validation ✅

All go-actions configuration is valid!

${selfValidate.actionsFound.length > 0 ?
                `**Actions detected:** ${selfValidate.actionsFound.join(', ')}` :
                '**No go-actions detected in workflows**'}`;
        }
        else {
            return `### 🔍 Configuration Validation ❌

**Validation failed!**

${selfValidate.errors.map(error => `- ${error.message}`).join('\n')}

${selfValidate.actionsFound.length > 0 ?
                `**Actions detected:** ${selfValidate.actionsFound.join(', ')}` : ''}`;
        }
    }
    formatEmptyComment() {
        return `## 🚀 Go Actions CI Results

No CI jobs have run yet. Results will appear here as jobs complete.

---
*Generated by [go-actions](https://github.com/jrschumacher/go-actions)*`;
    }
    // Static method to store results in GitHub Actions artifacts/environment
    static async storeResults(jobType, jobResults) {
        const key = `GO_ACTIONS_${jobType.toUpperCase()}_RESULTS`;
        const serialized = JSON.stringify(jobResults);
        // Store in environment for other jobs to read
        core.exportVariable(key, serialized);
        core.setOutput(`${jobType}_results`, serialized);
        console.log(`Stored ${jobType} results for unified comment`);
    }
    // Static method to load all stored results
    static loadStoredResults() {
        const results = {};
        const jobTypes = ['test', 'lint', 'benchmark', 'selfValidate'];
        for (const jobType of jobTypes) {
            const key = `GO_ACTIONS_${jobType.toUpperCase()}_RESULTS`;
            const stored = process.env[key];
            if (stored) {
                try {
                    results[jobType] = JSON.parse(stored);
                }
                catch (error) {
                    console.log(`Failed to parse stored results for ${jobType}: ${error}`);
                }
            }
        }
        return results;
    }
}
exports.UnifiedPRComment = UnifiedPRComment;
// Export functions for direct use
async function updateUnifiedComment(results, options = {}) {
    const commenter = new UnifiedPRComment(options);
    await commenter.updateComment(results);
}
async function storeJobResults(jobType, jobResults) {
    await UnifiedPRComment.storeResults(jobType, jobResults);
}
function loadAllResults() {
    return UnifiedPRComment.loadStoredResults();
}
//# sourceMappingURL=unified-pr-comment.js.map