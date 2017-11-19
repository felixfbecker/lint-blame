import { AbortController, AbortSignal } from 'abort-controller'
import { execFile, spawn } from 'child_process'
import Semaphore from 'semaphore-async-await'

export interface CommitInfo {
    sha1: string
    author?: string
    authorMail?: string
    authorTime?: Date
    authorTz?: string
    committer?: string
    committerMail?: string
    committerTime?: Date
    committerTz?: string
    summary?: string
    previousHash?: string
    filename?: string
}

export interface LineInfo {
    code: string
    originalLine: number
    finalLine: number
    numLines: number
    commit: CommitInfo | null
}

interface BlamedLines {
    [line: number]: LineInfo | null
}

/**
 * Parses and sets data from a line following a commit header
 *
 * @param {array} lineArr The current line split by a space
 */
function parseCommitLine(line: string): Partial<CommitInfo> {
    const spaceIndex = line.indexOf(' ')
    const key = line.slice(0, spaceIndex)
    const value = line.slice(spaceIndex + 1)

    switch (key) {
        case 'author':
            return { author: value }
        case 'author-mail':
            return { authorMail: value }
        case 'author-time':
            return { authorTime: new Date(~~value * 1000) }
        case 'author-tz':
            return { authorTz: value }
        case 'committer':
            return { committer: value }
        case 'committer-mail':
            return { committerMail: value }
        case 'committer-time':
            return { committerTime: new Date(~~value * 1000) }
        case 'committer-tz':
            return { committerTz: value }
        case 'summary':
            return { summary: value }
        case 'filename':
            return { filename: value }
        case 'previous':
            return { previousHash: value }
    }
    return {}
}

const NOT_COMMITED_YET_SHA1 = '0'.repeat(40)

class BlameParser {
    public commitData: { [sha1: string]: CommitInfo } = {}
    public lineData: BlamedLines = {}

    private settingCommitData = false
    private currentCommitHash?: string
    private currentLineNumber = 1

    public parse(blame: string): void {
        // Split up the original document into an array of lines
        const lines = blame.split('\n')

        // Go through each line
        for (const line of lines) {
            // If we detect a tab character we know it's a line of code
            // So we can reset stateful variables
            if (line[0] === '\t') {
                // The first tab is an addition made by git, so get rid of it
                this.lineData[this.currentLineNumber]!.code = line.substr(1)
                this.settingCommitData = false
                this.currentCommitHash = undefined
            } else {
                // If we are in the process of collecting data about a commit summary
                if (this.settingCommitData) {
                    if (this.currentCommitHash) {
                        Object.assign(this.commitData[this.currentCommitHash], parseCommitLine(line))
                    }
                } else {
                    const [sha1, originalLineStr, finalLineStr, numLinesStr] = line.split(' ')

                    if (sha1 !== NOT_COMMITED_YET_SHA1) {
                        this.currentCommitHash = sha1
                    }
                    this.currentLineNumber = ~~finalLineStr

                    // Since the commit data (author, committer, summary, etc) only
                    // appear once in a porcelain output for every commit, we set
                    // it up once here and then expect that the next 8-11 lines of
                    // the file are dedicated to that data
                    if (!this.commitData[sha1]) {
                        this.settingCommitData = true
                        if (sha1 !== NOT_COMMITED_YET_SHA1) {
                            this.commitData[sha1] = { sha1 }
                        }
                    }

                    // Setup the new lineData hash
                    this.lineData[this.currentLineNumber] = {
                        code: '',
                        originalLine: ~~originalLineStr,
                        finalLine: ~~finalLineStr,
                        numLines: numLinesStr ? ~~numLinesStr : -1,
                        commit: sha1 !== NOT_COMMITED_YET_SHA1 ? this.commitData[sha1] : null,
                    }
                }
            }
        }
    }
}

export class Blamer {
    private concurrencyLimit: Semaphore

    /** Map from absolute file path to pending blame result */
    private blames = new Map<string, Promise<BlamedLines | null>>()

    constructor(concurrencyLimit: number) {
        this.concurrencyLimit = new Semaphore(concurrencyLimit)
    }

    public async blameLine(
        file: string,
        line: number,
        signal: AbortSignal = new AbortController().signal
    ): Promise<CommitInfo | null> {
        const blames = await this.memoizedBlameFile(file, signal)
        // Linters can report an error on the line that contains EOL, but git blame can't blame it
        const blame = blames && blames[line]
        return blame && blame.commit
    }

    private memoizedBlameFile(
        file: string,
        signal: AbortSignal = new AbortController().signal
    ): Promise<BlamedLines | null> {
        let promise = this.blames.get(file)
        if (!promise) {
            promise = this.blameFile(file, signal)
            this.blames.set(file, promise)
        }
        return promise
    }

    private async blameFile(
        file: string,
        signal: AbortSignal = new AbortController().signal
    ): Promise<BlamedLines | null> {
        await this.concurrencyLimit.wait()
        let stdout: string
        try {
            stdout = await new Promise<string>((resolve, reject) => {
                const child = execFile(
                    'git',
                    ['blame', '--porcelain', file],
                    { encoding: 'utf-8', maxBuffer: Infinity },
                    (err: any, stdout: string) => (err ? reject(err) : resolve(stdout))
                )
                signal.addEventListener('abort', () => {
                    child.kill()
                    reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }))
                })
            })
        } catch (err) {
            // If the path is not known to git, the file is not committed yet
            if (err.stderr && err.stderr.includes('no such path')) {
                return null
            }
            throw err
        }
        this.concurrencyLimit.signal()
        const blameParser = new BlameParser()
        blameParser.parse(stdout)
        return blameParser.lineData
    }
}
