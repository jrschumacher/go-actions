import { CoverageResult } from './coverage-extractor';
import { BenchmarkResult } from './benchmark-runner';
export interface CIActionOptions {
    workingDirectory?: string;
    job?: string;
    benchmarkArgs?: string;
    benchmarkCount?: number;
}
export declare class CIAction {
    private workingDirectory;
    private job;
    private benchmarkArgs;
    private benchmarkCount;
    constructor(options?: CIActionOptions);
    extractTestCoverage(): Promise<CoverageResult>;
    runBenchmarks(): Promise<BenchmarkResult>;
    getInputs(): {
        job: string;
        workingDirectory: string;
        benchmarkArgs: string;
        benchmarkCount: number;
    };
}
export declare function extractTestCoverage(workingDirectory?: string): Promise<CoverageResult>;
export declare function runBenchmarkJob(workingDirectory?: string, benchmarkArgs?: string, benchmarkCount?: number): Promise<BenchmarkResult>;
