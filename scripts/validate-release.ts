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
    
    console.log(`Checking for Release Please files in directory: ${this.workingDir}`);
    console.log(`Full path: ${path.resolve(this.workingDir)}`);

    // Check for correct config filename (no dot prefix)
    if (!this.fileExists('release-please-config.json')) {
      console.log(`Missing: ${path.join(this.workingDir, 'release-please-config.json')}`);
      missingFiles.push('release-please-config.json');
      
      // Check for common mistake (with dot prefix)
      if (this.fileExists('.release-please-config.json')) {
        console.log(`::error::Found .release-please-config.json but Release Please expects release-please-config.json (no dot prefix)`);
        console.log(`Please rename .release-please-config.json to release-please-config.json`);
        missingFiles.push('release-please-config.json (incorrect filename)');
      }
    } else {
      console.log(`Found: release-please-config.json`);
      // Validate configuration format for Release Please v16+
      try {
        const configPath = path.join(this.workingDir, 'release-please-config.json');
        const configContent = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configContent);
        
        if (!config['release-type'] && config.packages && config.packages['.'] && config.packages['.']['release-type']) {
          console.log(`::warning::Release Please configuration uses legacy format. Update for v16+ compatibility.`);
          console.log(`Current format has release-type inside packages, but v16+ expects it at root level.`);
          missingFiles.push('release-please-config.json (format update needed)');
        }
      } catch (error) {
        console.log(`::error::Invalid JSON in release-please-config.json: ${error}`);
        missingFiles.push('release-please-config.json (invalid JSON)');
      }
    }

    if (!this.fileExists('.release-please-manifest.json')) {
      console.log(`Missing: ${path.join(this.workingDir, '.release-please-manifest.json')}`);
      missingFiles.push('.release-please-manifest.json');
    } else {
      console.log(`Found: .release-please-manifest.json`);
    }

    if (missingFiles.length > 0) {
      console.log(`::error::Missing required Release Please configuration files: ${missingFiles.join(', ')}`);
      console.log('');
      console.log('Create release-please-config.json (Release Please v16+ format):');
      console.log(JSON.stringify({
        'release-type': 'go',
        'package-name': 'your-module-name',
        packages: {
          '.': {}
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