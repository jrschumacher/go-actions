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
exports.runCIJob = runCIJob;
exports.default = default_1;
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const coverage_extractor_1 = require("./coverage-extractor");
const benchmark_runner_1 = require("./benchmark-runner");
const unified_pr_comment_1 = require("./unified-pr-comment");
/**
 * Runs the specified CI job (test, lint, or benchmark)
 * Consolidates all CI logic in one place for better testing and maintenance
 */
async function runCIJob(inputs) {
    try {
        // Validate job input
        const validJobs = ['test', 'lint', 'benchmark'];
        if (!validJobs.includes(inputs.job)) {
            throw new Error(`Invalid job type: ${inputs.job}. Valid options are: ${validJobs.join(', ')}`);
        }
        console.log(`Running CI job: ${inputs.job}`);
        switch (inputs.job) {
            case 'test':
                await runTestJob(inputs);
                break;
            case 'lint':
                await runLintJob(inputs);
                break;
            case 'benchmark':
                await runBenchmarkJob(inputs);
                break;
        }
    }
    catch (error) {
        console.error(`CI job '${inputs.job}' failed:`, error);
        core.setFailed(`CI job '${inputs.job}' failed: ${error}`);
        throw error;
    }
}
async function runTestJob(inputs) {
    const workingDir = inputs.workingDirectory || '.';
    const testArgs = inputs.testArgs || '-v -race -coverprofile=coverage.out';
    console.log('Running Go tests...');
    try {
        // Run tests
        await exec.exec('go', ['test', ...testArgs.split(' '), './...'], {
            cwd: workingDir
        });
        // Extract coverage
        const result = (0, coverage_extractor_1.extractCoverage)(workingDir);
        if (result.hasCoverage && result.coverage !== null) {
            console.log(`Coverage: ${result.coverage}%`);
            core.setOutput('coverage', result.coverage.toString());
        }
        else {
            console.log('No coverage data found');
            core.setOutput('coverage', '0');
        }
        // Store test results for unified comment
        const testResult = {
            status: 'success',
            coverage: result.hasCoverage && result.coverage !== null ? `${result.coverage}%` : undefined,
        };
        await unified_pr_comment_1.UnifiedPRComment.storeResults('test', testResult);
        console.log('Stored test results for unified comment');
    }
    catch (error) {
        // Store failure results
        const testResult = {
            status: 'failure',
            error: 'Test execution failed'
        };
        await unified_pr_comment_1.UnifiedPRComment.storeResults('test', testResult);
        throw error;
    }
}
async function runBenchmarkJob(inputs) {
    const workingDir = inputs.workingDirectory || '.';
    const benchmarkArgs = inputs.benchmarkArgs || '-bench=. -benchmem';
    const benchmarkCount = inputs.benchmarkCount || 5;
    try {
        const result = (0, benchmark_runner_1.runBenchmarks)(workingDir, benchmarkArgs, benchmarkCount);
        console.log('Benchmark results:', result);
        // Store benchmark results for unified comment
        const benchmarkResult = {
            status: 'success',
            config: {
                args: benchmarkArgs,
                count: benchmarkCount
            }
        };
        await unified_pr_comment_1.UnifiedPRComment.storeResults('benchmark', benchmarkResult);
        console.log('Stored benchmark results for unified comment');
    }
    catch (error) {
        // Store failure results
        const benchmarkResult = {
            status: 'failure',
            error: error.message,
            config: {
                args: benchmarkArgs,
                count: benchmarkCount
            }
        };
        await unified_pr_comment_1.UnifiedPRComment.storeResults('benchmark', benchmarkResult);
        throw error;
    }
}
async function runLintJob(inputs) {
    const workingDir = inputs.workingDirectory || '.';
    let golangciLintVersion = inputs.golangciLintVersion || 'v2.1.0';
    const lintArgs = inputs.lintArgs || '';
    // Normalize golangci-lint version
    if (golangciLintVersion === 'v2' || golangciLintVersion === 'latest') {
        golangciLintVersion = 'v2.1.0';
    }
    console.log(`Using golangci-lint version: ${golangciLintVersion}`);
    try {
        // Since we can't easily replicate the golangci-lint-action@v8 behavior in TypeScript,
        // we'll use the golangci-lint binary directly
        console.log('Installing and running golangci-lint...');
        // Install golangci-lint
        await exec.exec('go', ['install', `github.com/golangci/golangci-lint/cmd/golangci-lint@${golangciLintVersion}`]);
        // Run golangci-lint and capture output
        const lintCommand = ['golangci-lint', 'run'];
        if (lintArgs) {
            lintCommand.push(...lintArgs.split(' '));
        }
        let lintOutput = '';
        let lintErrors = '';
        await exec.exec(lintCommand[0], lintCommand.slice(1), {
            cwd: workingDir,
            listeners: {
                stdout: (data) => {
                    lintOutput += data.toString();
                },
                stderr: (data) => {
                    lintErrors += data.toString();
                }
            }
        });
        // Store successful lint results
        const lintResult = {
            status: 'success'
        };
        await unified_pr_comment_1.UnifiedPRComment.storeResults('lint', lintResult);
        console.log('Stored lint results for unified comment');
    }
    catch (error) {
        // Capture actual lint output for failed linting
        let lintOutput = '';
        let lintErrors = '';
        try {
            const lintCommand = ['golangci-lint', 'run'];
            if (lintArgs) {
                lintCommand.push(...lintArgs.split(' '));
            }
            await exec.exec(lintCommand[0], lintCommand.slice(1), {
                cwd: workingDir,
                ignoreReturnCode: true, // Don't throw on non-zero exit
                listeners: {
                    stdout: (data) => {
                        lintOutput += data.toString();
                    },
                    stderr: (data) => {
                        lintErrors += data.toString();
                    }
                }
            });
        }
        catch (captureError) {
            // If we can't capture output, use the original error
        }
        // Store failure results with actual lint issues
        const issueOutput = lintOutput || lintErrors || 'No specific issues captured - check workflow logs';
        const lintResult = {
            status: 'failure',
            error: 'Linting issues found',
            issues: issueOutput.trim()
        };
        await unified_pr_comment_1.UnifiedPRComment.storeResults('lint', lintResult);
        throw error;
    }
}
// Default export for simple function call
async function default_1() {
    const inputs = {
        job: process.env.INPUT_JOB || 'test',
        goVersion: process.env.INPUT_GO_VERSION,
        goVersionFile: process.env.INPUT_GO_VERSION_FILE,
        workingDirectory: process.env.INPUT_WORKING_DIRECTORY,
        testArgs: process.env.INPUT_TEST_ARGS,
        golangciLintVersion: process.env.INPUT_GOLANGCI_LINT_VERSION,
        lintArgs: process.env.INPUT_LINT_ARGS,
        benchmarkArgs: process.env.INPUT_BENCHMARK_ARGS,
        benchmarkCount: process.env.INPUT_BENCHMARK_COUNT ? parseInt(process.env.INPUT_BENCHMARK_COUNT) : undefined,
    };
    await runCIJob(inputs);
}
//# sourceMappingURL=action-ci.js.map