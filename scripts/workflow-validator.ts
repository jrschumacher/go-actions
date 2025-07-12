import * as fs from 'fs';
import * as path from 'path';
import { ReleasePleaseValidator } from './release-please-validator';

export interface ValidationResult {
  isValid: boolean;
  actionsFound: string[];
  errors: ValidationError[];
}

export interface ValidationError {
  type: 'missing_file' | 'version_mismatch' | 'incompatible_versions' | 'goreleaser_config' | 'release_please_config';
  message: string;
  file?: string;
  expected?: string;
  actual?: string;
  severity?: 'error' | 'warning';
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
        let expectedVersion = workflowConfig.golangciLintVersion || 'v2.1.0';
        
        // Default 'latest' to v2.1.0
        if (expectedVersion === 'latest') {
          expectedVersion = 'v2.1.0';
        }
        
        // Check if the specified version is compatible with our CI action
        if (expectedVersion.startsWith('v1') || expectedVersion.startsWith('1.')) {
          errors.push({
            type: 'incompatible_versions',
            message: `go-actions/ci uses golangci-lint-action@v8 internally, which doesn't support golangci-lint ${expectedVersion}. Use golangci-lint-version: v2.1.0 or later`,
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
        
        // Use unified Release Please validator
        const releasePleaseValidator = new ReleasePleaseValidator(this.workingDir);
        const releasePleaseResult = releasePleaseValidator.validate();
        
        // Convert ReleasePleaseValidationError to ValidationError format
        for (const rpError of releasePleaseResult.errors) {
          errors.push({
            type: rpError.type as any, // These types are compatible
            message: rpError.message,
            file: rpError.file,
            severity: rpError.severity
          });
        }
        
        // Check for goreleaser config
        if (!this.fileExists('.goreleaser.yaml') && !this.fileExists('.goreleaser.yml')) {
          errors.push({
            type: 'missing_file',
            message: '.goreleaser.yaml or .goreleaser.yml (required for release action)',
            file: '.goreleaser.yaml'
          });
        } else {
          // Validate GoReleaser configuration content
          this.validateGoReleaserConfig(errors);
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

  private validateGoReleaserConfig(errors: ValidationError[]): void {
    const configPath = this.fileExists('.goreleaser.yaml') ? '.goreleaser.yaml' : '.goreleaser.yml';
    if (!configPath) return;
    
    try {
      const configContent = fs.readFileSync(path.join(this.workingDir, configPath), 'utf8');
      const yamlContent = configContent.toLowerCase();
      
      // Check for common misconfigurations
      if (!yamlContent.includes('builds:') && !yamlContent.includes('builds ')) {
        errors.push({
          type: 'goreleaser_config',
          message: 'GoReleaser config missing required "builds" section',
          file: configPath,
          severity: 'error'
        });
      }
      
      // Check for binary naming issues
      if (yamlContent.includes('binary:') && !yamlContent.includes('{{ .ProjectName }}')) {
        errors.push({
          type: 'goreleaser_config',
          message: 'GoReleaser binary naming may cause issues. Consider using "{{ .ProjectName }}"',
          file: configPath,
          severity: 'warning'
        });
      }
      
      // Check for archive format compatibility
      if (yamlContent.includes('format: zip') && yamlContent.includes('goos: linux')) {
        errors.push({
          type: 'goreleaser_config',
          message: 'ZIP format for Linux archives may cause compatibility issues. Consider tar.gz',
          file: configPath,
          severity: 'warning'
        });
      }
      
    } catch (error) {
      errors.push({
        type: 'goreleaser_config',
        message: `Invalid GoReleaser configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        file: configPath,
        severity: 'error'
      });
    }
  }


  public createUnifiedSection(result: ValidationResult) {
    // Create section for unified comment system
    const { UnifiedPRComment } = require('./unified-pr-comment');
    
    const selfValidateResult = {
      status: result.isValid ? 'success' as const : 'failure' as const,
      actionsFound: result.actionsFound,
      errors: result.errors
    };
    
    return UnifiedPRComment.storeResults('selfValidate', selfValidateResult);
  }

  public formatPRComment(result: ValidationResult): string {
    const hasErrors = !result.isValid;
    const errorsByType = this.groupErrorsByType(result.errors);
    
    let comment = '# Go Actions Report\n\n';
    
    // Status line for validation
    if (hasErrors) {
      comment += '❌ **Validation Failed**\n';
    } else {
      comment += '✅ **Validated**\n';
    }
    comment += '\n';
    
    if (hasErrors) {
      // Issues in details section
      comment += '<details open><summary>Validation Issues</summary>\n\n';
      let issueNumber = 1;
      
      // GoReleaser issues
      if (errorsByType.missing_file?.some(e => e.file?.includes('goreleaser')) || errorsByType.goreleaser_config) {
        comment += `${issueNumber}. **GoReleaser Config** - Configuration issues detected\n`;
        
        if (errorsByType.missing_file?.some(e => e.file?.includes('goreleaser'))) {
          comment += '   - 📁 Expected: `.goreleaser.yaml`\n';
          comment += '   - 🔧 Fix: Run `goreleaser init` to create initial config\n';
        }
        
        if (errorsByType.goreleaser_config) {
          for (const error of errorsByType.goreleaser_config) {
            const icon = error.severity === 'warning' ? '⚠️' : '❌';
            comment += `   - ${icon} ${error.message}\n`;
          }
        }
        
        comment += '   - 📖 [GoReleaser Documentation](https://goreleaser.com/quick-start/)\n\n';
        issueNumber++;
      }
      
      // Release Please issues
      if (errorsByType.missing_file?.some(e => e.file?.includes('release-please')) || errorsByType.release_please_config) {
        comment += `${issueNumber}. **Release Please Config** - Configuration issues detected\n`;
        
        if (errorsByType.missing_file?.some(e => e.file?.includes('release-please'))) {
          comment += '   - 📁 Expected: `release-please-config.json` and `.release-please-manifest.json`\n';
        }
        
        if (errorsByType.release_please_config) {
          for (const error of errorsByType.release_please_config) {
            const icon = error.severity === 'warning' ? '⚠️' : '❌';
            comment += `   - ${icon} ${error.message}\n`;
          }
        }
        
        comment += '   - 🔧 Quick fix: Create config files with templates below\n';
        comment += '   - 📖 [Release Please Documentation](https://github.com/googleapis/release-please)\n\n';
        issueNumber++;
      }
      
      // golangci-lint incompatibility issues
      if (errorsByType.incompatible_versions) {
        for (const error of errorsByType.incompatible_versions) {
          comment += `${issueNumber}. **golangci-lint Version** - Upgrade needed for compatibility\n`;
          comment += `   - ❌ Current: ${error.actual}\n`;
          comment += '   - ✅ Required: v2.0.0 or higher\n';
          comment += '   - 🚀 Benefits: Better performance, more linters, active development\n';
          comment += '   - 🔧 Simple fix: Update version in your workflow (see template below)\n\n';
          issueNumber++;
        }
      }
      
      // Version mismatch issues
      if (errorsByType.version_mismatch) {
        for (const error of errorsByType.version_mismatch) {
          comment += `${issueNumber}. **Version Mismatch** - Configuration file version mismatch\n`;
          comment += `   - 📁 File: ${error.file}\n`;
          comment += `   - 🔧 Quick fix: Update version to ${error.expected}\n`;
          comment += '   - 📖 [Version Compatibility Guide](https://docs.anthropic.com/en/docs/claude-code)\n\n';
          issueNumber++;
        }
      }
    }
    
    // Passing Checks section
    const passingChecks = this.getPassingChecks(result, errorsByType);
    if (passingChecks.length > 0) {
      comment += '### ✅ Passing Checks\n\n';
      for (const check of passingChecks) {
        comment += `- ${check}\n`;
      }
      comment += '\n';
    }
    
    if (hasErrors) {
      // Configuration Templates section
      comment += '\n### 📝 Configuration Templates\n\n';
      comment += this.generateConfigurationTemplates(errorsByType);
      
      // Next Steps section
      comment += '### 🚀 Next Steps\n\n';
      comment += '1. Apply the fixes shown above\n';
      comment += '2. Push your changes to trigger re-validation\n';
      comment += '3. Once all checks pass, your go-actions workflows will run smoothly\n';
      comment += '4. Need help? Check the [go-actions documentation](https://docs.anthropic.com/en/docs/claude-code)\n\n';
      
      comment += '</details>\n\n';
    } else {
      // Success case - minimal with details collapsed
      comment += '<details><summary>Validation Details</summary>\n\n';
      comment += `**Actions configured:** ${result.actionsFound.join(', ')}\n\n`;
      comment += '**Checks passed:**\n';
      comment += '- Configuration files present\n';
      comment += '- Version compatibility verified\n';
      comment += '- Workflow syntax valid\n\n';
      comment += '</details>\n\n';
    }
    
    comment += '*🤖 This comment will update automatically as you push changes.*\n';
    comment += '*Generated by [go-actions](https://github.com/jrschumacher/go-actions)*';
    
    return comment;
  }
  
  private groupErrorsByType(errors: ValidationError[]): Record<string, ValidationError[]> {
    const grouped: Record<string, ValidationError[]> = {};
    for (const error of errors) {
      if (!grouped[error.type]) {
        grouped[error.type] = [];
      }
      grouped[error.type].push(error);
    }
    return grouped;
  }
  
  private getPassingChecks(result: ValidationResult, errorsByType: Record<string, ValidationError[]>): string[] {
    const checks: string[] = [];
    
    // Check if go.mod format is valid (no go.mod errors)
    if (!errorsByType.missing_file?.some(e => e.file === 'go.mod')) {
      checks.push('go.mod format');
    }
    
    // Check if CI workflow syntax is valid (assuming if we found actions, syntax is OK)
    if (result.actionsFound.length > 0) {
      checks.push('CI workflow syntax');
    }
    
    // Check if golangci-lint config is compatible
    if (!errorsByType.incompatible_versions?.some(e => e.message.includes('golangci-lint'))) {
      checks.push('golangci-lint configuration');
    }
    
    // Check if release config is present
    if (!errorsByType.missing_file?.some(e => e.file?.includes('release-please'))) {
      checks.push('Release Please configuration');
    }
    
    // Check if goreleaser config is present
    if (!errorsByType.missing_file?.some(e => e.file?.includes('goreleaser'))) {
      checks.push('GoReleaser configuration');
    }
    
    return checks;
  }
  
  private generateConfigurationTemplates(errorsByType: Record<string, ValidationError[]>): string {
    let templates = '';
    
    // Release Please templates
    if (errorsByType.missing_file?.some(e => e.file?.includes('release-please'))) {
      templates += '**`release-please-config.json`:**\n';
      templates += '```json\n';
      templates += '{\n';
      templates += '  "release-type": "go",\n';
      templates += '  "package-name": "your-package-name",\n';
      templates += '  "packages": {\n';
      templates += '    ".": {\n';
      templates += '      "release-type": "go",\n';
      templates += '      "package-name": "your-module-name"\n';
      templates += '    }\n';
      templates += '  }\n';
      templates += '}\n';
      templates += '```\n\n';
      
      templates += '**`.release-please-manifest.json`:**\n';
      templates += '```json\n';
      templates += '{\n';
      templates += '  ".": "0.1.0"\n';
      templates += '}\n';
      templates += '```\n\n';
    }
    
    // GoReleaser template
    if (errorsByType.missing_file?.some(e => e.file?.includes('goreleaser'))) {
      templates += '**`.goreleaser.yaml`:**\n';
      templates += '```bash\n';
      templates += '# Initialize with: goreleaser init\n';
      templates += 'goreleaser init\n';
      templates += '```\n\n';
    }
    
    // golangci-lint version upgrade
    if (errorsByType.incompatible_versions) {
      for (const error of errorsByType.incompatible_versions) {
        if (error.message.includes('golangci-lint')) {
          templates += '**Update your CI workflow to use golangci-lint v2:**\n';
          templates += '```yaml\n';
          templates += '# In your .github/workflows/ci.yaml\n';
          templates += '- uses: jrschumacher/go-actions/ci@v1\n';
          templates += '  with:\n';
          templates += '    job: lint\n';
          templates += '    golangci-lint-version: v2.1.0  # Updated from ' + error.actual + '\n';
          templates += '```\n\n';
          
          templates += '**Optional: Create `.golangci.yaml` for custom configuration:**\n';
          templates += '```yaml\n';
          templates += 'version: 2\n';
          templates += '\n';
          templates += 'linters:\n';
          templates += '  enable:\n';
          templates += '    - gofmt\n';
          templates += '    - golint\n';
          templates += '    - govet\n';
          templates += '    - errcheck\n';
          templates += '    - staticcheck\n';
          templates += '    - ineffassign\n';
          templates += '    - misspell\n';
          templates += '\n';
          templates += 'linters-settings:\n';
          templates += '  govet:\n';
          templates += '    check-shadowing: true\n';
          templates += '\n';
          templates += 'issues:\n';
          templates += '  exclude-use-default: false\n';
          templates += '```\n\n';
        }
      }
    }
    
    return templates;
  }
}

// Main execution function for github-script  
export function validateWorkflows(workingDir: string = '.'): ValidationResult {
  const validator = new WorkflowValidator(workingDir);
  return validator.validate();
}

// Consolidated function that handles everything for GitHub Actions
export async function validateWorkflowsForAction(
  workingDir: string = '.',
  workflowPaths: string = '.github/workflows/*.yaml,.github/workflows/*.yml',
  commentOnPr: boolean = true
): Promise<ValidationResult> {
  const core = require('@actions/core');
  
  try {
    const result = validateWorkflows(workingDir);
    
    console.log('Found go-actions usage:', result.actionsFound);
    
    // Set GitHub Action outputs
    core.setOutput('actions_found', result.actionsFound.join(','));
    core.setOutput('validation_failed', (!result.isValid).toString());
    
    if (!result.isValid) {
      const errorMessages = result.errors.map(error => `- ${error.message}`).join('\n');
      console.log('\n::error::Validation failed:');
      console.log(errorMessages);
      core.setOutput('error_messages', errorMessages);
      core.setFailed(`Validation failed with ${result.errors.length} error(s)`);
    } else {
      console.log('✅ All validations passed!');
    }
    
    // Store results for unified PR comment (if this is a PR)
    if (commentOnPr && process.env.GITHUB_EVENT_NAME === 'pull_request') {
      try {
        const { UnifiedPRComment } = require('../scripts-dist/self-validate-bundle/index.js');
        
        const selfValidateResult = {
          status: result.isValid ? 'success' : 'failure',
          actionsFound: result.actionsFound,
          errors: result.errors
        };
        
        // Store this job's results for later comment consolidation
        await UnifiedPRComment.storeResults('selfValidate', selfValidateResult);
        console.log('Stored validation results for unified comment');
      } catch (commentError) {
        console.log('Failed to store validation results:', commentError);
        // Don't fail the action if storing fails
      }
    }
    
    return result;
  } catch (error) {
    console.error('Validation failed with error:', error);
    core.setFailed(`Validation failed: ${error}`);
    throw error;
  }
}

// Even simpler - direct execution function that can be called as a function
export default async function(workingDir: string = '.') {
  const workflowPaths = process.env.INPUT_WORKFLOW_PATHS || '.github/workflows/*.yaml,.github/workflows/*.yml';
  const commentOnPr = (process.env.INPUT_COMMENT_ON_PR || 'true') === 'true';
  
  return await validateWorkflowsForAction(workingDir, workflowPaths, commentOnPr);
}