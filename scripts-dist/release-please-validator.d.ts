export interface ReleasePleaseValidationResult {
    isValid: boolean;
    errors: ReleasePleaseValidationError[];
}
export interface ReleasePleaseValidationError {
    type: 'missing_file' | 'invalid_json' | 'format_error' | 'filename_error';
    message: string;
    file: string;
    severity?: 'error' | 'warning';
}
export declare class ReleasePleaseValidator {
    private workingDir;
    constructor(workingDir?: string);
    private fileExists;
    validate(): ReleasePleaseValidationResult;
    private validateConfigFile;
    private validateManifestFile;
    generateConfigTemplate(): string;
    generateManifestTemplate(): string;
}
