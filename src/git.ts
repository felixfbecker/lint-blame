import { spawn } from 'child_process'
import { Observable } from 'rxjs'

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
    commit: CommitInfo
}

interface BlamedLines {
    [line: number]: LineInfo
}

class BlameParser {

    public commitData: { [sha1: string]: CommitInfo } = {}
    public lineData: BlamedLines = {}

    private settingCommitData = false
    private currentCommitHash = ''
    private currentLineNumber = 1

    public parse(blame: string): void {

        // Split up the original document into an array of lines
        const lines = blame.split('\n')

        // Go through each line
        // tslint:disable-next-line:prefer-for-of
        for (const line of lines) {

            // If we detect a tab character we know it's a line of code
            // So we can reset stateful variables
            if (line[0] === '\t') {
                // The first tab is an addition made by git, so get rid of it
                this.lineData[this.currentLineNumber].code = line.substr(1)
                this.settingCommitData = false
                this.currentCommitHash = ''
            } else {
                // If we are in the process of collecting data about a commit summary
                if (this.settingCommitData) {
                    this.parseCommitLine(line)
                } else {
                    const [sha1, originalLineStr, finalLineStr, numLinesStr] = line.split(' ')

                    this.currentCommitHash = sha1
                    this.currentLineNumber = ~~finalLineStr

                    // Since the commit data (author, committer, summary, etc) only
                    // appear once in a porcelain output for every commit, we set
                    // it up once here and then expect that the next 8-11 lines of
                    // the file are dedicated to that data
                    if (!this.commitData[sha1]) {
                        this.settingCommitData = true
                        this.commitData[sha1] = { sha1 }
                    }

                    // Setup the new lineData hash
                    this.lineData[this.currentLineNumber] = {
                        code: '',
                        originalLine: ~~originalLineStr,
                        finalLine: ~~finalLineStr,
                        numLines: numLinesStr ? ~~numLinesStr : -1,
                        commit: this.commitData[sha1]
                    }
                }
            }
        }
    }

    /**
     * Parses and sets data from a line following a commit header
     *
     * @param {array} lineArr The current line split by a space
     */
    public parseCommitLine(line: string): void {

        const currentCommitData = this.commitData[this.currentCommitHash]

        const spaceIndex = line.indexOf(' ')
        const key = line.slice(0, spaceIndex)
        const value = line.slice(spaceIndex + 1)

        switch (key) {
            case 'author':
                currentCommitData.author = value
                break

            case 'author-mail':
                currentCommitData.authorMail = value
                break

            case 'author-time':
                currentCommitData.authorTime = new Date(~~value * 1000)
                break

            case 'author-tz':
                currentCommitData.authorTz = value
                break

            case 'committer':
                currentCommitData.committer = value
                break

            case 'committer-mail':
                currentCommitData.committerMail = value
                break

            case 'committer-time':
                currentCommitData.committerTime = new Date(~~value * 1000)
                break

            case 'committer-tz':
                currentCommitData.committerTz = value
                break

            case 'summary':
                currentCommitData.summary = value
                break

            case 'filename':
                currentCommitData.filename = value
                break

            case 'previous':
                currentCommitData.previousHash = value
                break
        }
    }
}

export class Blamer {

    /** Map from absolute file path to blame result */
    private blames = new Map<string, Observable<BlamedLines>>()

    public blame(file: string, line: number): Observable<CommitInfo> {
        let blamesObservable = this.blames.get(file)
        if (!blamesObservable) {
            blamesObservable = this.blameFile(file)
            this.blames.set(file, blamesObservable)
        }
        return blamesObservable
            .mergeMap(blames => {
                const blame = blames[line]
                if (!blame) {
                    // Linters can report an error on the line that contains EOL, but git blame can't blame it
                    return []
                }
                return [blame.commit]
            })
    }

    private blameFile(file: string): Observable<BlamedLines> {
        const obs = new Observable<Buffer>(observer => {
            let stderr = ''
            const child = spawn('git', ['blame', '--porcelain', file])
            child.on('error', err => observer.error(err))
            child.on('exit', (exitCode: number) => {
                if (!exitCode) {
                    observer.complete()
                } else {
                    observer.error(new Error(`git blame ${file} exited with ${exitCode} ${stderr}`))
                }
            })
            if (child.stdout) {
                child.stdout.on('data', (chunk: Buffer) => observer.next(chunk))
            }
            if (child.stderr) {
                child.stderr.on('data', (chunk: Buffer) => stderr += chunk)
            }
            return () => child.kill()
        })
            .retryWhen(errors =>
                errors
                    .do(err => {
                        if (err.code !== 'EAGAIN') {
                            throw err
                        }
                    })
                    .delay(500)
                    .take(10)
                    .map((err, i) => {
                        if (i === 10) {
                            throw err
                        }
                    })
            )
            .reduce((buffer, chunk) => buffer + chunk, '')
            .map(output => {
                const blameParser = new BlameParser()
                blameParser.parse(output)
                return blameParser.lineData
            })
            .do(undefined as any, err => {
                this.blames.delete(file)
            })
            .publishReplay()
            .refCount()
        this.blames.set(file, obs)
        return obs
    }
}
