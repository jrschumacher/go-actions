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
exports.ReleaseValidator = void 0;
exports.validateRelease = validateRelease;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const release_please_validator_1 = require("./release-please-validator");
class ReleaseValidator {
    constructor(options) {
        this.workingDir = options.workingDirectory;
    }
    fileExists(filePath) {
        return fs.existsSync(path.join(this.workingDir, filePath));
    }
    validate() {
        console.log(`Checking for Release Please files in directory: ${this.workingDir}`);
        console.log(`Full path: ${path.resolve(this.workingDir)}`);
        const validator = new release_please_validator_1.ReleasePleaseValidator(this.workingDir);
        const result = validator.validate();
        const missingFiles = [];
        // Log validation results and convert to legacy format
        for (const error of result.errors) {
            const severity = error.severity === 'warning' ? '::warning::' : '::error::';
            console.log(`${severity}${error.message}`);
            if (error.type === 'filename_error') {
                console.log(`Please rename the file as indicated above`);
                missingFiles.push(`${error.file} (incorrect filename)`);
            }
            else if (error.type === 'format_error') {
                missingFiles.push(`${error.file} (format update needed)`);
            }
            else if (error.type === 'invalid_json') {
                missingFiles.push(`${error.file} (invalid JSON)`);
            }
            else {
                missingFiles.push(error.file);
            }
        }
        if (!result.isValid) {
            console.log(`::error::Missing required Release Please configuration files: ${missingFiles.join(', ')}`);
            console.log('');
            console.log('Create release-please-config.json (Release Please v16+ format):');
            console.log(validator.generateConfigTemplate());
            console.log('');
            console.log('Create .release-please-manifest.json:');
            console.log(validator.generateManifestTemplate());
            return { isValid: false, missingFiles };
        }
        console.log('✅ Release Please configuration is valid');
        return { isValid: true, missingFiles: [] };
    }
}
exports.ReleaseValidator = ReleaseValidator;
// Main execution for github-script
function validateRelease(workingDirectory = '.') {
    const validator = new ReleaseValidator({ workingDirectory });
    return validator.validate();
}
//# sourceMappingURL=validate-release.js.map