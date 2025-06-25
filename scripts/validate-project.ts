import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface ValidationOptions {
  workingDirectory: string;
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
    
    if (!this.fileExists('.golangci.yml') && !this.fileExists('.golangci.yaml')) {
      warnings.push('⚠️  No .golangci.yml or .golangci.yaml found (optional but recommended for lint job)');
      warnings.push('   golangci-lint will use default configuration');
    } else {
      console.log('✅ golangci-lint configuration found');
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