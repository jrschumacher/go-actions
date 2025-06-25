import { ReleaseValidationResult } from './validate-release';
export interface ReleaseActionOptions {
    workingDirectory?: string;
}
export declare class ReleaseAction {
    private workingDirectory;
    constructor(options?: ReleaseActionOptions);
    validateConfiguration(): ReleaseValidationResult;
    getInputs(): {
        goVersion: string;
        goVersionFile: string;
        workingDirectory: string;
        releaseToken: string;
    };
    validateInputs(): {
        goVersion: string;
        goVersionFile: string;
        workingDirectory: string;
        releaseToken: string;
    };
    setOutputs(releaseCreated?: boolean, releaseTag?: string): void;
}
export declare function validateReleaseConfiguration(workingDirectory?: string): ReleaseValidationResult;
export declare function validateReleaseInputs(): {
    goVersion: string;
    goVersionFile: string;
    workingDirectory: string;
    releaseToken: string;
};
