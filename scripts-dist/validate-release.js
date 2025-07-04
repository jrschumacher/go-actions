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
class ReleaseValidator {
    constructor(options) {
        this.workingDir = options.workingDirectory;
    }
    fileExists(filePath) {
        return fs.existsSync(path.join(this.workingDir, filePath));
    }
    validate() {
        const missingFiles = [];
        if (!this.fileExists('.release-please-config.json')) {
            missingFiles.push('.release-please-config.json');
        }
        if (!this.fileExists('.release-please-manifest.json')) {
            missingFiles.push('.release-please-manifest.json');
        }
        if (missingFiles.length > 0) {
            console.log(`::error::Missing required Release Please configuration files: ${missingFiles.join(', ')}`);
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
            console.log(JSON.stringify({ '.': '0.1.0' }, null, 2));
            return { isValid: false, missingFiles };
        }
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