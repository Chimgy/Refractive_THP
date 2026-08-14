import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import '../styles/swagger-theme.css';
import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';

// Pulls the live OpenAPI document straight from Nest (SwaggerModule.setup
// in main.ts serves it at `${path}-json`), so this page tracks the API
// automatically as routes/DTOs change — nothing here to keep in sync by hand.
export default function DocsPage() {
  return (
    <div
      style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column' }}
    >
      <SiteHeader subtitle="API reference — auto-generated from source" />

      <main style={{ padding: '28px 34px 60px', flex: 1 }}>
        <SwaggerUI url="/api/docs-json" />
      </main>

      <SiteFooter />
    </div>
  );
}
