"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var rxjs_1 = require("rxjs");
var yargs = require("yargs");
var complaints_1 = require("./complaints");
var git_1 = require("./git");
var lint_blame_1 = require("./lint-blame");
var argv = yargs
    .usage('Usage: <linter> | blame-lint [options]')
    .version(require('../package.json').version)
    .default('config', './lint-blame.json')
    .config('config')
    .alias('c', 'config')
    .env('LINT_BLAME')
    .help()
    .option('members', {
    type: 'array',
    description: 'A list of { email, name } members that rules should apply for'
})
    .option('format', {
    alias: 'f',
    description: 'The complaint format to parse',
    choices: ['tslint4', 'tslint5', 'tsconfig'],
    required: true
})
    .option('since', {
    type: 'string',
    coerce: function (since) { return new Date(since); },
    description: 'A point in time before which rules do not apply'
})
    .argv;
if (!argv.file && process.stdin.isTTY) {
    throw new Error('No input on STDIN');
}
// TODO publish this to npm as an rxjs operator, I have wanted this a few times!
var splitBy = function (seperator) { return function (source) {
    return source
        .concat([seperator])
        .scan(function (_a, b) {
        var buffer = _a.buffer;
        var splitted = (buffer + b).split('\n');
        var rest = splitted.pop();
        return { buffer: rest, lines: splitted };
    }, { buffer: '', lines: [] })
        .concatMap(function (_a) {
        var lines = _a.lines;
        return lines;
    });
}; };
var parseComplaint = complaints_1.parsers[argv.format];
if (!parseComplaint) {
    throw new Error("Unknown complaint format: " + argv.format);
}
var blamer = new git_1.Blamer();
var complaints = false;
// Read lines from STDIN
var subscription = rxjs_1.Observable.fromEvent(process.stdin, 'data')
    .map(function (buffer) { return buffer.toString(); })
    .let(splitBy('\n'))
    .mergeMap(function (line) {
    // TODO allow to specify the input format (e.g. tsconfig, tslint, ...)
    return rxjs_1.Observable.defer(function () { return rxjs_1.Observable.of(parseComplaint(line)); })
        .catch(function (err) { return []; })
        .let(lint_blame_1.filterComplaintsByBlame(blamer, argv))
        .do(function () { return complaints = true; })
        .mapTo(line);
})
    .concat([''])
    .subscribe(function (line) {
    process.stdout.write(line + '\n');
}, function (err) {
    console.error(err.stack);
    process.exit(2);
}, function () {
    process.exit(Number(complaints));
});
process.on('SIGTERM', function () { return subscription.unsubscribe(); });
process.on('exit', function () { return subscription.unsubscribe(); });
process.on('uncaughtException', function (err) {
    subscription.unsubscribe();
    throw err;
});
//# sourceMappingURL=cli.js.map