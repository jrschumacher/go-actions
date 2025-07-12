import * as fs from 'fs';
import * as path from 'path';

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

export class ReleasePleaseValidator {
  private workingDir: string;

  constructor(workingDir: string = '.') {
    this.workingDir = workingDir;
  }

  private fileExists(filePath: string): boolean {
    return fs.existsSync(path.join(this.workingDir, filePath));
  }

  public validate(): ReleasePleaseValidationResult {
    const errors: ReleasePleaseValidationError[] = [];

    // Validate config file (release-please-config.json - no dot prefix)
    this.validateConfigFile(errors);
    
    // Validate manifest file (.release-please-manifest.json - with dot prefix)  
    this.validateManifestFile(errors);

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private validateConfigFile(errors: ReleasePleaseValidationError[]): void {
    const correctFilename = 'release-please-config.json';
    const incorrectFilename = '.release-please-config.json';

    if (!this.fileExists(correctFilename)) {
      // Check for common mistake (with dot prefix)
      if (this.fileExists(incorrectFilename)) {
        errors.push({
          type: 'filename_error',
          message: `Found ${incorrectFilename} but Release Please expects ${correctFilename} (no dot prefix)`,
          file: correctFilename,
          severity: 'error'
        });
      } else {
        errors.push({
          type: 'missing_file',
          message: `${correctFilename} (required for release action)`,
          file: correctFilename,
          severity: 'error'
        });
      }
      return;
    }

    // Validate configuration format
    try {
      const configPath = path.join(this.workingDir, correctFilename);
      const configContent = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configContent);

      // Check for v16+ format (release-type at root level)
      if (!config['release-type']) {
        if (config.packages && config.packages['.'] && config.packages['.']['release-type']) {
          errors.push({
            type: 'format_error',
            message: 'Release Please configuration uses legacy format. Move release-type to root level for v16+ compatibility',
            file: correctFilename,
            severity: 'warning'
          });
        } else {
          errors.push({
            type: 'format_error',
            message: 'Release Please config should use "release-type": "go" for Go projects',
            file: correctFilename,
            severity: 'error'
          });
        }
      }

      // Check for package-name at root level
      if (!config['package-name']) {
        if (config.packages && config.packages['.'] && config.packages['.']['package-name']) {
          errors.push({
            type: 'format_error',
            message: 'Release Please configuration uses legacy format. Move package-name to root level for v16+ compatibility',
            file: correctFilename,
            severity: 'warning'
          });
        } else {
          errors.push({
            type: 'format_error',
            message: 'Release Please config missing "package-name" field',
            file: correctFilename,
            severity: 'error'
          });
        }
      }

    } catch (error) {
      errors.push({
        type: 'invalid_json',
        message: `Invalid JSON in ${correctFilename}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        file: correctFilename,
        severity: 'error'
      });
    }
  }

  private validateManifestFile(errors: ReleasePleaseValidationError[]): void {
    const correctFilename = '.release-please-manifest.json';
    const incorrectFilename = 'release-please-manifest.json';

    if (!this.fileExists(correctFilename)) {
      // Check for common mistake (without dot prefix)
      if (this.fileExists(incorrectFilename)) {
        errors.push({
          type: 'filename_error',
          message: `Found ${incorrectFilename} but Release Please expects ${correctFilename} (with dot prefix)`,
          file: correctFilename,
          severity: 'error'
        });
      } else {
        errors.push({
          type: 'missing_file',
          message: `${correctFilename} (required for release action)`,
          file: correctFilename,
          severity: 'error'
        });
      }
    }
  }

  public generateConfigTemplate(): string {
    return JSON.stringify({
      'release-type': 'go',
      'package-name': 'your-module-name',
      packages: {
        '.': {}
      }
    }, null, 2);
  }

  public generateManifestTemplate(): string {
    return JSON.stringify({ '.': '0.1.0' }, null, 2);
  }
}