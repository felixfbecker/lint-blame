import { Observable } from 'rxjs';
export interface Blame {
    author: string | null;
    authorMail: string | null;
    authorTime: number | null;
}
export declare class Blamer {
    /** Map from absolute file path to blame result */
    private blames;
    blame(file: string, line: number): Observable<Blame>;
    private blameFile(file);
}
