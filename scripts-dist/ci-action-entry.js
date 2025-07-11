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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBenchmarks = exports.extractCoverage = void 0;
// Entry point for ci-action bundle
var coverage_extractor_1 = require("./coverage-extractor");
Object.defineProperty(exports, "extractCoverage", { enumerable: true, get: function () { return coverage_extractor_1.extractCoverage; } });
var benchmark_runner_1 = require("./benchmark-runner");
Object.defineProperty(exports, "runBenchmarks", { enumerable: true, get: function () { return benchmark_runner_1.runBenchmarks; } });
__exportStar(require("./ci-action"), exports);
//# sourceMappingURL=ci-action-entry.js.map