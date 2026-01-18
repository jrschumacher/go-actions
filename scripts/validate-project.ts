import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as yaml from 'js-yaml';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface ValidationOptions {
  workingDirectory: string;
}

/**
 * golangci-lint v2 configuration structure
 * See: https://golangci-lint.run/usage/configuration/
 */
interface GolangciLintConfig {
  version?: number | string;
  linters?: {
    enable_all?: boolean;
    disable_all?: boolean;
    enable?: string[];
    disable?: string[];
    preset?: 'all' | 'none' | string;
  };
  run?: {
    timeout?: string;
    concurrency?: number;
    modules_download_mode?: string;
  };
  output?: {
    formats?: Array<{ format: string; path?: string }>;
    print_issued_lines?: boolean;
    print_linter_name?: boolean;
  };
  linters_settings?: Record<string, unknown>;
  issues?: {
    exclude_rules?: Array<{ path?: string; linters?: string[]; text?: string }>;
    max_issues_per_linter?: number;
    max_same_issues?: number;
  };
}

export class ProjectValidator {
  private workingDir: string;

  constructor(options: ValidationOptions) {
    this.workingDir = options.workingDirectory;
  }

  private fileExists(filePath: string): boolean {
    return fs.existsSync(path.join(this.workingDir, filePath));
  }

  private findFiles(pattern: string): string[] {
    try {
      const result = execSync(`find ${this.workingDir} -name "${pattern}" -not -path "./vendor/*"`, { encoding: 'utf8' });
      return result.trim().split('\n').filter(line => line.length > 0);
    } catch {
      return [];
    }
  }

