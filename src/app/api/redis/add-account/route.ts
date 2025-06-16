import { createClient } from 'redis';
import { NextResponse } from 'next/server';

const REDIS_URL = process.env.NEXT_PUBLIC_REDIS_URL;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    
    if (!address) {
      return NextResponse.json({ 
        success: false, 
        error: "Address is required" 
      }, { status: 400 });
    }

    const redisClient = createClient({ url: REDIS_URL });
    await redisClient.connect();

    const hash = await redisClient.hGet("ACCOUNT_LINK", address);
    if (!hash) {
      return NextResponse.json({ 
        success: false, 
        error: "No hash found for this address" 
      }, { status: 404 });
    }

    return NextResponse.json({ success: true, hash });
  } catch (error) {
    console.error('Error fetching account hash:', error);
    return NextResponse.json({ 
      success: false, 
      error: "Failed to fetch account hash" 
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { address, network, hash } = await request.json();
    
    if (!address || !network || !hash) {
      return NextResponse.json({ 
        success: false, 
        error: "Address, network, and hash are required" 
      }, { status: 400 });
    }

    const redisClient = createClient({ url: REDIS_URL });
    await redisClient.connect();

    // Store the address-hash mapping in ACCOUNT_LINK
    await redisClient.hSet("ACCOUNT_LINK", address, hash);

    // Get existing accounts for this hash
    const existingAccounts = await redisClient.hGet("ACCOUNT_PROFILE", hash);
    if (!existingAccounts) {
      return NextResponse.json({ 
        success: false, 
        error: "No existing account profile found for this hash" 
      }, { status: 404 });
    }

    // Parse existing accounts and add the new one
    const accounts = JSON.parse(existingAccounts as string);
    accounts.accounts.push({ address, network });

    // Update the account profile with the new account
    await redisClient.hSet("ACCOUNT_PROFILE", hash, JSON.stringify(accounts));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding account:', error);
    return NextResponse.json({ 
      success: false, 
      error: `Failed to add account: ${error}` 
    }, { status: 500 });
  }
} 