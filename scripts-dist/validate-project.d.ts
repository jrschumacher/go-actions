interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}
interface ValidationOptions {
    workingDirectory: string;
}
export declare class ProjectValidator {
    private workingDir;
    constructor(options: ValidationOptions);
    private fileExists;
    private findFiles;
    private hasBenchmarkFunctions;
    validate(): ValidationResult;
}
export declare function validateProject(workingDirectory?: string): ValidationResult;
export {};
