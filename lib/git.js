"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var child_process_1 = require("child_process");
var rxjs_1 = require("rxjs");
/**
 * Parses the result of a `git blame --porcelain`
 * Returns a Map from line number to parsed blame for that line.
 * Every line of the file will be present.
 */
function parseBlameOutput(output) {
    // the --porcelain format prints at least one header line per source line,
    // then the source line prefixed by a tab character
    var blames = output.trim().split(/^\t.*\n/m);
    var parsedBlames = new Map();
    for (var _i = 0, blames_1 = blames; _i < blames_1.length; _i++) {
        var blame = blames_1[_i];
        // https://git-scm.com/docs/git-blame#_the_porcelain_format
        // commit-hash original-line final-line group-length
        var lineMatch = blame.match(/^\w{40} \d+ (\d+)/);
        if (!lineMatch) {
            throw new Error("Invalid blame input " + blame);
        }
        var authorMail = blame.match(/^author-mail <(.+)>$/m);
        var author = blame.match(/^author (.+)$/m);
        var authorTime = blame.match(/^author-time (\d+)$/m);
        parsedBlames.set(~~lineMatch[1], {
            author: author && author[1],
            authorMail: authorMail && authorMail[1],
            authorTime: authorTime && parseInt(authorTime[1], 10)
        });
    }
    return parsedBlames;
}
var Blamer = /** @class */ (function () {
    function Blamer() {
        /** Map from absolute file path to blame result */
        this.blames = new Map();
    }
    Blamer.prototype.blame = function (file, line) {
        var blamesObservable = this.blames.get(file);
        if (!blamesObservable) {
            blamesObservable = this.blameFile(file);
            this.blames.set(file, blamesObservable);
        }
        return blamesObservable
            .map(function (blames) {
            var blame = blames.get(line);
            if (!blame) {
                throw new Error("Line " + line + " does not exist in file " + file);
            }
            return blame;
        });
    };
    Blamer.prototype.blameFile = function (file) {
        var _this = this;
        var obs = new rxjs_1.Observable(function (observer) {
            console.log("Blaming " + file);
            // TODO use --porcelain
            var cp = child_process_1.spawn('git', ['blame', '--line-porcelain', file]);
            cp.stdout.on('data', function (chunk) { return observer.next(chunk); });
            cp.on('error', function (err) { return observer.error(err); });
            cp.on('exit', function (exitCode) {
                if (!exitCode) {
                    observer.complete();
                }
                else {
                    observer.error(new Error("git blame " + file + " exited with " + exitCode));
                }
            });
            return function () { return cp.kill(); };
        })
            .retryWhen(function (errors) {
            return errors
                .do(function (err) {
                if (err.code !== 'EAGAIN') {
                    throw err;
                }
            })
                .delay(500)
                .take(10)
                .map(function (err, i) {
                if (i === 10) {
                    throw err;
                }
            });
        })
            .reduce(function (buffer, chunk) { return buffer + chunk; }, '')
            .map(parseBlameOutput)
            .do(undefined, function (err) {
            _this.blames.delete(file);
        })
            .publishReplay()
            .refCount();
        this.blames.set(file, obs);
        return obs;
    };
    return Blamer;
}());
exports.Blamer = Blamer;
//# sourceMappingURL=git.js.map