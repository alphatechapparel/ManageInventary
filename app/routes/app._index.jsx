import { useLoaderData } from "@remix-run/react";
import { Page, Layout, Card, Text, Banner } from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export default function Index() {
  return (
    <Page>
      <Layout>
        <Layout.Section>
          <Card>
            <Banner status="success" title="Inventory Sync Active">
              <Text as="p" variant="bodyMd">
                This app automatically syncs inventory between gender variants.
              </Text>
            </Banner>
          </Card>
        </Layout.Section>
        
        <Layout.Section>
          <Card title="How It Works">
            <Text as="p" variant="bodyMd">
              When an order is placed, the app will:
            </Text>
            <ul>
              <li>Check for "base layer" tag (skips if present)</li>
              <li>Find the opposite gender variant</li>
              <li>Sync inventory levels automatically</li>
            </ul>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}