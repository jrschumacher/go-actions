export interface CoverageResult {
    coverage: string | null;
    hasCoverage: boolean;
    percentage?: number;
    meetsThreshold?: boolean;
}
interface CoverageOptions {
    workingDirectory: string;
    coverageFile?: string;
    threshold?: number;
}
export declare class CoverageExtractor {
    private workingDir;
    private coverageFile;
    private threshold;
    constructor(options: CoverageOptions);
    extractCoverage(): CoverageResult;
    /**
     * Extracts the coverage percentage from go tool cover output
     * Replaces shell piping: grep total | awk '{print $3}'
     */
    private extractCoverageFromOutput;
    /**
     * Parse coverage percentage string to number
     * @param coverage Coverage string (e.g., "85.3%")
     * @returns Numeric percentage or null if parsing fails
     */
    private parseCoveragePercentage;
}
export declare function extractCoverage(workingDirectory?: string, coverageFile?: string, threshold?: number): CoverageResult;
export {};
