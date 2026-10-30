import { Link } from 'react-router';
import { Layout } from '../components/Layout';
import { usePageTitle } from '../routing/usePageTitle';
import styles from './NotFoundPage.module.css';

export function NotFoundPage() {
  usePageTitle('Page not found');
  return (
    <Layout current={null}>
      <div className={styles.page}>
        <h1 className={styles.title}>Page not found</h1>
        <p>
          There is no page at this address. If you typed it, check that it is right. Some pages aren't built yet: the
          library, quests, fellowship and profile come later.
        </p>
        <p>
          <Link to="/">Go to your chronicle</Link>
        </p>
      </div>
    </Layout>
  );
}
