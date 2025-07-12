import * as fs from 'fs';
import * as path from 'path';
import { ReleasePleaseValidator } from './release-please-validator';

export interface ReleaseValidationResult {
  isValid: boolean;
  missingFiles: string[];
}

interface ReleaseValidationOptions {
  workingDirectory: string;
}

export class ReleaseValidator {
  private workingDir: string;

  constructor(options: ReleaseValidationOptions) {
    this.workingDir = options.workingDirectory;
  }

  private fileExists(filePath: string): boolean {
    return fs.existsSync(path.join(this.workingDir, filePath));
  }

  public validate(): ReleaseValidationResult {
    console.log(`Checking for Release Please files in directory: ${this.workingDir}`);
    console.log(`Full path: ${path.resolve(this.workingDir)}`);

    const validator = new ReleasePleaseValidator(this.workingDir);
    const result = validator.validate();

    const missingFiles: string[] = [];

    // Log validation results and convert to legacy format
    for (const error of result.errors) {
      const severity = error.severity === 'warning' ? '::warning::' : '::error::';
      console.log(`${severity}${error.message}`);
      
      if (error.type === 'filename_error') {
        console.log(`Please rename the file as indicated above`);
        missingFiles.push(`${error.file} (incorrect filename)`);
      } else if (error.type === 'format_error') {
        missingFiles.push(`${error.file} (format update needed)`);
      } else if (error.type === 'invalid_json') {
        missingFiles.push(`${error.file} (invalid JSON)`);
      } else {
        missingFiles.push(error.file);
      }
    }

    if (!result.isValid) {
      console.log(`::error::Missing required Release Please configuration files: ${missingFiles.join(', ')}`);
      console.log('');
      console.log('Create release-please-config.json (Release Please v16+ format):');
      console.log(validator.generateConfigTemplate());
      console.log('');
      console.log('Create .release-please-manifest.json:');
      console.log(validator.generateManifestTemplate());
      
      return { isValid: false, missingFiles };
    }

    console.log('✅ Release Please configuration is valid');
    return { isValid: true, missingFiles: [] };
  }
}

// Main execution for github-script
export function validateRelease(workingDirectory: string = '.'): ReleaseValidationResult {
  const validator = new ReleaseValidator({ workingDirectory });
  return validator.validate();
}