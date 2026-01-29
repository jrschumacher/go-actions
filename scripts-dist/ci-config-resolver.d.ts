/**
 * Resolved CI configuration for a specific job
 */
export interface ResolvedCIConfig {
    goVersion: string;
    goVersionFile: string;
    workingDirectory: string;
    testEnabled: boolean;
    testArgs: string;
    coverageThreshold: number;
    lintEnabled: boolean;
    lintVersion: string;
    lintArgs: string;
    benchmarkEnabled: boolean;
    benchmarkArgs: string;
    benchmarkCount: number;
    securityEnabled: boolean;
    securityVersion: string;
    securityArgs: string;
    securityFailOn: 'critical' | 'high' | 'medium' | 'low' | 'none';
}
/**
 * Workflow inputs from GitHub Actions
 */
export interface WorkflowInputs {
    goVersion?: string;
    goVersionFile?: string;
    workingDirectory?: string;
    testArgs?: string;
    golangciLintVersion?: string;
    lintArgs?: string;
    benchmarkArgs?: string;
    benchmarkCount?: string | number;
    govulncheckVersion?: string;
    securityArgs?: string;
}
/**
 * Resolves CI configuration by merging config file, defaults, and workflow inputs
 */
export declare class CIConfigResolver {
    private config;
    constructor(workingDir: string, workflowInputs?: WorkflowInputs);
    /**
     * Get fully resolved configuration for all CI jobs
     */
    resolve(): ResolvedCIConfig;
    /**
     * Check if a specific job is enabled
     */
    isJobEnabled(job: 'test' | 'lint' | 'benchmark' | 'security'): boolean;
    /**
     * Get coverage threshold
     */
    getCoverageThreshold(): number;
}
/**
 * Convenience function to resolve CI configuration
 */
export declare function resolveCIConfig(workingDir: string, workflowInputs?: WorkflowInputs): ResolvedCIConfig;
/**
 * Convenience function to check if a job is enabled
 */
export declare function isJobEnabled(workingDir: string, job: 'test' | 'lint' | 'benchmark' | 'security', workflowInputs?: WorkflowInputs): boolean;
