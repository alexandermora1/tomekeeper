import { ApiError, NetworkError } from '../../api/client';

/** What a form shows after a failed submit: one message per field, and messages about the form as a whole. */
export interface FormErrors<Field extends string> {
  fields: Partial<Record<Field, string>>;
  general: string[];
}

export const OFFLINE_MESSAGE = "Tomekeeper couldn't be reached. Check your internet connection and try again.";
export const SERVER_MESSAGE = 'Something went wrong on our side. Try again in a moment.';

export function noErrors<Field extends string>(): FormErrors<Field> {
  return { fields: {}, general: [] };
}

/**
 * Turns whatever a failed API call threw into messages for the form. The API writes its messages for
 * readers, so they are shown as they are. Messages for fields this form doesn't have count as general.
 */
export function formErrorsFrom<Field extends string>(error: unknown, fieldNames: readonly Field[]): FormErrors<Field> {
  if (error instanceof NetworkError) return { fields: {}, general: [OFFLINE_MESSAGE] };
  if (!(error instanceof ApiError) || error.status >= 500) return { fields: {}, general: [SERVER_MESSAGE] };

  const result = noErrors<Field>();
  for (const [name, messages] of Object.entries(error.fieldErrors)) {
    if (isField(name, fieldNames) && messages[0]) result.fields[name] = messages[0];
    else result.general.push(...messages);
  }
  if (Object.keys(result.fields).length === 0 && result.general.length === 0) result.general.push(error.message);
  return result;
}

/** One message for an action that isn't a form, such as a button in a list of books. */
export function problemMessage(error: unknown): string {
  return formErrorsFrom(error, []).general[0] ?? SERVER_MESSAGE;
}

function isField<Field extends string>(name: string, fieldNames: readonly Field[]): name is Field {
  return (fieldNames as readonly string[]).includes(name);
}
