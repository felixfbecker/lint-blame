export declare type ComplaintParser = (line: string) => Complaint;
export interface Complaint {
    line: number;
    column: number;
    filePath: string;
}
export declare namespace parsers {
    const tslint4: ComplaintParser;
    const tslint5: ComplaintParser;
    const tsconfig: ComplaintParser;
}
