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
exports.CIAction = void 0;
exports.extractTestCoverage = extractTestCoverage;
exports.runBenchmarkJob = runBenchmarkJob;
exports.storeLintResults = storeLintResults;
exports.validateJobInput = validateJobInput;
const coverage_extractor_1 = require("./coverage-extractor");
const benchmark_runner_1 = require("./benchmark-runner");
const unified_pr_comment_1 = require("./unified-pr-comment");
const core = __importStar(require("@actions/core"));
class CIAction {
    constructor(options = {}) {
        this.workingDirectory = options.workingDirectory || '.';
        this.job = this.validateJob(options.job || 'test');
        this.testArgs = options.testArgs || '-v -race -coverprofile=coverage.out';
        this.golangciLintVersion = options.golangciLintVersion || 'v2.1.0';
        this.lintArgs = options.lintArgs || '';
        this.benchmarkArgs = options.benchmarkArgs || '-bench=. -benchmem';
        this.benchmarkCount = options.benchmarkCount || 5;
    }
    /**
     * Validates that the job type is valid
     */
    validateJob(job) {
        const validJobs = ['test', 'lint', 'benchmark'];
        if (!validJobs.includes(job)) {
            const message = `Invalid job type: ${job}. Valid options are: ${validJobs.join(', ')}`;
            core.setFailed(message);
            throw new Error(message);
        }
        return job;
    }
    async extractTestCoverage() {
        if (this.job !== 'test') {
            return { coverage: null, hasCoverage: false };
        }
        console.log('Extracting test coverage...');
        const result = (0, coverage_extractor_1.extractCoverage)(this.workingDirectory);
        if (result.hasCoverage && result.coverage) {
            console.log(`Test coverage: ${result.coverage}`);
            core.setOutput('coverage', result.coverage);
            core.setOutput('has_coverage', 'true');
            // Store results for unified comment
            await (0, unified_pr_comment_1.storeJobResults)('test', {
                status: 'success',
                coverage: result.coverage
            });
        }
        else {
            console.log('No coverage file found');
            core.setOutput('has_coverage', 'false');
            // Store results for unified comment
            await (0, unified_pr_comment_1.storeJobResults)('test', {
                status: 'success'
            });
        }
        return result;
    }
    async runBenchmarks() {
        if (this.job !== 'benchmark') {
            return { success: false, error: 'Job is not benchmark' };
        }
        console.log('Running Go benchmarks...');
        console.log(`Benchmark configuration: ${this.benchmarkArgs}, ${this.benchmarkCount} runs`);
        const result = (0, benchmark_runner_1.runBenchmarks)(this.workingDirectory, this.benchmarkArgs, this.benchmarkCount);
        if (result.success) {
            console.log('✅ Benchmarks completed successfully');
            core.setOutput('benchmark_success', 'true');
            // Store results for unified comment
            await (0, unified_pr_comment_1.storeJobResults)('benchmark', {
                status: 'success',
                config: {
                    args: this.benchmarkArgs,
                    count: this.benchmarkCount
                }
            });
        }
        else {
            console.log(`❌ Benchmarks failed: ${result.error}`);
            core.setOutput('benchmark_success', 'false');
            core.setOutput('benchmark_error', result.error || 'Unknown error');
            core.setFailed(`Benchmark failed: ${result.error}`);
            // Store results for unified comment
            await (0, unified_pr_comment_1.storeJobResults)('benchmark', {
                status: 'failure',
                config: {
                    args: this.benchmarkArgs,
                    count: this.benchmarkCount
                },
                error: result.error
            });
        }
        return result;
    }
    /**
     * Handles lint job result storage
     */
    async storeLintResults(lintOutcome) {
        if (this.job !== 'lint') {
            console.log('Skipping lint result storage - job is not lint');
            return;
        }
        console.log(`Storing lint results with outcome: ${lintOutcome}`);
        const lintResult = {
            status: lintOutcome === 'success' ? 'success' : 'failure',
            error: lintOutcome !== 'success' ? 'Linting issues found - check logs for details' : undefined
        };
        await (0, unified_pr_comment_1.storeJobResults)('lint', lintResult);
        console.log('✅ Lint results stored for unified comment');
    }
    /**
     * Gets the golangci-lint version for this job
     */
    getGolangciLintVersion() {
        return this.golangciLintVersion;
    }
    /**
     * Normalizes golangci-lint version for compatibility with golangci-lint-action@v8
     * Converts generic v2/latest to specific v2.1.0
     */
    normalizeGolangciLintVersion(version) {
        const versionToNormalize = version || this.golangciLintVersion;
        if (versionToNormalize === 'v2' || versionToNormalize === 'latest') {
            return 'v2.1.0';
        }
        return versionToNormalize;
    }
    /**
     * Gets the lint args for this job
     */
    getLintArgs() {
        return this.lintArgs;
    }
    /**
     * Gets the test args for this job
     */
    getTestArgs() {
        return this.testArgs;
    }
    /**
     * Logs the current job configuration
     */
    logConfiguration() {
        console.log('CI Action Configuration:');
        console.log(`- Job: ${this.job}`);
        console.log(`- Working directory: ${this.workingDirectory}`);
        if (this.job === 'test') {
            console.log(`- Test args: ${this.testArgs}`);
        }
        else if (this.job === 'lint') {
            console.log(`- golangci-lint version: ${this.golangciLintVersion}`);
            console.log(`- Lint args: ${this.lintArgs || 'default'}`);
        }
        else if (this.job === 'benchmark') {
            console.log(`- Benchmark args: ${this.benchmarkArgs}`);
            console.log(`- Benchmark count: ${this.benchmarkCount}`);
        }
    }
    getInputs() {
        return {
            job: core.getInput('job') || 'test',
            workingDirectory: core.getInput('working-directory') || '.',
            testArgs: core.getInput('test-args') || '-v -race -coverprofile=coverage.out',
            golangciLintVersion: core.getInput('golangci-lint-version') || 'v2.1.0',
            lintArgs: core.getInput('lint-args') || '',
            benchmarkArgs: core.getInput('benchmark-args') || '-bench=. -benchmem',
            benchmarkCount: parseInt(core.getInput('benchmark-count') || '5'),
        };
    }
}
exports.CIAction = CIAction;
// Export functions for direct use
async function extractTestCoverage(workingDirectory) {
    const action = new CIAction({ workingDirectory, job: 'test' });
    return action.extractTestCoverage();
}
async function runBenchmarkJob(workingDirectory, benchmarkArgs, benchmarkCount) {
    const action = new CIAction({
        workingDirectory,
        job: 'benchmark',
        benchmarkArgs,
        benchmarkCount
    });
    return action.runBenchmarks();
}
async function storeLintResults(lintOutcome, workingDirectory) {
    const action = new CIAction({ workingDirectory, job: 'lint' });
    return action.storeLintResults(lintOutcome);
}
function validateJobInput(job) {
    const action = new CIAction({ job });
    return job; // If we get here, validation passed
}
//# sourceMappingURL=ci-action.js.map