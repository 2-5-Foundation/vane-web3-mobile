const ROOT_URL = 'https://vaneweb3.com';

const baseMiniAppManifest = {
    "accountAssociation": {  // these will be added in step 5
      "header": "",
      "payload": "",
      "signature": ""
    },
    "baseBuilder": {
        "ownerAddress": "0xd4D7db1Ca4C5DC58a5315d4CF0ca4bc0656f6827"
    },
    "miniapp": {
      "version": "1",
      "name": "vaneweb3",
      "homeUrl": "https://vaneweb3.com",
      "iconUrl": `${ROOT_URL}/vane-logo.png`,
      "splashImageUrl": `${ROOT_URL}/vane-safety-net.png`,
      "splashBackgroundColor": "#141e20",
      "subtitle": "Your safety net for crypto transactions",
      "description": "Your safety net for crypto transactions",
      "primaryCategory": "transaction safety and security",
      "tags": ["revert transaction", "miniapp", "baseapp", "fund lost", "recover", "wrong address", "wrong network", "cross chain"],
      "heroImageUrl": `${ROOT_URL}/vane-safety-net.png`,
      "tagline": "Your safety net for crypto transactions",
      "ogTitle": "VaneWeb3",
      "ogDescription": "Your safety net for crypto transactions",
      "ogImageUrl": `${ROOT_URL}/vane-safety-net.png`,
      "noindex": true
    }
  }


function withValidProperties(properties: Record<string, undefined | string | string[]>) {
    return Object.fromEntries(
        Object.entries(properties).filter(([_, value]) => (Array.isArray(value) ? value.length > 0 : !!value))
    );
}

export async function GET() {
    return Response.json( {
        "accountAssociation": {  // these will be added in step 5
          "header": "",
          "payload": "",
          "signature": ""
        },
        "baseBuilder": {
            "ownerAddress": "0xd4D7db1Ca4C5DC58a5315d4CF0ca4bc0656f6827"
        },
        "miniapp": {
          "version": "1",
          "name": "vaneweb3",
          "homeUrl": "https://vaneweb3.com",
          "iconUrl": `${ROOT_URL}/vane-logo.png`,
          "splashImageUrl": `${ROOT_URL}/vane-safety-net.png`,
          "splashBackgroundColor": "#141e20",
          "subtitle": "Your safety net for crypto transactions",
          "description": "Your safety net for crypto transactions",
          "primaryCategory": "transaction safety and security",
          "tags": ["revert transaction", "miniapp", "baseapp", "fund lost", "recover", "wrong address", "wrong network", "cross chain"],
          "heroImageUrl": `${ROOT_URL}/vane-safety-net.png`,
          "tagline": "Your safety net for crypto transactions",
          "ogTitle": "VaneWeb3",
          "ogDescription": "Your safety net for crypto transactions",
          "ogImageUrl": `${ROOT_URL}/vane-safety-net.png`,
          "noindex": true
        }
      });
}