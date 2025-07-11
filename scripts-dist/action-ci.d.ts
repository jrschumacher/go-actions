export type CIJobType = 'test' | 'lint' | 'benchmark';
export interface CIJobInputs {
    job: CIJobType;
    goVersion?: string;
    goVersionFile?: string;
    workingDirectory?: string;
    testArgs?: string;
    golangciLintVersion?: string;
    lintArgs?: string;
    benchmarkArgs?: string;
    benchmarkCount?: number;
}
/**
 * Runs the specified CI job (test, lint, or benchmark)
 * Consolidates all CI logic in one place for better testing and maintenance
 */
export declare function runCIJob(inputs: CIJobInputs): Promise<void>;
export default function (): Promise<void>;
