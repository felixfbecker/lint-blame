import { Observable } from 'rxjs';
import { Complaint } from './complaints';
import { Blamer } from './git';
export interface Member {
    email: string;
    name: string;
}
export interface FilterOptions {
    /**
     * List of members that rules should apply for. If the blame matches one of these, the complaint
     * is passed through, otherwise it is filtered.
     */
    members?: Member[];
    /**
     * Date before which all complaints are dropped
     */
    since?: Date;
}
/**
 * Observable operator that filters a stream of complaints by blaming them and checking whether
 * they were caused by a given list of org members
 *
 * @param blamer  Blamer object to use that can cache blames
 */
export declare const filterComplaintsByBlame: (blamer: Blamer, {members, since}?: FilterOptions) => (source: Observable<Complaint>) => Observable<Complaint>;
