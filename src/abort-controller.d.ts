declare module 'abort-controller' {
    export class AbortController {
        signal: AbortSignal
        abort(): void
    }

    export class AbortSignal extends EventTarget {
        aborted: boolean
        onabort: (event: Event) => void
    }
}
