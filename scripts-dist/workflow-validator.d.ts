export interface ValidationResult {
    isValid: boolean;
    actionsFound: string[];
    errors: ValidationError[];
}
export interface ValidationError {
    type: 'missing_file' | 'version_mismatch';
    message: string;
    file?: string;
    expected?: string;
    actual?: string;
}
export declare class WorkflowValidator {
    private workingDir;
    constructor(workingDir?: string);
    private fileExists;
    private findWorkflowFiles;
    private extractWorkflowConfig;
    private extractConfigVersion;
    private getMajorVersion;
    validate(): ValidationResult;
    formatPRComment(result: ValidationResult): string;
}
export declare function validateWorkflows(workingDir?: string): ValidationResult;
