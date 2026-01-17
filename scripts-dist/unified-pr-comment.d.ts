/** Base interface for all job result types */
interface BaseJobResult {
    status: 'success' | 'failure' | 'skipped';
    error?: string;
}
/** Test job result type */
export interface TestJobResult extends BaseJobResult {
    coverage?: string;
}
/** Lint job result type */
export interface LintJobResult extends BaseJobResult {
    issues?: string;
}
/** Benchmark job result type */
export interface BenchmarkJobResult extends BaseJobResult {
    config?: {
        args: string;
        count: number;
    };
}
/** Self-validate job result type */
export interface SelfValidateJobResult extends BaseJobResult {
    actionsFound: string[];
    errors: Array<{
        type: string;
        message: string;
    }>;
}
/** Combined CI results interface */
export interface CIResults {
    test?: TestJobResult;
    lint?: LintJobResult;
    benchmark?: BenchmarkJobResult;
    selfValidate?: SelfValidateJobResult;
}
/**
 * Type-safe mapping from job type to its result type
 * Used for storeResults and storeJobResults functions
 */
export type JobResultType<T extends keyof CIResults> = T extends 'test' ? TestJobResult : T extends 'lint' ? LintJobResult : T extends 'benchmark' ? BenchmarkJobResult : T extends 'selfValidate' ? SelfValidateJobResult : never;
export interface PRCommentOptions {
    workingDirectory?: string;
    commentId?: string;
}
export declare class UnifiedPRComment {
    private workingDirectory;
    constructor(options?: PRCommentOptions);
    updateComment(results: CIResults): Promise<void>;
    setProcessingState(): Promise<void>;
    private upsertComment;
    private formatUnifiedComment;
    private getOverallStatus;
    private formatSummaryTable;
    private formatTestSection;
    private formatLintSection;
    private formatBenchmarkSection;
    private formatSelfValidateSection;
    private formatValidationDetails;
    private formatTestDetails;
    private formatLintDetails;
    private formatBenchmarkDetails;
    private formatEmptyComment;
    private formatProcessingComment;
    static storeResults<T extends keyof CIResults>(jobType: T, jobResults: JobResultType<T>): Promise<void>;
    static loadStoredResults(): Promise<CIResults>;
}
export declare function updateUnifiedComment(results: CIResults, options?: PRCommentOptions): Promise<void>;
export declare function setProcessingState(options?: PRCommentOptions): Promise<void>;
export declare function storeJobResults<T extends keyof CIResults>(jobType: T, jobResults: JobResultType<T>): Promise<void>;
export declare function loadAllResults(): Promise<CIResults>;
export {};
