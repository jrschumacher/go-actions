export interface ValidationResult {
    isValid: boolean;
    actionsFound: string[];
    errors: ValidationError[];
}
export interface ValidationError {
    type: 'missing_file' | 'version_mismatch' | 'incompatible_versions' | 'goreleaser_config' | 'release_please_config';
    message: string;
    file?: string;
    expected?: string;
    actual?: string;
    severity?: 'error' | 'warning';
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
    private validateGolangciLintAction;
    private validateGoReleaserConfig;
    createUnifiedSection(result: ValidationResult): any;
    formatPRComment(result: ValidationResult): string;
    private groupErrorsByType;
    private getPassingChecks;
    private generateConfigurationTemplates;
}
export declare function validateWorkflows(workingDir?: string): ValidationResult;
export declare function validateWorkflowsForAction(workingDir?: string, workflowPaths?: string, commentOnPr?: boolean): Promise<ValidationResult>;
export default function (workingDir?: string): Promise<ValidationResult>;
