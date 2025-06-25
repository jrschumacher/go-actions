export interface CoverageResult {
    coverage: string | null;
    hasCoverage: boolean;
}
interface CoverageOptions {
    workingDirectory: string;
    coverageFile?: string;
}
export declare class CoverageExtractor {
    private workingDir;
    private coverageFile;
    constructor(options: CoverageOptions);
    extractCoverage(): CoverageResult;
}
export declare function extractCoverage(workingDirectory?: string, coverageFile?: string): CoverageResult;
export {};
