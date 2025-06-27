import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { links } = await req.json()
  if (!Array.isArray(links)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  try {
    const tweets = await Promise.all(
      links.map(async (url: string) => {
        try {
          const oembedRes = await fetch(
            `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`,
            {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
              },
            }
          )
          if (!oembedRes.ok) throw new Error('oEmbed fetch failed')
          const data = await oembedRes.json()
          return { html: data.html }
        } catch {
          return { html: '' }
        }
      })
    )
    return NextResponse.json({ tweets })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch tweets' }, { status: 500 })
  }
} 