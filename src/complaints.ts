export type ComplaintParser = (line: string) => Complaint | undefined

export interface Complaint {
    line: number
    column: number
    filePath: string
}

export namespace parsers {
    export const tslint4: ComplaintParser = line => {
        const match = line.match(/^(.+)\[(\d+), (\d+)\]:/)
        if (!match) {
            return undefined
        }
        return {
            filePath: match[1],
            line: ~~match[2],
            column: ~~match[3],
        }
    }

    export const tslint5: ComplaintParser = line => {
        const match = line.match(/^ERROR: (.+)\[(\d+), (\d+)\]:/)
        if (!match) {
            return undefined
        }
        return {
            filePath: match[1],
            line: ~~match[2],
            column: ~~match[3],
        }
    }

    export const tsconfig: ComplaintParser = line => {
        const match = line.match(/^(.+)\((\d+),(\d+)\):/)
        if (!match) {
            return undefined
        }
        return {
            filePath: match[1],
            line: ~~match[2],
            column: ~~match[3],
        }
    }
}
