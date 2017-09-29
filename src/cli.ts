
import { Observable } from 'rxjs'
import * as yargs from 'yargs'
import { parsers } from './complaints'
import { Blamer } from './git'
import { filterComplaintsByBlame, Member } from './lint-blame'

interface Arguments extends yargs.Arguments {
    file: string
    format: keyof typeof parsers
    since: Date
    members: Member[]
}

const argv = yargs
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
        coerce: since => new Date(since),
        description: 'A point in time before which rules do not apply'
    })
    .argv as Arguments

if (!argv.file && process.stdin.isTTY) {
    throw new Error('No input on STDIN')
}

// TODO publish this to npm as an rxjs operator, I have wanted this a few times!
const splitBy = (seperator: string) => (source: Observable<string>) =>
    source
        // Make sure we don't miss the last part
        .concat([seperator])
        .scan(({ buffer }, b) => {
            const splitted = (buffer + b).split('\n')
            const rest = splitted.pop()
            return { buffer: rest, lines: splitted }
        }, { buffer: '', lines: [] })
        // Each item here is a pair { buffer: string, items: string[] }
        // such that buffer contains the remaining input text that has no newline
        // and items contains the lines that have been produced by the last buffer
        .concatMap(({ lines }) => lines)

const parseComplaint = parsers[argv.format]
if (!parseComplaint) {
    throw new Error(`Unknown complaint format: ${argv.format}`)
}

const blamer = new Blamer()

let complaints = false

// Read lines from STDIN
const subscription = Observable.fromEvent<Buffer>(process.stdin, 'data')
    .map(buffer => buffer.toString())
    .let(splitBy('\n'))
    .mergeMap(line =>
        // TODO allow to specify the input format (e.g. tsconfig, tslint, ...)
        Observable.defer(() => Observable.of(parseComplaint(line)))
            // Ignore lines that are not complaints (e.g. warnings)
            .catch(err => [])
            .let(filterComplaintsByBlame(blamer, argv))
            // Remember if we had at least one complaint
            .do(() => complaints = true)
            // Pass line through (instead of parsed complaint object)
            .mapTo(line)
    )
    .concat([''])
    .subscribe(
        line => {
            process.stdout.write(line + '\n')
        },
        err => {
            console.error(err.stack)
            process.exit(2)
        },
        () => {
            process.exit(Number(complaints))
        }
    )

process.on('SIGTERM', () => subscription.unsubscribe())
process.on('exit', () => subscription.unsubscribe())
process.on('uncaughtException', err => {
    subscription.unsubscribe()
    throw err
})
