import { validateRelease, ReleaseValidationResult } from './validate-release';
import * as core from '@actions/core';

export interface ReleaseActionOptions {
  workingDirectory?: string;
}

export class ReleaseAction {
  private workingDirectory: string;

  constructor(options: ReleaseActionOptions = {}) {
    this.workingDirectory = options.workingDirectory || '.';
  }

  validateConfiguration(): ReleaseValidationResult {
    console.log('Validating Release Please configuration...');
    
    const result = validateRelease(this.workingDirectory);
    
    if (!result.isValid) {
      const missingFiles = result.missingFiles.join(', ');
      const message = `Missing required Release Please configuration files: ${missingFiles}`;
      
      core.setFailed(message);
      
      // Log helpful setup instructions
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
      console.log(JSON.stringify({
        '.': '0.1.0'
      }, null, 2));
      
      throw new Error(message);
    }
    
    console.log('✅ Release Please configuration is valid');
    return result;
  }

  getInputs() {
    return {
      goVersion: core.getInput('go-version'),
      goVersionFile: core.getInput('go-version-file') || 'go.mod',
      workingDirectory: core.getInput('working-directory') || '.',
      releaseToken: core.getInput('release-token')
    };
  }

  validateInputs() {
    const inputs = this.getInputs();
    
    if (!inputs.releaseToken) {
      const message = 'release-token is required. Please provide a Personal Access Token (PAT) as a secret.';
      core.setFailed(message);
      throw new Error(message);
    }

    console.log('Inputs validated:');
    console.log(`- Go version: ${inputs.goVersion || 'from ' + inputs.goVersionFile}`);
    console.log(`- Working directory: ${inputs.workingDirectory}`);
    console.log('- Release token: [REDACTED]');
    
    return inputs;
  }

  setOutputs(releaseCreated: boolean = false, releaseTag?: string) {
    core.setOutput('release_created', releaseCreated.toString());
    if (releaseTag) {
      core.setOutput('release_tag', releaseTag);
    }
    
    console.log(`Set outputs: release_created=${releaseCreated}, release_tag=${releaseTag || 'N/A'}`);
  }
}

// Export function for direct use
export function validateReleaseConfiguration(workingDirectory?: string): ReleaseValidationResult {
  const action = new ReleaseAction({ workingDirectory });
  return action.validateConfiguration();
}

// Export function for input validation
export function validateReleaseInputs() {
  const action = new ReleaseAction();
  return action.validateInputs();
}