import { AbortController } from 'abort-controller'
import chalk from 'chalk'
import ora = require('ora')
import * as os from 'os'
import split = require('split')
import * as yargs from 'yargs'
import { Complaint, parsers } from './complaints'
import { Blamer, CommitInfo, EUNKNOWNLINE } from './git'
import { checkBlame, Member } from './lint-blame'

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
        description: 'A list of { email, name } members that rules should apply for',
    })
    .option('format', {
        alias: 'f',
        description: 'The complaint format to parse',
        choices: ['tslint4', 'tslint5', 'tsconfig'],
        required: true,
    })
    .option('since', {
        type: 'string',
        coerce: since => new Date(since),
        description: 'A point in time before which rules do not apply',
    }).argv as Arguments

if (!argv.file && process.stdin.isTTY) {
    throw new Error('No input on STDIN')
}

const parseComplaint = parsers[argv.format]
if (!parseComplaint) {
    throw new Error(`Unknown complaint format: ${argv.format}`)
}

const formatBlame = (blame: CommitInfo | null): string => {
    if (!blame) {
        return chalk.red('Not Committed Yet')
    }
    const author = blame.author || 'No Author'
    const date = (blame.authorTime && blame.authorTime.toLocaleString()) || 'No Author Date'
    return `${chalk.yellow(blame.sha1.slice(0, 7))} ${chalk.cyan(author)} ${chalk.magenta(date)}`
}

process.on('uncaughtException', err => {
    throw err
})
process.on('unhandledRejection', err => {
    throw err
})

const blamer = new Blamer(os.cpus().length)

let totalComplaints = 0
let validComplaints = 0

const abortController = new AbortController()

for (const signal of ['SIGTERM', 'SIGINT'] as NodeJS.Signals[]) {
    process.on(signal, () => {
        abortController.abort()
        process.exit()
    })
}
process.on('exit', () => abortController.abort())

const spinner = ora('waiting for input on STDIN').start()

// Read lines from STDIN
const lineStream = process.stdin.pipe(split())
const promises: Promise<void>[] = []
lineStream.on('data', (line: string) => {
    promises.push(
        (async () => {
            line = line.trim()
            spinner.text = line
            if (!line) {
                return
            }
            let complaint: Complaint | undefined
            try {
                complaint = parseComplaint(line + '')
                if (!complaint) {
                    return
                }
                totalComplaints++
                const blame = await blamer.blameLine(complaint.filePath, complaint.line, abortController.signal)
                // If the line is committed and does not match our filters, ignore it
                if (blame && !checkBlame(blame, argv)) {
                    return
                }
                spinner.stop()
                spinner.clear()
                process.stdout.write(`${formatBlame(blame)} ${line}\n`)
                spinner.start()
                validComplaints++
                process.exitCode = 1
            } catch (err) {
                // Linters can report an error on the line that contains EOL, but git blame can't blame it
                if (err.code === EUNKNOWNLINE) {
                    return
                }
                throw err
            }
        })()
    )
})

lineStream.on('end', async () => {
    await Promise.all(promises)
    spinner.stop()
    process.stdout.write(
        `\n${validComplaints} complaints (${totalComplaints} total, ${totalComplaints - validComplaints} ignored)\n`
    )
})
