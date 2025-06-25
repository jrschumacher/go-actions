export interface ReleaseValidationResult {
    isValid: boolean;
    missingFiles: string[];
}
interface ReleaseValidationOptions {
    workingDirectory: string;
}
export declare class ReleaseValidator {
    private workingDir;
    constructor(options: ReleaseValidationOptions);
    private fileExists;
    validate(): ReleaseValidationResult;
}
export declare function validateRelease(workingDirectory?: string): ReleaseValidationResult;
export {};
