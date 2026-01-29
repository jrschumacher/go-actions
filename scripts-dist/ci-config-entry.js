#!/usr/bin/env node
"use strict";
/**
 * Entry point for CI config resolver
 * Used by ci/action.yaml to resolve configuration
 */
Object.defineProperty(exports, "__esModule", { value: true });
const ci_config_resolver_1 = require("./ci-config-resolver");
/**
 * Main execution
 */
function main() {
    // Parse command line arguments
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Usage: ci-config-entry.ts <working-directory> [workflow-inputs-json]');
        process.exit(1);
    }
    const workingDir = args[0];
    let workflowInputs = {};
    if (args.length > 1) {
        try {
            workflowInputs = JSON.parse(args[1]);
        }
        catch (error) {
            console.error('Failed to parse workflow inputs JSON:', error);
            process.exit(1);
        }
    }
    try {
        const resolver = new ci_config_resolver_1.CIConfigResolver(workingDir, workflowInputs);
        const config = resolver.resolve();
        // Output as JSON for easy parsing in GitHub Actions
        console.log(JSON.stringify(config, null, 2));
    }
    catch (error) {
        if (error instanceof Error) {
            console.error('Config resolution failed:', error.message);
        }
        else {
            console.error('Config resolution failed:', error);
        }
        process.exit(1);
    }
}
// Run main if this is the entry point
if (require.main === module) {
    main();
}
//# sourceMappingURL=ci-config-entry.js.map