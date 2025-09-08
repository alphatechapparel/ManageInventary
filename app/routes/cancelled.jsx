import { json } from '@remix-run/node';
import axios from 'axios';
import { getInventoryItemId } from '../utils/shopifyUtils';
import setInventoryAvailable from '../utils/syncInventory';
import { transformGenderSKU } from '../utils/transformSKU';

const shopifyBaseURL = `https://${process.env.SHOPIFY_STORE}.myshopify.com/admin/api/2023-04`;

export const action = async ({ request }) => {
  const order = await request.json();
  const lineItems = order.line_items || [];

  if (!lineItems.length) {
    return json({ error: 'No line items found in order' }, { status: 400 });
  }

  try {
    // Get fulfillment orders to determine locations
    const foResponse = await axios.get(`${shopifyBaseURL}/orders/${order.id}/fulfillment_orders.json`, {
      headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    const fulfillmentOrders = foResponse.data.fulfillment_orders;

    for (const item of lineItems) {
      const originalSKU = item.sku;
      if (!originalSKU) {
        console.warn(`Skipping item without SKU: ${item.title}`);
        continue;
      }

      if (originalSKU?.endsWith('DNS')) {
        console.warn(`SKU ${originalSKU} has "DNS" tag. Skipping inventory adjustment.`);
        continue;
      }

      // Transform SKU to find the corresponding transgender variant
      let transformedSKU;
      try {
        transformedSKU = transformGenderSKU(originalSKU);
      } catch (err) {
        console.warn(`Skipping invalid SKU ${originalSKU}: ${err.message}`);
        continue;
      }

      // Find the assigned location for this line item
      let locationId = null;
      for (const fo of fulfillmentOrders) {
        for (const foItem of fo.line_items) {
          if (foItem.line_item_id === item.id) {
            locationId = fo.assigned_location_id; // Get the location ID from the fulfillment order
            break;
          }
        }
        if (locationId) break;
      }

      if (!locationId) {
        console.warn(`No assigned location found for item ${item.id} with SKU ${originalSKU}. Skipping.`);
        continue;
      }

      console.log(`Processing SKU ${originalSKU} -> ${transformedSKU} at location ${locationId}`);

      // Get inventory item ID for the transformed SKU
      const transformedInventoryItemId = await getInventoryItemId(transformedSKU);

      // Get current available inventory for the transformed SKU at the assigned location
      const transformedLevelResponse = await axios.get(`${shopifyBaseURL}/inventory_levels.json`, {
        params: {
          inventory_item_ids: transformedInventoryItemId,
          location_ids: locationId // Ensure we are checking the correct location
        },
        headers: {
          'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      });

      const transformedLevel = transformedLevelResponse.data.inventory_levels[0];
      if (!transformedLevel) {
        console.warn(`No inventory level found for transformed SKU ${transformedSKU} at location ${locationId}. Skipping.`);
        continue;
      }

      // Increase the inventory for the transformed SKU
      const newTransformedAvailableQuantity = transformedLevel.available + item.quantity;
      await setInventoryAvailable(transformedSKU, locationId, newTransformedAvailableQuantity);

      console.log(`Adjusted inventory for transformed SKU ${transformedSKU} to ${newTransformedAvailableQuantity} at location ${locationId}`);
    }

    return json({ message: `✅ Processed inventory adjustment for cancelled order ${order.id}` });
  } catch (err) {
    console.error("❌ Error:", err.response?.data || err.message);
    return json({ error: '❌ Error updating inventory' }, { status: 500 });
  }
};
