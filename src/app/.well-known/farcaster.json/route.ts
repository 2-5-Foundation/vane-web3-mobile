const getImageUrl = (relativePath: string): string => {
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://vaneweb3.com';
    return `${baseUrl}${relativePath.startsWith('/') ? relativePath : `/${relativePath}`}`;
};

const baseMiniAppManifest = {
    "accountAssociation": {  // these will be added in step 5
      "header": "",
      "payload": "",
      "signature": ""
    },
    "baseBuilder": {
      "ownerAddress": "0x" // add your Base Account address here
    },
    "miniapp": {
      "version": "1",
      "name": "vaneweb3",
      "homeUrl": "https://vaneweb3.com",
      "iconUrl": getImageUrl('/vane-logo.png'),
      "splashImageUrl": getImageUrl('/vane-safety-net.png'),
      "splashBackgroundColor": "[#1a2628]",
      "webhookUrl": "",
      "subtitle": "Your safety net for crypto transactions",
      "description": "Your safety net for crypto transactions",
      "screenshotUrls": [
        "",
        "",
        ""
      ],
      "primaryCategory": "transaction safety and security",
      "tags": ["revert transaction", "miniapp", "baseapp", "fund lost", "recover", "wrong address", "wrong network", "cross chain"],
      "heroImageUrl": getImageUrl('/vane-safety-net.png'),
      "tagline": "Your safety net for crypto transactions",
      "ogTitle": "VaneWeb3",
      "ogDescription": "Your safety net for crypto transactions",
      "ogImageUrl": getImageUrl('/vane-safety-net.png'),
      "noindex": true
    }
  }


function withValidProperties(properties: Record<string, undefined | string | string[]>) {
    return Object.fromEntries(
        Object.entries(properties).filter(([_, value]) => (Array.isArray(value) ? value.length > 0 : !!value))
    );
}

export async function GET() {
    const URL = process.env.NEXT_PUBLIC_URL as string;
    return Response.json(baseMiniAppManifest); 
}
