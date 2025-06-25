interface BenchmarkOptions {
    workingDirectory: string;
    benchmarkArgs: string;
    benchmarkCount: number;
}
export interface BenchmarkResult {
    success: boolean;
    error?: string;
}
export declare class BenchmarkRunner {
    private workingDir;
    private benchmarkArgs;
    private benchmarkCount;
    constructor(options: BenchmarkOptions);
    runBenchmarks(): BenchmarkResult;
}
export declare function runBenchmarks(workingDirectory?: string, benchmarkArgs?: string, benchmarkCount?: number): BenchmarkResult;
export {};
