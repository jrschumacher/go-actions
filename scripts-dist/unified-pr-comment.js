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
const artifact_1 = require("@actions/artifact");
const fs = __importStar(require("fs/promises"));
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
            c.body?.includes('# Go Actions Report'));
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
        const hasAnyResults = Object.keys(results).some(key => results[key] && results[key].status !== 'skipped');
        if (!hasAnyResults) {
            return this.formatEmptyComment();
        }
        let comment = '# Go Actions Report\n\n';
        // Status lines
        if (results.selfValidate && results.selfValidate.status !== 'skipped') {
            const icon = results.selfValidate.status === 'success' ? '✅' : '❌';
            comment += `${icon} **Validated**`;
            if (results.selfValidate.status === 'failure') {
                comment += ` (${results.selfValidate.errors.length} issue${results.selfValidate.errors.length === 1 ? '' : 's'})`;
            }
            comment += '\n';
        }
        if (results.test && results.test.status !== 'skipped') {
            const icon = results.test.status === 'success' ? '✅' : '❌';
            comment += `${icon} **Tests**`;
            if (results.test.coverage) {
                comment += ` (${results.test.coverage} coverage)`;
            }
            else if (results.test.status === 'failure') {
                comment += ' (failed)';
            }
            comment += '\n';
        }
        if (results.lint && results.lint.status !== 'skipped') {
            const icon = results.lint.status === 'success' ? '✅' : '🚨';
            comment += `${icon} **Lint**`;
            if (results.lint.status === 'failure') {
                comment += ' **- Issues Found!**';
            }
            comment += '\n';
        }
        if (results.benchmark && results.benchmark.status !== 'skipped') {
            const icon = results.benchmark.status === 'success' ? '✅' : '❌';
            comment += `${icon} **Benchmarks**`;
            if (results.benchmark.status === 'failure') {
                comment += ' (failed)';
            }
            comment += '\n';
        }
        comment += '\n';
        // Details sections
        if (results.selfValidate && results.selfValidate.status !== 'skipped') {
            comment += this.formatValidationDetails(results.selfValidate);
        }
        if (results.test && results.test.status !== 'skipped') {
            comment += this.formatTestDetails(results.test);
        }
        if (results.lint && results.lint.status !== 'skipped') {
            comment += this.formatLintDetails(results.lint);
        }
        if (results.benchmark && results.benchmark.status !== 'skipped') {
            comment += this.formatBenchmarkDetails(results.benchmark);
        }
        // Footer
        comment += '*🤖 This comment will update automatically as you push changes.*\n';
        comment += '*Generated by [go-actions](https://github.com/jrschumacher/go-actions)*';
        return comment;
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
    formatValidationDetails(selfValidate) {
        if (selfValidate.status === 'success') {
            return `<details><summary>Validation Details</summary>\n\n**Actions configured:** ${selfValidate.actionsFound.join(', ')}\n\n**Checks passed:**\n- Configuration files present\n- Version compatibility verified\n- Workflow syntax valid\n\n</details>\n\n`;
        }
        else {
            let details = '<details open><summary>Validation Issues</summary>\n\n';
            for (let i = 0; i < selfValidate.errors.length; i++) {
                details += `${i + 1}. ${selfValidate.errors[i].message}\n`;
            }
            details += '\n</details>\n\n';
            return details;
        }
    }
    formatTestDetails(test) {
        if (test.status === 'success') {
            if (test.coverage) {
                const coveragePercent = parseFloat(test.coverage.replace('%', ''));
                const emoji = coveragePercent >= 80 ? '🎉' : coveragePercent >= 60 ? '⚠️' : '🚨';
                return `<details><summary>Test Details</summary>\n\n**Coverage: ${test.coverage}**\n\n${emoji} ${coveragePercent >= 80 ?
                    'Excellent test coverage!' :
                    coveragePercent >= 60 ?
                        'Good coverage, consider adding more tests.' :
                        'Low test coverage detected. Please add more tests.'}\n\n</details>\n\n`;
            }
            else {
                return `<details><summary>Test Details</summary>\n\nAll tests passed successfully!\n\n</details>\n\n`;
            }
        }
        else {
            return `<details open><summary>Test Issues</summary>\n\n**Tests failed!**\n\n${test.error ? `**Error:** ${test.error}` : 'Please check the test logs for details.'}\n\n</details>\n\n`;
        }
    }
    formatLintDetails(lint) {
        if (lint.status === 'success') {
            return `<details><summary>Lint Details</summary>\n\nCode quality checks passed!\n\n</details>\n\n`;
        }
        else {
            let issuesOutput = '';
            if (lint.issues && lint.issues.trim()) {
                // Format the lint issues for better readability
                const issues = lint.issues.trim();
                // Truncate if too long (GitHub comment limit considerations)
                const maxLength = 3000;
                const truncatedIssues = issues.length > maxLength
                    ? issues.substring(0, maxLength) + '\n\n... (truncated, see workflow logs for full output)'
                    : issues;
                issuesOutput = `\n\`\`\`\n${truncatedIssues}\n\`\`\`\n`;
            }
            else if (lint.error) {
                issuesOutput = `\n**Error:** ${lint.error}\n\nPlease check the workflow logs for details.`;
            }
            else {
                issuesOutput = '\nPlease check the workflow logs for details.';
            }
            return `<details open><summary>🚨 Lint Issues Found</summary>\n\n**Code quality checks failed!**${issuesOutput}\n\n</details>\n\n`;
        }
    }
    formatBenchmarkDetails(benchmark) {
        if (benchmark.status === 'success') {
            return `<details><summary>Benchmark Details</summary>\n\nBenchmarks completed successfully!\n\n${benchmark.config ? `**Configuration:**\n- Args: \`${benchmark.config.args}\`\n- Runs: ${benchmark.config.count}` : ''}\n\n</details>\n\n`;
        }
        else {
            return `<details open><summary>Benchmark Issues</summary>\n\n**Benchmarks failed!**\n\n${benchmark.error ? `**Error:** ${benchmark.error}` : ''}\n\n${benchmark.config ? `**Configuration:**\n- Args: \`${benchmark.config.args}\`\n- Runs: ${benchmark.config.count}` : ''}\n\n</details>\n\n`;
        }
    }
    formatEmptyComment() {
        return `# Go Actions Report

⏳ **Pending**

<details><summary>Details</summary>

No CI jobs have run yet. Results will appear here as jobs complete.

</details>

*🤖 This comment will update automatically as you push changes.*
*Generated by [go-actions](https://github.com/jrschumacher/go-actions)*`;
    }
    // Static method to store results in GitHub Actions artifacts
    static async storeResults(jobType, jobResults) {
        // Skip artifact upload if not in GitHub Actions environment
        if (!process.env.ACTIONS_RUNTIME_TOKEN) {
            console.log(`Skipping artifact upload for ${jobType} - not in GitHub Actions environment`);
            core.setOutput(`${jobType}_results`, JSON.stringify(jobResults));
            return;
        }
        try {
            const artifactClient = new artifact_1.DefaultArtifactClient();
            const filename = `${jobType}-results.json`;
            const serialized = JSON.stringify(jobResults);
            // Write results to file
            await fs.writeFile(filename, serialized);
            // Upload as artifact
            await artifactClient.uploadArtifact(`go-actions-${jobType}`, [filename], '.');
            console.log(`Stored ${jobType} results in artifact for unified comment`);
        }
        catch (error) {
            console.error(`Failed to store ${jobType} results: ${error}`);
            // Fallback to output for backward compatibility
            core.setOutput(`${jobType}_results`, JSON.stringify(jobResults));
        }
    }
    // Static method to load all stored results from artifacts
    static async loadStoredResults() {
        const results = {};
        const jobTypes = ['test', 'lint', 'benchmark', 'selfValidate'];
        // Skip artifact download if not in GitHub Actions environment
        if (!process.env.ACTIONS_RUNTIME_TOKEN) {
            console.log('Skipping artifact download - not in GitHub Actions environment');
            return results;
        }
        try {
            const artifactClient = new artifact_1.DefaultArtifactClient();
            // List all artifacts to find our job results
            const artifacts = await artifactClient.listArtifacts();
            for (const jobType of jobTypes) {
                try {
                    const artifactName = `go-actions-${jobType}`;
                    const artifact = artifacts.artifacts.find(a => a.name === artifactName);
                    if (artifact) {
                        // Download artifact by ID
                        await artifactClient.downloadArtifact(artifact.id);
                        // Read results from downloaded file
                        const filename = `${jobType}-results.json`;
                        const data = await fs.readFile(filename, 'utf8');
                        results[jobType] = JSON.parse(data);
                        console.log(`Loaded ${jobType} results from artifact`);
                    }
                    else {
                        console.log(`No artifact found for ${jobType} (job may not have run)`);
                    }
                }
                catch (error) {
                    console.log(`Failed to load ${jobType} artifact: ${error}`);
                }
            }
        }
        catch (error) {
            console.error(`Failed to load stored results: ${error}`);
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
async function loadAllResults() {
    return UnifiedPRComment.loadStoredResults();
}
//# sourceMappingURL=unified-pr-comment.js.map