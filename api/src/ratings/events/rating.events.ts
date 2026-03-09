export class RatingChangedEvent {
  constructor(
    public readonly bookId: number,
    public readonly averageRating: number,
    public readonly ratingCount: number,
  ) {}
}
