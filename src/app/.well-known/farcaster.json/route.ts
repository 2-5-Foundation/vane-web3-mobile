const ROOT_URL = 'https://vaneweb3.com';

const baseMiniAppManifest = {
    "accountAssociation": { 
      "header": "",
      "payload": "",
      "signature": ""
    },
    "baseBuilder": {
      "ownerAddress": "0xd4D7db1Ca4C5DC58a5315d4CF0ca4bc0656f6827" 
    },
    "miniapp": {
      "version": "1",
      "name": "Vane Web3",
      "homeUrl": "https://vaneweb3.com",
      "iconUrl": `${ROOT_URL}/vane-logo-icon.png`,
      "splashImageUrl": `${ROOT_URL}/vane-logo-icon.png`,
      "splashBackgroundColor": "#0A1919",
      "subtitle": "Your safety net for crypto transactions",
      "description": "Your safety net for crypto transactions",
      "primaryCategory": "finance,crypto, recovery, security, safety,",
      "tags": ["vane", "web3", "crypto", "transfers", "lost funds", "wrong address", "wrong network"],
      "heroImageUrl": `${ROOT_URL}/vane-safety-net.png`,
      "tagline": "Safety net for your crypto transfers",
      "ogTitle": "Vane Web3",
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
    return Response.json({
        accountAssociation: baseMiniAppManifest.accountAssociation,
        baseBuilder: baseMiniAppManifest.baseBuilder,
        miniapp: withValidProperties(baseMiniAppManifest.miniapp as unknown as Record<string, undefined | string | string[]>)
    });
}