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
    /**
     * Extracts the coverage percentage from go tool cover output
     * Replaces shell piping: grep total | awk '{print $3}'
     */
    private extractCoverageFromOutput;
}
export declare function extractCoverage(workingDirectory?: string, coverageFile?: string): CoverageResult;
export {};
