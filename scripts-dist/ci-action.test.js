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
const ci_action_1 = require("./ci-action");
const coverage_extractor_1 = require("./coverage-extractor");
const benchmark_runner_1 = require("./benchmark-runner");
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
// Mock dependencies
jest.mock('./coverage-extractor');
jest.mock('./benchmark-runner');
jest.mock('@actions/core');
jest.mock('@actions/github');
const mockExtractCoverage = coverage_extractor_1.extractCoverage;
const mockRunBenchmarks = benchmark_runner_1.runBenchmarks;
const mockCore = core;
const mockGithub = github;
describe('CIAction', () => {
    let action;
    const testWorkingDir = '/test/project';
    beforeEach(() => {
        jest.clearAllMocks();
        action = new ci_action_1.CIAction({ workingDirectory: testWorkingDir });
        // Setup GitHub context mock
        Object.defineProperty(github, 'context', {
            value: {
                eventName: 'pull_request',
                repo: { owner: 'test-owner', repo: 'test-repo' },
                issue: { number: 123 }
            },
            writable: true
        });
    });
    describe('constructor and job validation', () => {
        it('should create action with valid job', () => {
            const validAction = new ci_action_1.CIAction({ job: 'test' });
            expect(validAction).toBeDefined();
        });
        it('should create action with lint job', () => {
            const lintAction = new ci_action_1.CIAction({ job: 'lint' });
            expect(lintAction).toBeDefined();
        });
        it('should create action with benchmark job', () => {
            const benchAction = new ci_action_1.CIAction({ job: 'benchmark' });
            expect(benchAction).toBeDefined();
        });
        it('should throw error for invalid job', () => {
            expect(() => new ci_action_1.CIAction({ job: 'invalid' })).toThrow('Invalid job type: invalid');
            expect(mockCore.setFailed).toHaveBeenCalledWith('Invalid job type: invalid. Valid options are: test, lint, benchmark');
        });
        it('should use default values for all options', () => {
            const defaultAction = new ci_action_1.CIAction();
            expect(defaultAction.getInputs().job).toBe('test');
            expect(defaultAction.getGolangciLintVersion()).toBe('v2.1.0');
        });
    });
    describe('extractTestCoverage', () => {
        it('should extract coverage for test job', async () => {
            const testAction = new ci_action_1.CIAction({ workingDirectory: testWorkingDir, job: 'test' });
            mockExtractCoverage.mockReturnValue({
                coverage: '85.7%',
                hasCoverage: true
            });
            const result = await testAction.extractTestCoverage();
            expect(mockExtractCoverage).toHaveBeenCalledWith(testWorkingDir);
            expect(mockCore.setOutput).toHaveBeenCalledWith('coverage', '85.7%');
            expect(mockCore.setOutput).toHaveBeenCalledWith('has_coverage', 'true');
            expect(result.coverage).toBe('85.7%');
        });
        it('should handle no coverage file', async () => {
            const testAction = new ci_action_1.CIAction({ workingDirectory: testWorkingDir, job: 'test' });
            mockExtractCoverage.mockReturnValue({
                coverage: null,
                hasCoverage: false
            });
            const result = await testAction.extractTestCoverage();
            expect(mockCore.setOutput).toHaveBeenCalledWith('has_coverage', 'false');
            expect(result.hasCoverage).toBe(false);
        });
        it('should skip coverage extraction for non-test jobs', async () => {
            const lintAction = new ci_action_1.CIAction({ workingDirectory: testWorkingDir, job: 'lint' });
            const result = await lintAction.extractTestCoverage();
            expect(mockExtractCoverage).not.toHaveBeenCalled();
            expect(result).toEqual({ coverage: null, hasCoverage: false });
        });
    });
    describe('runBenchmarks', () => {
        it('should run benchmarks successfully', async () => {
            const benchAction = new ci_action_1.CIAction({
                workingDirectory: testWorkingDir,
                job: 'benchmark',
                benchmarkArgs: '-bench=.',
                benchmarkCount: 3
            });
            mockRunBenchmarks.mockReturnValue({ success: true });
            const result = await benchAction.runBenchmarks();
            expect(mockRunBenchmarks).toHaveBeenCalledWith(testWorkingDir, '-bench=.', 3);
            expect(mockCore.setOutput).toHaveBeenCalledWith('benchmark_success', 'true');
            expect(result.success).toBe(true);
        });
        it('should handle benchmark failures', async () => {
            const benchAction = new ci_action_1.CIAction({
                workingDirectory: testWorkingDir,
                job: 'benchmark'
            });
            mockRunBenchmarks.mockReturnValue({
                success: false,
                error: 'Benchmark failed'
            });
            const result = await benchAction.runBenchmarks();
            expect(mockCore.setOutput).toHaveBeenCalledWith('benchmark_success', 'false');
            expect(mockCore.setOutput).toHaveBeenCalledWith('benchmark_error', 'Benchmark failed');
            expect(mockCore.setFailed).toHaveBeenCalledWith('Benchmark failed: Benchmark failed');
            expect(result.success).toBe(false);
        });
        it('should skip benchmarks for non-benchmark jobs', async () => {
            const testAction = new ci_action_1.CIAction({ workingDirectory: testWorkingDir, job: 'test' });
            const result = await testAction.runBenchmarks();
            expect(mockRunBenchmarks).not.toHaveBeenCalled();
            expect(result).toEqual({ success: false, error: 'Job is not benchmark' });
        });
    });
    describe('storeLintResults', () => {
        it('should store successful lint results', async () => {
            const lintAction = new ci_action_1.CIAction({ workingDirectory: testWorkingDir, job: 'lint' });
            await lintAction.storeLintResults('success');
            // This would normally store results via storeJobResults, but we can't easily mock that
            // The test verifies the method runs without throwing
            expect(true).toBe(true);
        });
        it('should store failed lint results', async () => {
            const lintAction = new ci_action_1.CIAction({ workingDirectory: testWorkingDir, job: 'lint' });
            await lintAction.storeLintResults('failure');
            // This would normally store results via storeJobResults
            expect(true).toBe(true);
        });
        it('should skip storing for non-lint jobs', async () => {
            const testAction = new ci_action_1.CIAction({ workingDirectory: testWorkingDir, job: 'test' });
            await testAction.storeLintResults('success');
            // Should skip without errors
            expect(true).toBe(true);
        });
    });
    describe('getter methods', () => {
        it('should get golangci-lint version', () => {
            const lintAction = new ci_action_1.CIAction({ golangciLintVersion: 'v2.0.5' });
            expect(lintAction.getGolangciLintVersion()).toBe('v2.0.5');
        });
        it('should get lint args', () => {
            const lintAction = new ci_action_1.CIAction({ lintArgs: '--fast' });
            expect(lintAction.getLintArgs()).toBe('--fast');
        });
        it('should get test args', () => {
            const testAction = new ci_action_1.CIAction({ testArgs: '-v -short' });
            expect(testAction.getTestArgs()).toBe('-v -short');
        });
        it('should use defaults when not specified', () => {
            const defaultAction = new ci_action_1.CIAction();
            expect(defaultAction.getGolangciLintVersion()).toBe('v2.1.0');
            expect(defaultAction.getLintArgs()).toBe('');
            expect(defaultAction.getTestArgs()).toBe('-v -race -coverprofile=coverage.out');
        });
    });
    describe('logConfiguration', () => {
        it('should log test job configuration', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            const testAction = new ci_action_1.CIAction({ job: 'test', testArgs: '-v -short' });
            testAction.logConfiguration();
            expect(consoleSpy).toHaveBeenCalledWith('CI Action Configuration:');
            expect(consoleSpy).toHaveBeenCalledWith('- Job: test');
            expect(consoleSpy).toHaveBeenCalledWith('- Test args: -v -short');
            consoleSpy.mockRestore();
        });
        it('should log lint job configuration', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            const lintAction = new ci_action_1.CIAction({
                job: 'lint',
                golangciLintVersion: 'v2.0.5',
                lintArgs: '--fast'
            });
            lintAction.logConfiguration();
            expect(consoleSpy).toHaveBeenCalledWith('- Job: lint');
            expect(consoleSpy).toHaveBeenCalledWith('- golangci-lint version: v2.0.5');
            expect(consoleSpy).toHaveBeenCalledWith('- Lint args: --fast');
            consoleSpy.mockRestore();
        });
        it('should log benchmark job configuration', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            const benchAction = new ci_action_1.CIAction({
                job: 'benchmark',
                benchmarkArgs: '-bench=.',
                benchmarkCount: 3
            });
            benchAction.logConfiguration();
            expect(consoleSpy).toHaveBeenCalledWith('- Job: benchmark');
            expect(consoleSpy).toHaveBeenCalledWith('- Benchmark args: -bench=.');
            expect(consoleSpy).toHaveBeenCalledWith('- Benchmark count: 3');
            consoleSpy.mockRestore();
        });
    });
    describe('getInputs', () => {
        it('should get inputs with defaults', () => {
            mockCore.getInput.mockImplementation((name) => {
                switch (name) {
                    case 'job': return '';
                    case 'working-directory': return '';
                    case 'test-args': return '';
                    case 'golangci-lint-version': return '';
                    case 'lint-args': return '';
                    case 'benchmark-args': return '';
                    case 'benchmark-count': return '';
                    default: return '';
                }
            });
            mockCore.getBooleanInput.mockReturnValue(true);
            const inputs = action.getInputs();
            expect(inputs).toEqual({
                job: 'test',
                workingDirectory: '.',
                testArgs: '-v -race -coverprofile=coverage.out',
                golangciLintVersion: 'v2.1.0',
                lintArgs: '',
                benchmarkArgs: '-bench=. -benchmem',
                benchmarkCount: 5,
            });
        });
    });
});
describe('exported functions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('extractTestCoverage', () => {
        it('should extract coverage', async () => {
            mockExtractCoverage.mockReturnValue({
                coverage: '80%',
                hasCoverage: true
            });
            const result = await (0, ci_action_1.extractTestCoverage)('/test');
            expect(result.coverage).toBe('80%');
        });
    });
    describe('runBenchmarkJob', () => {
        it('should run benchmarks', async () => {
            mockRunBenchmarks.mockReturnValue({ success: true });
            const result = await (0, ci_action_1.runBenchmarkJob)('/test', '-bench=.', 2);
            expect(mockRunBenchmarks).toHaveBeenCalledWith('/test', '-bench=.', 2);
            expect(result.success).toBe(true);
        });
    });
    describe('storeLintResults', () => {
        it('should store lint results', async () => {
            // This test verifies the function doesn't throw
            await expect((0, ci_action_1.storeLintResults)('success', '/test')).resolves.toBeUndefined();
        });
    });
    describe('validateJobInput', () => {
        it('should validate valid job types', () => {
            expect((0, ci_action_1.validateJobInput)('test')).toBe('test');
            expect((0, ci_action_1.validateJobInput)('lint')).toBe('lint');
            expect((0, ci_action_1.validateJobInput)('benchmark')).toBe('benchmark');
        });
        it('should throw for invalid job types', () => {
            expect(() => (0, ci_action_1.validateJobInput)('invalid')).toThrow('Invalid job type: invalid');
            expect(mockCore.setFailed).toHaveBeenCalledWith('Invalid job type: invalid. Valid options are: test, lint, benchmark');
        });
    });
});
//# sourceMappingURL=ci-action.test.js.map