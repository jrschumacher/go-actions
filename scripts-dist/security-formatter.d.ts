/**
 * Vulnerability from govulncheck JSON output
 */
export interface GovulncheckVulnerability {
    osv: {
        id: string;
        aliases?: string[];
        summary: string;
        details?: string;
        severity?: Array<{
            type: string;
            score: string;
        }>;
        references?: Array<{
            type: string;
            url: string;
        }>;
    };
    modules: Array<{
        path: string;
        found_version: string;
        fixed_version?: string;
        packages?: Array<{
            path: string;
            callstacks?: Array<{
                summary: string;
            }>;
        }>;
    }>;
}
/**
 * Parsed vulnerability with all relevant information
 */
export interface ParsedVulnerability {
    id: string;
    aliases: string[];
    summary: string;
    severity?: string;
    module: string;
    foundVersion: string;
    fixedVersion?: string;
    referenceUrl?: string;
    callstackSummary?: string;
}
/**
 * Options for formatting security output
 */
export interface SecurityFormatOptions {
    maxVulnerabilities?: number;
    workflowLogsUrl?: string;
}
/**
 * Result of formatting security output
 */
export interface SecurityFormatResult {
    markdown: string;
    count: number;
    vulnerabilities: ParsedVulnerability[];
}
/**
 * Parse govulncheck JSON output (newline-delimited JSON messages)
 */
export declare function parseGovulncheckJson(jsonContent: string): ParsedVulnerability[];
/**
 * Parse govulncheck text output as fallback
 */
export declare function parseGovulncheckText(textContent: string): ParsedVulnerability[];
/**
 * Format govulncheck output for PR comment
 */
export declare function formatSecurityOutputForPR(jsonFilePath: string, textFilePath: string, options?: SecurityFormatOptions): SecurityFormatResult | null;
/**
 * Get workflow logs URL for GitHub Actions
 */
export declare function getWorkflowLogsUrl(): string;
