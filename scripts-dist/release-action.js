"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReleaseAction = void 0;
exports.validateReleaseConfiguration = validateReleaseConfiguration;
exports.validateReleaseInputs = validateReleaseInputs;
const validate_release_1 = require("./validate-release");
const core = __importStar(require("@actions/core"));
class ReleaseAction {
    constructor(options = {}) {
        this.workingDirectory = options.workingDirectory || '.';
    }
    validateConfiguration() {
        console.log('Validating Release Please configuration...');
        const result = (0, validate_release_1.validateRelease)(this.workingDirectory);
        if (!result.isValid) {
            const missingFiles = result.missingFiles.join(', ');
            const message = `Missing required Release Please configuration files: ${missingFiles}`;
            core.setFailed(message);
            // Log helpful setup instructions
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
    setOutputs(releaseCreated = false, releaseTag) {
        core.setOutput('release_created', releaseCreated.toString());
        if (releaseTag) {
            core.setOutput('release_tag', releaseTag);
        }
        console.log(`Set outputs: release_created=${releaseCreated}, release_tag=${releaseTag || 'N/A'}`);
    }
}
exports.ReleaseAction = ReleaseAction;
// Export function for direct use
function validateReleaseConfiguration(workingDirectory) {
    const action = new ReleaseAction({ workingDirectory });
    return action.validateConfiguration();
}
// Export function for input validation
function validateReleaseInputs() {
    const action = new ReleaseAction();
    return action.validateInputs();
}
//# sourceMappingURL=release-action.js.map