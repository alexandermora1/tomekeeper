import { apiRequest } from './client';
import type { ReaderCard } from './fellowship';

export interface Review {
  reader: ReaderCard;
  /** 1 to 5 stars. */
  rating: number;
  /** The words, or null for stars alone. */
  text: string | null;
  writtenAt: string;
  editedAt: string | null;
}

export interface BookReviews {
  /** The signed-in reader's own review. */
  mine: Review | null;
  /** Other readers' reviews you may see, newest first. */
  others: Review[];
}

/** A review on a reader's profile. bookId is null when you can't open the book's page. */
export interface ProfileReview {
  bookId: string | null;
  title: string;
  authors: string[];
  rating: number;
  text: string | null;
  writtenAt: string;
}

const path = (bookId: string) => `/api/books/${encodeURIComponent(bookId)}`;

export const reviews = {
  forBook: (bookId: string) => apiRequest<BookReviews>('GET', `${path(bookId)}/reviews`),
  /** Writes or changes your review. The book must be on your shelves. */
  save: (bookId: string, rating: number | null, text: string) => apiRequest<Review>('PUT', `${path(bookId)}/review`, { rating, text }),
  remove: (bookId: string) => apiRequest('DELETE', `${path(bookId)}/review`),
};
