import { CommitInfo } from './git'

export interface Member {
    email: string
    name: string
}

export interface FilterOptions {
    /**
     * List of members that rules should apply for. If the blame matches one of these, the complaint
     * is passed through, otherwise it is filtered.
     */
    members?: Member[]

    /**
     * Date before which all complaints are dropped
     */
    since?: Date
}

export const checkBlame = (blame: CommitInfo, { members, since }: FilterOptions = {}): boolean => (
    (
        blame.author === 'Not Committed Yet'
        || !members
        || members.some(member => member.email === blame.authorMail || member.name === blame.author)
    ) && (
        !since
        || !blame.authorTime
        || blame.authorTime.getTime() > since.getTime()
    )
)
