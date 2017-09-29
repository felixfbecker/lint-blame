"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var parsers;
(function (parsers) {
    parsers.tslint4 = function (line) {
        var match = line.match(/^(.+)\[(\d+), (\d+)\]:/);
        if (!match) {
            throw new Error("Not a TSLint complaint: " + line);
        }
        return {
            filePath: match[1],
            line: ~~match[2],
            column: ~~match[3]
        };
    };
    parsers.tslint5 = function (line) {
        var match = line.match(/^ERROR: (.+)\[(\d+), (\d+)\]:/);
        if (!match) {
            throw new Error("Not a TSLint complaint: " + line);
        }
        return {
            filePath: match[1],
            line: ~~match[2],
            column: ~~match[3]
        };
    };
    parsers.tsconfig = function (line) {
        var match = line.match(/^(.+)\((\d+),(\d+)\):/);
        if (!match) {
            throw new Error("Not a tsconfig complaint: " + line);
        }
        return {
            filePath: match[1],
            line: ~~match[2],
            column: ~~match[3]
        };
    };
})(parsers = exports.parsers || (exports.parsers = {}));
//# sourceMappingURL=complaints.js.map