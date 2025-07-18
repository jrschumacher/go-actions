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
const validate_release_1 = require("./validate-release");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Mock fs
jest.mock('fs');
const mockFs = fs;
describe('ReleaseValidator', () => {
    let validator;
    const testWorkingDir = '/test/project';
    beforeEach(() => {
        jest.clearAllMocks();
        validator = new validate_release_1.ReleaseValidator({ workingDirectory: testWorkingDir });
    });
    describe('validate', () => {
        it('should pass when all required files exist', () => {
            mockFs.existsSync.mockImplementation((filePath) => {
                const file = path.basename(filePath);
                return file === 'release-please-config.json' ||
                    file === '.release-please-manifest.json';
            });
            mockFs.readFileSync.mockImplementation((filePath) => {
                const file = path.basename(filePath);
                if (file === 'release-please-config.json') {
                    return JSON.stringify({ "release-type": "go", "package-name": "test-package", "packages": { ".": {} } });
                }
                return '{}';
            });
            const result = validator.validate();
            expect(result).toEqual({
                isValid: true,
                missingFiles: []
            });
            expect(mockFs.existsSync).toHaveBeenCalledWith(path.join(testWorkingDir, 'release-please-config.json'));
            expect(mockFs.existsSync).toHaveBeenCalledWith(path.join(testWorkingDir, '.release-please-manifest.json'));
        });
        it('should fail when release-please-config.json is missing', () => {
            mockFs.existsSync.mockImplementation((filePath) => {
                const file = path.basename(filePath);
                return file === '.release-please-manifest.json';
            });
            const result = validator.validate();
            expect(result).toEqual({
                isValid: false,
                missingFiles: ['release-please-config.json']
            });
        });
        it('should fail when release-please-manifest.json is missing', () => {
            mockFs.existsSync.mockImplementation((filePath) => {
                const file = path.basename(filePath);
                return file === 'release-please-config.json';
            });
            mockFs.readFileSync.mockImplementation((filePath) => {
                const file = path.basename(filePath);
                if (file === 'release-please-config.json') {
                    return JSON.stringify({ "release-type": "go", "package-name": "test-package", "packages": { ".": {} } });
                }
                return '{}';
            });
            const result = validator.validate();
            expect(result).toEqual({
                isValid: false,
                missingFiles: ['.release-please-manifest.json']
            });
        });
        it('should fail when both files are missing', () => {
            mockFs.existsSync.mockReturnValue(false);
            const result = validator.validate();
            expect(result).toEqual({
                isValid: false,
                missingFiles: ['release-please-config.json', '.release-please-manifest.json']
            });
        });
        it('should use correct working directory', () => {
            const customDir = '/custom/project';
            const customValidator = new validate_release_1.ReleaseValidator({ workingDirectory: customDir });
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockImplementation((filePath) => {
                const file = path.basename(filePath);
                if (file === 'release-please-config.json') {
                    return JSON.stringify({ "release-type": "go", "package-name": "test-package", "packages": { ".": {} } });
                }
                return '{}';
            });
            customValidator.validate();
            expect(mockFs.existsSync).toHaveBeenCalledWith(path.join(customDir, 'release-please-config.json'));
            expect(mockFs.existsSync).toHaveBeenCalledWith(path.join(customDir, '.release-please-manifest.json'));
        });
        it('should log appropriate messages for missing files', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            mockFs.existsSync.mockReturnValue(false);
            validator.validate();
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Missing required Release Please configuration files'));
            expect(consoleSpy).toHaveBeenCalledWith('');
            expect(consoleSpy).toHaveBeenCalledWith('Create release-please-config.json (Release Please v16+ format):');
            expect(consoleSpy).toHaveBeenCalledWith('Create .release-please-manifest.json:');
            consoleSpy.mockRestore();
        });
        it('should provide correct JSON examples', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            mockFs.existsSync.mockReturnValue(false);
            validator.validate();
            // Check that JSON.stringify was called with correct objects
            const calls = consoleSpy.mock.calls;
            const configCall = calls.find(call => call[0] && typeof call[0] === 'string' && call[0].includes('packages'));
            const manifestCall = calls.find(call => call[0] && typeof call[0] === 'string' && call[0].includes('0.1.0'));
            expect(configCall).toBeDefined();
            expect(manifestCall).toBeDefined();
            consoleSpy.mockRestore();
        });
    });
    describe('validateRelease function export', () => {
        it('should work with default working directory', () => {
            const { validateRelease } = require('./validate-release');
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockImplementation((filePath) => {
                const file = path.basename(filePath);
                if (file === 'release-please-config.json') {
                    return JSON.stringify({ "release-type": "go", "package-name": "test-package", "packages": { ".": {} } });
                }
                return '{}';
            });
            const result = validateRelease();
            expect(result.isValid).toBe(true);
            expect(mockFs.existsSync).toHaveBeenCalledWith(path.join('.', 'release-please-config.json'));
        });
        it('should work with custom working directory', () => {
            const { validateRelease } = require('./validate-release');
            mockFs.existsSync.mockReturnValue(false);
            const result = validateRelease('/custom/dir');
            expect(result.isValid).toBe(false);
            expect(mockFs.existsSync).toHaveBeenCalledWith(path.join('/custom/dir', 'release-please-config.json'));
        });
    });
    describe('edge cases', () => {
        it('should handle file system errors gracefully', () => {
            mockFs.existsSync.mockImplementation(() => {
                throw new Error('File system error');
            });
            expect(() => validator.validate()).toThrow('File system error');
        });
        it('should handle relative paths correctly', () => {
            const relativeValidator = new validate_release_1.ReleaseValidator({ workingDirectory: '../project' });
            mockFs.existsSync.mockReturnValue(true);
            relativeValidator.validate();
            expect(mockFs.existsSync).toHaveBeenCalledWith(path.join('../project', 'release-please-config.json'));
        });
        it('should handle empty working directory', () => {
            const emptyValidator = new validate_release_1.ReleaseValidator({ workingDirectory: '' });
            mockFs.existsSync.mockReturnValue(true);
            emptyValidator.validate();
            expect(mockFs.existsSync).toHaveBeenCalledWith(path.join('', 'release-please-config.json'));
        });
    });
});
//# sourceMappingURL=validate-release.test.js.map