  private hasBenchmarkFunctions(): boolean {
    try {
      execSync(`grep -r "func Benchmark" ${this.workingDir} --include="*_test.go"`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  private validateGolangciConfig(configPath: string): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const configContent = fs.readFileSync(configPath, 'utf8');
      const config = yaml.load(configContent) as GolangciLintConfig | null;

      // Check for version field
      if (!config || typeof config !== 'object') {
        errors.push('❌ golangci-lint configuration is not valid YAML object');
        return { isValid: false, errors, warnings };
      }

      if (!config.version) {
        errors.push('❌ golangci-lint configuration missing required "version" field');
        errors.push('   Add "version: 2" to the top of your .golangci.yml file');
        errors.push('   See https://golangci-lint.run/product/migration-guide for migration instructions');
        return { isValid: false, errors, warnings };
      }

      // Validate version value
      const versionStr = String(config.version);
      if (config.version !== 2 && config.version !== "2") {
        errors.push(`❌ golangci-lint configuration has unsupported version: "${config.version}"`);

        // Provide specific guidance for common mistakes
        if (versionStr === 'v2' || versionStr === 'V2') {
          errors.push('   ⚠️  Common mistake: Remove the "v" prefix - use "2" not "v2"');
        } else if (versionStr === '2.0' || versionStr === '2.1') {
          errors.push('   ⚠️  Common mistake: Use integer "2" not "2.0" or "2.1"');
        } else if (versionStr === '1' || versionStr === 'v1') {
          errors.push('   ⚠️  Version 1 is outdated - upgrade to version 2');
        }

        errors.push('   ✅ Correct format: version: 2  (or version: "2")');
        errors.push('   See https://golangci-lint.run/product/migration-guide for migration instructions');
        return { isValid: false, errors, warnings };
      }

      // Check for v1 schema fields being used with v2
      if (config.linters_settings) {
        errors.push('❌ v2 schema error: "linters_settings" is not valid in v2');
        errors.push('   Use "linters.settings" instead (note: nested under linters)');
        return { isValid: false, errors, warnings };
      }

      if (config.issues && config.issues.exclude_rules) {
        errors.push('❌ v2 schema error: "issues.exclude_rules" is not valid in v2');
        errors.push('   Use "linters.exclusions.rules" instead');
        return { isValid: false, errors, warnings };
      }

      // Check for deprecated settings (v2 migration patterns)
      if (config.linters && config.linters.enable_all) {
        warnings.push('⚠️  "linters.enable-all" is deprecated in v2, use "linters.preset: all" instead');
      }

      if (config.linters && config.linters.disable_all) {
        warnings.push('⚠️  "linters.disable-all" is deprecated in v2, use "linters.preset: none" instead');
      }

      // Check for common deprecated linters
      const deprecatedLinters = ['golint', 'interfacer', 'maligned', 'scopelint'];
      if (config.linters && config.linters.enable) {
        const enabledDeprecated = config.linters.enable.filter((linter: string) => deprecatedLinters.includes(linter));
        enabledDeprecated.forEach((linter: string) => {
          warnings.push(`⚠️  Linter "${linter}" is deprecated and may not work properly`);
        });
      }

      // Add migration helper if any warnings were generated
      const hasDeprecatedSettings = (config.linters?.enable_all || config.linters?.disable_all);
      const hasDeprecatedLinters = config.linters?.enable?.some((linter: string) => deprecatedLinters.includes(linter));
      
      if (hasDeprecatedSettings || hasDeprecatedLinters) {
        warnings.push('💡  Run "golangci-lint migrate" to automatically update your configuration');
      }

      return { isValid: true, errors, warnings };

    } catch (error) {
      if (error instanceof yaml.YAMLException) {
        errors.push(`❌ golangci-lint configuration has invalid YAML syntax: ${error.message}`);
      } else {
        errors.push(`❌ Failed to validate golangci-lint configuration: ${error}`);
      }
      return { isValid: false, errors, warnings };
    }
  }

  public validate(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    console.log('🔍 Validating Go project structure...');

    // Check for go.mod
    if (!this.fileExists('go.mod')) {
      errors.push('❌ Missing go.mod file');
    } else {
      console.log('✅ go.mod found');
    }

    // Check for Go files
    const goFiles = this.findFiles('*.go');
    if (goFiles.length === 0) {
      errors.push('❌ No Go source files found');
    } else {
      console.log('✅ Go source files found');
    }

    // Check for test files
    const testFiles = this.findFiles('*_test.go');
    if (testFiles.length === 0) {
      warnings.push('⚠️  No test files found (recommended for test job)');
    } else {
      console.log('✅ Test files found');
    }

    // Check for benchmark files
    if (!this.hasBenchmarkFunctions()) {
      warnings.push('⚠️  No benchmark functions found (required for benchmark job)');
    } else {
      console.log('✅ Benchmark functions found');
    }

    // Check Release Please configuration
    console.log('');
    console.log('🔍 Validating Release Please configuration...');
    
    if (!this.fileExists('.release-please-config.json')) {
      warnings.push('⚠️  Missing .release-please-config.json (required for release job)');
      warnings.push('   Create with: {"packages":{".":{"release-type":"go","package-name":"your-module-name"}}}');
    } else {
      console.log('✅ .release-please-config.json found');
    }

    if (!this.fileExists('.release-please-manifest.json')) {
      warnings.push('⚠️  Missing .release-please-manifest.json (required for release job)');
      warnings.push('   Create with: {".":"0.1.0"}');
    } else {
      console.log('✅ .release-please-manifest.json found');
    }

    // Check GoReleaser configuration
    console.log('');
    console.log('🔍 Validating GoReleaser configuration...');
    
    if (!this.fileExists('.goreleaser.yaml') && !this.fileExists('.goreleaser.yml')) {
      warnings.push('⚠️  Missing .goreleaser.yaml or .goreleaser.yml (required for release job)');
      warnings.push('   Run \'goreleaser init\' to create a basic configuration');
    } else {
      console.log('✅ GoReleaser configuration found');
    }

    // Check golangci-lint configuration
    console.log('');
    console.log('🔍 Validating golangci-lint configuration...');
    
    const golangciYml = path.join(this.workingDir, '.golangci.yml');
    const golangciYaml = path.join(this.workingDir, '.golangci.yaml');
    
    if (!this.fileExists('.golangci.yml') && !this.fileExists('.golangci.yaml')) {
      warnings.push('⚠️  No .golangci.yml or .golangci.yaml found (optional but recommended for lint job)');
      warnings.push('   golangci-lint will use default configuration');
    } else {
      const configPath = this.fileExists('.golangci.yml') ? golangciYml : golangciYaml;
      console.log('✅ golangci-lint configuration found');
      
      const configValidation = this.validateGolangciConfig(configPath);
      if (!configValidation.isValid) {
        errors.push(...configValidation.errors);
        console.log('❌ golangci-lint configuration validation failed');
        configValidation.errors.forEach(error => console.log(error));
      } else {
        console.log('✅ golangci-lint configuration is valid');
      }
      
      if (configValidation.warnings.length > 0) {
        warnings.push(...configValidation.warnings);
      }
    }

    // Report results
    console.log('');
    if (errors.length === 0) {
      console.log('✅ Validation completed successfully! Project is ready for go-actions.');
      return { isValid: true, errors, warnings };
    } else {
      console.log(`❌ Validation failed with ${errors.length} error(s):`);
      errors.forEach(error => console.log(error));
      return { isValid: false, errors, warnings };
    }
  }
}

// Main execution for github-script
export function validateProject(workingDirectory: string = '.'): ValidationResult {
  const validator = new ProjectValidator({ workingDirectory });
  const result = validator.validate();
  
  // Print warnings
  if (result.warnings.length > 0) {
    console.log('');
    console.log('Warnings:');
    result.warnings.forEach(warning => console.log(warning));
  }
  
  return result;
}