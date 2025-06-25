"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const benchmark_runner_1 = require("./benchmark-runner");
const child_process_1 = require("child_process");
// Mock execSync
jest.mock('child_process');
const mockExecSync = child_process_1.execSync;
describe('BenchmarkRunner', () => {
    let runner;
    const testWorkingDir = '/test/project';
    const testBenchmarkArgs = '-bench=. -benchmem';
    const testBenchmarkCount = 3;
    beforeEach(() => {
        jest.clearAllMocks();
        runner = new benchmark_runner_1.BenchmarkRunner({
            workingDirectory: testWorkingDir,
            benchmarkArgs: testBenchmarkArgs,
            benchmarkCount: testBenchmarkCount
        });
    });
    describe('runBenchmarks', () => {
        it('should run benchmarks successfully', () => {
            mockExecSync.mockReturnValue(Buffer.from('benchmark output'));
            const result = runner.runBenchmarks();
            expect(result).toEqual({ success: true });
            expect(mockExecSync).toHaveBeenCalledTimes(testBenchmarkCount);
            for (let i = 0; i < testBenchmarkCount; i++) {
                expect(mockExecSync).toHaveBeenNthCalledWith(i + 1, `go test ${testBenchmarkArgs} ./...`, {
                    cwd: testWorkingDir,
                    stdio: 'inherit'
                });
            }
        });
        it('should handle benchmark failures', () => {
            const error = new Error('Benchmark failed');
            mockExecSync.mockImplementation(() => {
                throw error;
            });
            const result = runner.runBenchmarks();
            expect(result).toEqual({
                success: false,
                error: 'Benchmark failed'
            });
            expect(mockExecSync).toHaveBeenCalledTimes(1);
        });
        it('should handle unknown errors', () => {
            mockExecSync.mockImplementation(() => {
                throw 'Unknown error type';
            });
            const result = runner.runBenchmarks();
            expect(result).toEqual({
                success: false,
                error: 'Unknown error'
            });
        });
        it('should run correct number of iterations', () => {
            const singleRunRunner = new benchmark_runner_1.BenchmarkRunner({
                workingDirectory: testWorkingDir,
                benchmarkArgs: testBenchmarkArgs,
                benchmarkCount: 1
            });
            mockExecSync.mockReturnValue(Buffer.from(''));
            singleRunRunner.runBenchmarks();
            expect(mockExecSync).toHaveBeenCalledTimes(1);
        });
        it('should handle large number of benchmark runs', () => {
            const manyRunsRunner = new benchmark_runner_1.BenchmarkRunner({
                workingDirectory: testWorkingDir,
                benchmarkArgs: testBenchmarkArgs,
                benchmarkCount: 10
            });
            mockExecSync.mockReturnValue(Buffer.from(''));
            const result = manyRunsRunner.runBenchmarks();
            expect(result.success).toBe(true);
            expect(mockExecSync).toHaveBeenCalledTimes(10);
        });
        it('should use correct benchmark arguments', () => {
            const customArgs = '-bench=BenchmarkSpecific -count=5';
            const customRunner = new benchmark_runner_1.BenchmarkRunner({
                workingDirectory: testWorkingDir,
                benchmarkArgs: customArgs,
                benchmarkCount: 1
            });
            mockExecSync.mockReturnValue(Buffer.from(''));
            customRunner.runBenchmarks();
            expect(mockExecSync).toHaveBeenCalledWith(`go test ${customArgs} ./...`, {
                cwd: testWorkingDir,
                stdio: 'inherit'
            });
        });
        it('should fail on first error and not continue', () => {
            mockExecSync.mockImplementationOnce(() => {
                throw new Error('First run failed');
            });
            const result = runner.runBenchmarks();
            expect(result.success).toBe(false);
            expect(mockExecSync).toHaveBeenCalledTimes(1);
        });
    });
    describe('runBenchmarks function export', () => {
        it('should work with default parameters', () => {
            const { runBenchmarks } = require('./benchmark-runner');
            mockExecSync.mockReturnValue(Buffer.from(''));
            const result = runBenchmarks();
            expect(result.success).toBe(true);
            expect(mockExecSync).toHaveBeenCalledWith('go test -bench=. -benchmem ./...', {
                cwd: '.',
                stdio: 'inherit'
            });
        });
        it('should work with custom parameters', () => {
            const { runBenchmarks } = require('./benchmark-runner');
            mockExecSync.mockReturnValue(Buffer.from(''));
            const result = runBenchmarks('/custom/dir', '-bench=Custom', 2);
            expect(result.success).toBe(true);
            expect(mockExecSync).toHaveBeenCalledTimes(2);
            expect(mockExecSync).toHaveBeenCalledWith('go test -bench=Custom ./...', {
                cwd: '/custom/dir',
                stdio: 'inherit'
            });
        });
    });
});
//# sourceMappingURL=benchmark-runner.test.js.map