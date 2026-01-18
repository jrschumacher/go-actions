/**
 * golangci-lint JSON output structure
 * Based on https://golangci-lint.run/usage/configuration/#output-configuration
 */
export interface GolangciLintIssue {
    FromLinter: string;
    Text: string;
    Severity?: string;
    SourceLines?: string[];
    Replacement?: {
        NeedOnlyDelete?: boolean;
        NewLines?: string[];
        Inline?: {
            StartCol: number;
            Length: number;
        };
    };
    Pos: {
        Filename: string;
        Offset: number;
        Line: number;
        Column: number;
    };
    ExpectNoLint?: boolean;
    ExpectedNoLintLinter?: string;
}
export interface GolangciLintReport {
    Issues: GolangciLintIssue[] | null;
    Report?: {
        Warnings?: string[];
        Linters?: Record<string, unknown>;
    };
}
/**
 * Grouped lint issues for display
 */
export interface GroupedLintIssues {
    linterName: string;
    count: number;
    issues: Array<{
        file: string;
        line: number;
        column: number;
        message: string;
    }>;
}
/**
 * Configuration for formatting lint output
 */
export interface FormatOptions {
    /**
     * Maximum number of issues to show per linter before truncating
     * @default 10
     */
    maxIssuesPerLinter?: number;
    /**
     * Maximum total number of issues to show before truncating entirely
     * @default 50
     */
    maxTotalIssues?: number;
    /**
     * Whether to use collapsible sections for each linter
     * @default true
     */
    useCollapsible?: boolean;
    /**
     * Link to full workflow logs
     */
    workflowLogsUrl?: string;
}
/**
 * Parses golangci-lint JSON output file
 *
 * @param jsonFilePath - Path to golangci-lint JSON output file
 * @returns Parsed report object or null if file doesn't exist/is invalid
 */
export declare function parseLintOutput(jsonFilePath: string): GolangciLintReport | null;
/**
 * Groups lint issues by linter name
 *
 * @param issues - Array of golangci-lint issues
 * @returns Map of linter name to grouped issues
 */
export declare function groupIssuesByLinter(issues: GolangciLintIssue[]): Map<string, GroupedLintIssues>;
/**
 * Formats grouped lint issues into markdown for PR comments
 *
 * @param groupedIssues - Map of linter name to grouped issues
 * @param options - Formatting options
 * @returns Formatted markdown string
 */
export declare function formatGroupedIssues(groupedIssues: Map<string, GroupedLintIssues>, options?: FormatOptions): string;
/**
 * Main function to format lint output for PR comments
 *
 * @param jsonFilePath - Path to golangci-lint JSON output file
 * @param options - Formatting options
 * @returns Formatted markdown string ready for PR comment, or null if no issues
 */
export declare function formatLintOutputForPR(jsonFilePath: string, options?: FormatOptions): string | null;
/**
 * Extracts GitHub Actions workflow run URL for linking to logs
 *
 * @returns Workflow run URL or undefined if not in GitHub Actions
 */
export declare function getWorkflowLogsUrl(): string | undefined;
