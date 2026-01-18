export class ChapterReadEvent {
    constructor(
        public readonly bookId: number,
        public readonly userId?: number,
        public readonly ipAddress?: string,
        public readonly userAgent?: string,
    ) { }
}
