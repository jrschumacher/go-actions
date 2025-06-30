import * as fs from 'fs';
import * as path from 'path';

export interface ValidationResult {
  isValid: boolean;
  actionsFound: string[];
  errors: ValidationError[];
}

export interface ValidationError {
  type: 'missing_file' | 'version_mismatch';
  message: string;
  file?: string;
  expected?: string;
  actual?: string;
}

interface WorkflowConfig {
  golangciLintVersion?: string;
}

export class WorkflowValidator {
  private workingDir: string;

  constructor(workingDir: string = '.') {
    this.workingDir = workingDir;
  }

  private fileExists(filePath: string): boolean {
    return fs.existsSync(path.join(this.workingDir, filePath));
  }

  private findWorkflowFiles(): string[] {
    const workflowDir = path.join(this.workingDir, '.github', 'workflows');
    
    if (!fs.existsSync(workflowDir)) {
      return [];
    }
    
    const files = fs.readdirSync(workflowDir);
    return files
      .filter(file => file.endsWith('.yaml') || file.endsWith('.yml'))
      .map(file => path.join(workflowDir, file));
  }

  private extractWorkflowConfig(workflowContent: string, actionName: string): WorkflowConfig {
    const config: WorkflowConfig = {};
    
    // Find the action usage
    const actionRegex = new RegExp(`uses:\\s*jrschumacher/go-actions/${actionName}@`);
    const actionIndex = workflowContent.search(actionRegex);
    
    if (actionIndex === -1) return config;
    
    // Look for golangci-lint-version in the next 10 lines
    const relevantContent = workflowContent.substring(actionIndex).split('\n').slice(0, 10).join('\n');
    
    const versionMatch = relevantContent.match(/golangci-lint-version:\s*["']?([^"'\s]+)["']?/);
    if (versionMatch) {
      config.golangciLintVersion = versionMatch[1];
    }
    
    return config;
  }

  private extractConfigVersion(configFile: string): string | null {
    try {
      const content = fs.readFileSync(path.join(this.workingDir, configFile), 'utf8');
      const match = content.match(/^version:\s*(.+)$/m);
      return match ? match[1].trim() : null;
    } catch {
      return null;
    }
  }

  private getMajorVersion(version: string): string {
    // Handle versions like v2, v1.54.2, 2, 1.54.2
    const match = version.match(/^v?(\d+)/);
    return match ? match[1] : '';
  }

