"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Observable operator that filters a stream of complaints by blaming them and checking whether
 * they were caused by a given list of org members
 *
 * @param blamer  Blamer object to use that can cache blames
 */
exports.filterComplaintsByBlame = function (blamer, _a) {
    var _b = _a === void 0 ? {} : _a, members = _b.members, since = _b.since;
    return function (source) { return source
        .mergeMap(function (complaint) {
        return blamer.blame(complaint.filePath, complaint.line)
            .map(function (blame) {
            return (blame.author === 'Not Committed Yet'
                || !members
                || members.some(function (member) { return member.email === blame.authorMail || member.name === blame.author; })) && (!since
                || !blame.authorTime
                || blame.authorTime * 1000 < since.getTime());
        })
            .mergeMap(function (complaintApplies) { return complaintApplies ? [complaint] : []; });
    }, 20); };
};
//# sourceMappingURL=lint-blame.js.map