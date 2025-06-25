import * as fs from 'fs';
import * as path from 'path';

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
    const missingFiles: string[] = [];

    if (!this.fileExists('.release-please-config.json')) {
      missingFiles.push('.release-please-config.json');
    }

    if (!this.fileExists('.release-please-manifest.json')) {
      missingFiles.push('.release-please-manifest.json');
    }

    if (missingFiles.length > 0) {
      console.log(`::error::Missing required Release Please configuration files: ${missingFiles.join(', ')}`);
      console.log('');
      console.log('Create .release-please-config.json:');
      console.log(JSON.stringify({
        packages: {
          '.': {
            'release-type': 'go',
            'package-name': 'your-module-name'
          }
        }
      }, null, 2));
      console.log('');
      console.log('Create .release-please-manifest.json:');
      console.log(JSON.stringify({ '.': '0.1.0' }, null, 2));
      
      return { isValid: false, missingFiles };
    }

    return { isValid: true, missingFiles: [] };
  }
}

// Main execution for github-script
export function validateRelease(workingDirectory: string = '.'): ReleaseValidationResult {
  const validator = new ReleaseValidator({ workingDirectory });
  return validator.validate();
}