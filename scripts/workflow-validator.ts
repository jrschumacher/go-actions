import * as fs from 'fs';
import * as path from 'path';

export interface ValidationResult {
  isValid: boolean;
  actionsFound: string[];
  errors: ValidationError[];
}

export interface ValidationError {
  type: 'missing_file' | 'version_mismatch' | 'incompatible_versions';
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
        
        // Check if the specified version is compatible with our CI action
        if (expectedVersion.startsWith('v1') || expectedVersion.startsWith('1.')) {
          errors.push({
            type: 'incompatible_versions',
            message: `go-actions/ci uses golangci-lint-action@v8 internally, which doesn't support golangci-lint ${expectedVersion}. Use golangci-lint-version: v2 or later`,
            expected: 'v2.x.x',
            actual: expectedVersion
          });
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
      
      // Check for direct golangci-lint-action usage and validate compatibility
      this.validateGolangciLintAction(content, errors);
      
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

  private validateGolangciLintAction(content: string, errors: ValidationError[]): void {
    // Check for golangci-lint-action usage
    const golangciActionRegex = /uses:\s*golangci\/golangci-lint-action@v(\d+)/g;
    let match;
    
    while ((match = golangciActionRegex.exec(content)) !== null) {
      const actionVersion = parseInt(match[1]);
      
      // Look for version configuration in the same action block
      const actionStartIndex = match.index;
      const nextActionIndex = content.indexOf('- uses:', actionStartIndex + 1);
      const actionBlock = nextActionIndex === -1 
        ? content.substring(actionStartIndex)
        : content.substring(actionStartIndex, nextActionIndex);
      
      // Extract golangci-lint version from the action block
      const versionMatch = actionBlock.match(/version:\s*["']?([^"'\s\n]+)["']?/);
      if (versionMatch) {
        const golangciVersion = versionMatch[1];
        
        // Check for incompatible combinations (consolidated check)
        if (actionVersion >= 7 && (golangciVersion.startsWith('v1') || golangciVersion.startsWith('1.'))) {
          const message = actionVersion >= 8 
            ? `golangci-lint-action@v${actionVersion} requires golangci-lint v2+. Found: ${golangciVersion}`
            : `golangci-lint-action@v${actionVersion} doesn't support golangci-lint ${golangciVersion}. Use golangci-lint v2+ or downgrade to golangci-lint-action@v6`;
          
          errors.push({
            type: 'incompatible_versions',
            message,
            expected: 'v2.x.x',
            actual: golangciVersion
          });
        }
      }
    }
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
      
      // Add incompatible versions help
      const incompatibleErrors = result.errors.filter(e => e.type === 'incompatible_versions');
      if (incompatibleErrors.length > 0) {
        comment += '### 🚫 Incompatible Versions\n\n';
        comment += 'Found incompatible version combinations that will cause workflow failures:\n\n';
        
        for (const error of incompatibleErrors) {
          comment += `❌ **${error.message}**\n\n`;
          
          if (error.message.includes('golangci-lint-action@v8')) {
            // Direct golangci-lint-action usage
            comment += '**Quick Fix Options:**\n\n';
            comment += '**Option 1: Use compatible golangci-lint version**\n';
            comment += '```yaml\n';
            comment += '- uses: golangci/golangci-lint-action@v8\n';
            comment += '  with:\n';
            comment += '    version: v2.1.0  # or latest\n';
            comment += '```\n\n';
            comment += '**Option 2: Downgrade action version**\n';
            comment += '```yaml\n';
            comment += '- uses: golangci/golangci-lint-action@v6\n';
            comment += '  with:\n';
            comment += `    version: ${error.actual}\n`;
            comment += '```\n\n';
            comment += '**Option 3: Use our go-actions/ci (recommended)**\n';
            comment += '```yaml\n';
            comment += '- uses: jrschumacher/go-actions/ci@v1\n';
            comment += '  with:\n';
            comment += '    job: lint\n';
            comment += '    golangci-lint-version: v2  # compatible version\n';
            comment += '```\n\n';
          } else if (error.message.includes('go-actions/ci')) {
            // go-actions/ci usage with incompatible version
            comment += '**Quick Fix:**\n';
            comment += '```yaml\n';
            comment += '- uses: jrschumacher/go-actions/ci@v1\n';
            comment += '  with:\n';
            comment += '    job: lint\n';
            comment += '    golangci-lint-version: v2  # change from ' + error.actual + '\n';
            comment += '```\n\n';
            comment += '**Why this is needed:** go-actions/ci uses golangci-lint-action@v8 internally, which requires golangci-lint v2+.\n\n';
          }
        }
        
        comment += '💡 **Tip**: golangci-lint v2 has better performance and more features than v1. [Migration guide](https://golangci-lint.run/usage/migration-guide/)\n\n';
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