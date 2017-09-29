import { spawn } from 'child_process'
import { Observable } from 'rxjs'

export interface Blame {
    author: string | null
    authorMail: string | null
    authorTime: number | null
}

type BlamedLines = Map<number, Blame>

/**
 * Parses the result of a `git blame --porcelain`
 * Returns a Map from line number to parsed blame for that line.
 * Every line of the file will be present.
 */
function parseBlameOutput(output: string): BlamedLines {
    // the --porcelain format prints at least one header line per source line,
    // then the source line prefixed by a tab character
    const blames = output.trim().split(/^\t.*\n/m)
    const parsedBlames = new Map<number, Blame>()
    for (const blame of blames) {
        // https://git-scm.com/docs/git-blame#_the_porcelain_format
        // commit-hash original-line final-line group-length
        const lineMatch = blame.match(/^\w{40} \d+ (\d+)/)
        if (!lineMatch) {
            throw new Error(`Invalid blame input ${blame}`)
        }
        const authorMail = blame.match(/^author-mail <(.+)>$/m)
        const author = blame.match(/^author (.+)$/m)
        const authorTime = blame.match(/^author-time (\d+)$/m)
        parsedBlames.set(~~lineMatch[1], {
            author: author && author[1],
            authorMail: authorMail && authorMail[1],
            authorTime: authorTime && parseInt(authorTime[1], 10)
        })
    }
    return parsedBlames
}

export class Blamer {

    /** Map from absolute file path to blame result */
    private blames = new Map<string, Observable<BlamedLines>>()

    public blame(file: string, line: number): Observable<Blame> {
        let blamesObservable = this.blames.get(file)
        if (!blamesObservable) {
            blamesObservable = this.blameFile(file)
            this.blames.set(file, blamesObservable)
        }
        return blamesObservable
            .map(blames => {
                const blame = blames.get(line)
                if (!blame) {
                    throw new Error(`Line ${line} does not exist in file ${file}`)
                }
                return blame
            })
    }

    private blameFile(file: string): Observable<BlamedLines> {
        const obs = new Observable<Buffer>(observer => {
            console.log(`Blaming ${file}`)
            // TODO use --porcelain
            const cp = spawn('git', ['blame', '--line-porcelain', file])
            cp.stdout.on('data', (chunk: Buffer) => observer.next(chunk))
            cp.on('error', err => observer.error(err))
            cp.on('exit', (exitCode: number) => {
                if (!exitCode) {
                    observer.complete()
                } else {
                    observer.error(new Error(`git blame ${file} exited with ${exitCode}`))
                }
            })
            return () => cp.kill()
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
            .map(parseBlameOutput)
            .do(undefined as any, err => {
                this.blames.delete(file)
            })
            .publishReplay()
            .refCount()
        this.blames.set(file, obs)
        return obs
    }
}
