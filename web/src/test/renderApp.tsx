import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';

/** Opens the whole site at a path, like typing the address in the browser. */
export function renderApp(path = '/') {
  window.history.replaceState(null, '', path);
  const user = userEvent.setup();
  return { user, ...render(<App />) };
}
