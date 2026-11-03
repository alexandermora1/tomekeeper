import { apiRequest } from './client';

export type ReportReason = 'spam' | 'harassment' | 'offensive' | 'other';

export const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: 'spam', label: 'Spam or advertising' },
  { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'offensive', label: 'Hateful or offensive' },
  { id: 'other', label: 'Something else' },
];

export const reports = {
  /** Sends a report about a reader, or their review of a book, to the moderator. */
  send: (handle: string, bookId: string | null, reason: ReportReason | null, details: string) =>
    apiRequest<{ id: string }>('POST', '/api/reports', { handle, bookId, reason, details }),
};
