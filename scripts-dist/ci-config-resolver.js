"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CIConfigResolver = void 0;
exports.resolveCIConfig = resolveCIConfig;
exports.isJobEnabled = isJobEnabled;
const config_loader_1 = require("./config-loader");
/**
 * Resolves CI configuration by merging config file, defaults, and workflow inputs
 */
class CIConfigResolver {
    constructor(workingDir, workflowInputs = {}) {
        // Convert workflow inputs to config loader overrides
        const overrides = {};
        if (workflowInputs.goVersion !== undefined && workflowInputs.goVersion !== '') {
            overrides.goVersion = workflowInputs.goVersion;
        }
        if (workflowInputs.goVersionFile !== undefined && workflowInputs.goVersionFile !== '') {
            overrides.goVersionFile = workflowInputs.goVersionFile;
        }
        if (workflowInputs.testArgs !== undefined && workflowInputs.testArgs !== '') {
            overrides.testArgs = workflowInputs.testArgs;
        }
        if (workflowInputs.golangciLintVersion !== undefined && workflowInputs.golangciLintVersion !== '') {
            overrides.lintVersion = workflowInputs.golangciLintVersion;
        }
        if (workflowInputs.lintArgs !== undefined && workflowInputs.lintArgs !== '') {
            overrides.lintArgs = workflowInputs.lintArgs;
        }
        if (workflowInputs.benchmarkArgs !== undefined && workflowInputs.benchmarkArgs !== '') {
            overrides.benchmarkArgs = workflowInputs.benchmarkArgs;
        }
        if (workflowInputs.benchmarkCount !== undefined) {
            const count = typeof workflowInputs.benchmarkCount === 'string'
                ? parseInt(workflowInputs.benchmarkCount, 10)
                : workflowInputs.benchmarkCount;
            if (!isNaN(count)) {
                overrides.benchmarkCount = count;
            }
        }
        if (workflowInputs.govulncheckVersion !== undefined && workflowInputs.govulncheckVersion !== '') {
            overrides.securityVersion = workflowInputs.govulncheckVersion;
        }
        if (workflowInputs.securityArgs !== undefined && workflowInputs.securityArgs !== '') {
            overrides.securityArgs = workflowInputs.securityArgs;
        }
        // Load config with overrides applied
        this.config = (0, config_loader_1.loadConfig)(workingDir, overrides);
    }
    /**
     * Get fully resolved configuration for all CI jobs
     */
    resolve() {
        const ci = this.config.ci;
        // Extract values with defaults
        const goVersion = ci?.go?.version || '';
        const goVersionFile = ci?.go?.['version-file'] || 'go.mod';
        const testEnabled = ci?.test?.enabled !== false; // Default true
        const testArgs = ci?.test?.args || '-v -race -coverprofile=coverage.out ./...';
        const coverageThreshold = ci?.test?.coverage?.threshold || 0;
        const lintEnabled = ci?.lint?.enabled !== false; // Default true
        const lintVersion = ci?.lint?.version || 'v2.0.2';
        const lintArgs = ci?.lint?.args || '';
        const benchmarkEnabled = ci?.benchmark?.enabled === true; // Default false
        const benchmarkArgs = ci?.benchmark?.args || '-bench=. -benchmem';
        const benchmarkCount = ci?.benchmark?.count || 5;
        const securityEnabled = ci?.security?.enabled !== false; // Default true
        const securityVersion = ci?.security?.version || 'latest';
        const securityArgs = ci?.security?.args || '';
        const securityFailOn = ci?.security?.['fail-on'] || 'high';
        return {
            goVersion,
            goVersionFile,
            workingDirectory: '.',
            testEnabled,
            testArgs,
            coverageThreshold,
            lintEnabled,
            lintVersion,
            lintArgs,
            benchmarkEnabled,
            benchmarkArgs,
            benchmarkCount,
            securityEnabled,
            securityVersion,
            securityArgs,
            securityFailOn,
        };
    }
    /**
     * Check if a specific job is enabled
     */
    isJobEnabled(job) {
        const resolved = this.resolve();
        switch (job) {
            case 'test':
                return resolved.testEnabled;
            case 'lint':
                return resolved.lintEnabled;
            case 'benchmark':
                return resolved.benchmarkEnabled;
            case 'security':
                return resolved.securityEnabled;
            default:
                return false;
        }
    }
    /**
     * Get coverage threshold
     */
    getCoverageThreshold() {
        return this.resolve().coverageThreshold;
    }
}
exports.CIConfigResolver = CIConfigResolver;
/**
 * Convenience function to resolve CI configuration
 */
function resolveCIConfig(workingDir, workflowInputs = {}) {
    const resolver = new CIConfigResolver(workingDir, workflowInputs);
    return resolver.resolve();
}
/**
 * Convenience function to check if a job is enabled
 */
function isJobEnabled(workingDir, job, workflowInputs = {}) {
    const resolver = new CIConfigResolver(workingDir, workflowInputs);
    return resolver.isJobEnabled(job);
}
//# sourceMappingURL=ci-config-resolver.js.map