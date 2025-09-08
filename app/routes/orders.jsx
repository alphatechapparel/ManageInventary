import { json } from '@remix-run/node';
import axios from 'axios'; 
import { getInventoryItemId } from '../utils/shopifyUtils';
import setInventoryAvailable from '../utils/syncInventory';
import { transformGenderSKU } from '../utils/transformSKU';

const shopifyBaseURL = `https://${process.env.SHOPIFY_STORE}.myshopify.com/admin/api/2023-04`;

export const loader = async ({ request }) => {
 
  return json(
      { success: true, token:process.env.SHOPIFY_ACCESS_TOKEN,shopifyBaseURL:shopifyBaseURL },
      { status: 200 }
    );
};

export const action = async ({ request }) => {
    console.log("Received webhook request:", request);
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
      console.log(item,"temmmmm");
      const originalSKU = item.sku;
      if (item.variant_inventory_management == null) {
           console.warn(`Skipping item without track quantity product`);
         continue;
      }
      if (!originalSKU) {
        console.warn(`Skipping item without SKU: ${item.title}`);
        continue;
      }

      if (originalSKU?.endsWith('DNS')) {
        console.warn(`SKU ${originalSKU} has "DNS" tag. Skipping inventory adjustment.`);
        continue;
      }

      // Fetch product details to check for "base layer" tag
      // const productResponse = await axios.get(`${shopifyBaseURL}/products.json`, {
      //   headers: {
      //     'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
      //     'Content-Type': 'application/json'
      //   }
      // });

      // const productWithTag = productResponse.data.products.find(product => {
      //   return product.variants.some(variant => variant.sku === originalSKU) && product.tags.includes('DNS');
      // });

      // if (productWithTag) {
      //   console.warn(`SKU ${originalSKU} does  have "base layer" tag. Skipping inventory adjustment.`);
      //   continue;
      // }

      // Transform SKU to opposite gender
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
            locationId = fo.assigned_location_id;
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

      // Get original inventory item ID
      const originalInventoryItemId = await getInventoryItemId(originalSKU);

      // Get current available for original at location
      const levelResponse = await axios.get(`${shopifyBaseURL}/inventory_levels.json`, {
        params: {
          inventory_item_ids: originalInventoryItemId,
          location_ids: locationId
        },
        headers: {
          'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      });

      const originalLevel = levelResponse.data.inventory_levels[0];
      if (!originalLevel) {
        console.warn(`No inventory level found for original SKU ${originalSKU} at location ${locationId}. Skipping.`);
        continue;
      }

      const targetAvailable = originalLevel.available;
      console.log(`Original SKU ${originalSKU} has available: ${targetAvailable} at location ${locationId}`);

      // Set inventory for transformed SKU at the same location to match available
      await setInventoryAvailable(transformedSKU, locationId, targetAvailable);
    }

    return json({ message: `Processed inventory sync for order ${order.id}` });
  } catch (err) {
    console.error(" Error:", err.response?.data || err.message);
    return json({ error: ' Error updating inventory' }, { status: 500 });
  }
};