  public validate(): ValidationResult {
    const errors: ValidationError[] = [];
    const actionsFound: Set<string> = new Set();
    
    const workflowFiles = this.findWorkflowFiles();
    
    // Check if this is the go-actions repository itself
    const isGoActionsRepo = this.fileExists('ci/action.yaml') && 
                           this.fileExists('release/action.yaml') && 
                           this.fileExists('self-validate/action.yaml');
    
    if (workflowFiles.length === 0) {
      return { isValid: true, actionsFound: [], errors: [] };
    }
    
    // If this is the go-actions repository itself, skip validation
    // since it's the provider, not a consumer of the actions
    if (isGoActionsRepo) {
      return { isValid: true, actionsFound: [], errors: [] };
    }
    
    for (const workflowFile of workflowFiles) {
      const content = fs.readFileSync(workflowFile, 'utf8');
      
      // Check for CI action
      if (content.includes('jrschumacher/go-actions/ci@')) {
        actionsFound.add('ci');
        
        // Validate go.mod exists
        if (!this.fileExists('go.mod')) {
          errors.push({
            type: 'missing_file',
            message: 'go.mod (required for CI actions)',
            file: 'go.mod'
          });
        }
        
        // Check golangci-lint version
        const workflowConfig = this.extractWorkflowConfig(content, 'ci');
        let expectedVersion = workflowConfig.golangciLintVersion || 'v2';
        
        // Default 'latest' to v2
        if (expectedVersion === 'latest') {
          expectedVersion = 'v2';
        }
        
        // Check if golangci config exists and validate version
        let configFile: string | null = null;
        if (this.fileExists('.golangci.yml')) {
          configFile = '.golangci.yml';
        } else if (this.fileExists('.golangci.yaml')) {
          configFile = '.golangci.yaml';
        }
        
        if (configFile) {
          const configVersion = this.extractConfigVersion(configFile);
          if (configVersion) {
            const expectedMajor = this.getMajorVersion(expectedVersion);
            const actualMajor = this.getMajorVersion(configVersion);
            
            if (expectedMajor && actualMajor && expectedMajor !== actualMajor) {
              errors.push({
                type: 'version_mismatch',
                message: `${configFile} has version ${configVersion} but workflow expects version v${expectedMajor}`,
                file: configFile,
                expected: `v${expectedMajor}`,
                actual: configVersion
              });
            }
          }
        }
      }
      
      // Check for release action
      if (content.includes('jrschumacher/go-actions/release@')) {
        actionsFound.add('release');
        
        // Validate required files
        const requiredFiles = [
          { file: '.release-please-config.json', message: '.release-please-config.json (required for release action)' },
          { file: '.release-please-manifest.json', message: '.release-please-manifest.json (required for release action)' }
        ];
        
        for (const { file, message } of requiredFiles) {
          if (!this.fileExists(file)) {
            errors.push({
              type: 'missing_file',
              message,
              file
            });
          }
        }
        
        // Check for goreleaser config
        if (!this.fileExists('.goreleaser.yaml') && !this.fileExists('.goreleaser.yml')) {
          errors.push({
            type: 'missing_file',
            message: '.goreleaser.yaml or .goreleaser.yml (required for release action)',
            file: '.goreleaser.yaml'
          });
        }
      }
      
      // Check for self-validate action
      if (content.includes('jrschumacher/go-actions/self-validate@')) {
        actionsFound.add('self-validate');
      }
    }
    
    return {
      isValid: errors.length === 0,
      actionsFound: Array.from(actionsFound),
      errors
    };
  }

  public formatPRComment(result: ValidationResult): string {
    let comment = '## 🔍 Go Actions Validation\n\n';
    
    if (!result.isValid) {
      comment += '❌ **Validation Failed**\n\n';
      comment += 'Your workflows use go-actions but are missing required configuration files:\n\n';
      
      for (const error of result.errors) {
        comment += `- ${error.message}\n`;
      }
      
      comment += '\n### 📝 Required Configuration Examples\n\n';
      
      // Add examples for missing files
      const missingFiles = result.errors.filter(e => e.type === 'missing_file').map(e => e.file);
      
      if (missingFiles.includes('.release-please-config.json')) {
        comment += '**`.release-please-config.json`:**\n```json\n{\n  "packages": {\n    ".": {\n      "release-type": "go",\n      "package-name": "your-module-name"\n    }\n  }\n}\n```\n\n';
      }
      
      if (missingFiles.includes('.release-please-manifest.json')) {
        comment += '**`.release-please-manifest.json`:**\n```json\n{\n  ".": "0.1.0"\n}\n```\n\n';
      }
      
      if (missingFiles.includes('.goreleaser.yaml')) {
        comment += '**`.goreleaser.yaml`:** Run `goreleaser init` to create this file\n\n';
      }
      
      // Add version mismatch help
      const versionErrors = result.errors.filter(e => e.type === 'version_mismatch');
      if (versionErrors.length > 0) {
        comment += '### ⚠️ Version Mismatch\n\n';
        comment += 'Your golangci-lint configuration file version doesn\'t match what\'s expected by the workflow.\n\n';
        comment += 'To fix this, update the `version:` field in your `.golangci.yml` or `.golangci.yaml` file to match the workflow\'s expected version.\n\n';
        
        for (const error of versionErrors) {
          if (error.expected) {
            comment += `Example for ${error.file}:\n\`\`\`yaml\nversion: ${error.expected}\n\`\`\`\n\n`;
          }
        }
      }
    } else {
      comment += '✅ **All validations passed!**\n\n';
      comment += `Your project is properly configured for the go-actions used: ${result.actionsFound.join(', ')}`;
    }
    
    return comment;
  }
}

// Main execution function for github-script
export function validateWorkflows(workingDir: string = '.'): ValidationResult {
  const validator = new WorkflowValidator(workingDir);
  return validator.validate();
}