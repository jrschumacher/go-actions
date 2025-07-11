import { CoverageResult } from './coverage-extractor';
import { BenchmarkResult } from './benchmark-runner';
export interface CIActionOptions {
    workingDirectory?: string;
    job?: string;
    testArgs?: string;
    golangciLintVersion?: string;
    lintArgs?: string;
    benchmarkArgs?: string;
    benchmarkCount?: number;
}
export declare class CIAction {
    private workingDirectory;
    private job;
    private testArgs;
    private golangciLintVersion;
    private lintArgs;
    private benchmarkArgs;
    private benchmarkCount;
    constructor(options?: CIActionOptions);
    /**
     * Validates that the job type is valid
     */
    private validateJob;
    extractTestCoverage(): Promise<CoverageResult>;
    runBenchmarks(): Promise<BenchmarkResult>;
    /**
     * Handles lint job result storage
     */
    storeLintResults(lintOutcome: string): Promise<void>;
    /**
     * Gets the golangci-lint version for this job
     */
    getGolangciLintVersion(): string;
    /**
     * Gets the lint args for this job
     */
    getLintArgs(): string;
    /**
     * Gets the test args for this job
     */
    getTestArgs(): string;
    /**
     * Logs the current job configuration
     */
    logConfiguration(): void;
    getInputs(): {
        job: string;
        workingDirectory: string;
        testArgs: string;
        golangciLintVersion: string;
        lintArgs: string;
        benchmarkArgs: string;
        benchmarkCount: number;
    };
}
export declare function extractTestCoverage(workingDirectory?: string): Promise<CoverageResult>;
export declare function runBenchmarkJob(workingDirectory?: string, benchmarkArgs?: string, benchmarkCount?: number): Promise<BenchmarkResult>;
export declare function storeLintResults(lintOutcome: string, workingDirectory?: string): Promise<void>;
export declare function validateJobInput(job: string): string;
