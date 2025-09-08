// app/utils/shopifyUtils.js
import axios from 'axios';

const shopifyBaseURL = `https://${process.env.SHOPIFY_STORE}.myshopify.com/admin/api/2023-04`;

export async function getInventoryItemId(sku) {
  try {
    // const response = await axios.get(`${shopifyBaseURL}/products.json?limit=250`, {
    //   headers: {
    //     'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
    //     'Content-Type': 'application/json'
    //   }
    // });

    // for (const product of response.data.products) {
    //   for (const variant of product.variants) {
    //     if (variant.sku === sku) {
    //       return variant.inventory_item_id;
    //     }
    //   }
    // }

////////////////////////////////
  const shopName = `https://${process.env.SHOPIFY_STORE}.myshopify.com`
        // const shopName = process.env.shop_Url;

        const myHeaders = new Headers();
        myHeaders.append("Content-Type", "application/json");
   
        myHeaders.append("X-Shopify-Access-Token",  process.env.SHOPIFY_ACCESS_TOKEN);
       



 const raw = JSON.stringify({
                "query": `query ProductVariantsList { productVariants(first: 1, query:\"sku:${sku}") { nodes { id title inventoryQuantity sku inventoryItem{ id }   product{id title} } pageInfo { startCursor endCursor } } }`
            });

            const requestOptions = {
                method: "POST",
                headers: myHeaders,
                body: raw,
                redirect: "follow"
            };

            try {
                const productVariantsFoundApiResponse = await fetch(`${shopName}/admin/api/2025-07/graphql.json`, requestOptions);
                const productVariantsFoundApiResult = await productVariantsFoundApiResponse.json();
                if (productVariantsFoundApiResult.data.productVariants.nodes.length > 0) {
                    
                    const inventoryItemId = productVariantsFoundApiResult.data.productVariants.nodes[0].inventoryItem.id;
                
                 const inventoryItemIdnumber = inventoryItemId.split('/').pop();
                    console.log("data   found for this variant",inventoryItemId);
                return inventoryItemIdnumber;
                } 
              }catch (err) {
    throw new Error('SKU');
  }


    // ////////////////////////////////
    throw new Error(`SKU ${sku} not found`);
  } catch (err) {
    throw new Error(`Failed to fetch products: ${err.response?.data?.errors || err.message}`);
  }
}
