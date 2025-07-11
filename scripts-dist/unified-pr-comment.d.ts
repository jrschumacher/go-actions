export interface CIResults {
    test?: {
        status: 'success' | 'failure' | 'skipped';
        coverage?: string;
        error?: string;
    };
    lint?: {
        status: 'success' | 'failure' | 'skipped';
        error?: string;
        issues?: string;
    };
    benchmark?: {
        status: 'success' | 'failure' | 'skipped';
        config?: {
            args: string;
            count: number;
        };
        error?: string;
    };
    selfValidate?: {
        status: 'success' | 'failure' | 'skipped';
        actionsFound: string[];
        errors: Array<{
            type: string;
            message: string;
        }>;
    };
}
export interface PRCommentOptions {
    workingDirectory?: string;
    commentId?: string;
}
export declare class UnifiedPRComment {
    private workingDirectory;
    constructor(options?: PRCommentOptions);
    updateComment(results: CIResults): Promise<void>;
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
    static storeResults(jobType: keyof CIResults, jobResults: any): Promise<void>;
    static loadStoredResults(): Promise<CIResults>;
}
export declare function updateUnifiedComment(results: CIResults, options?: PRCommentOptions): Promise<void>;
export declare function storeJobResults(jobType: keyof CIResults, jobResults: any): Promise<void>;
export declare function loadAllResults(): Promise<CIResults>;
