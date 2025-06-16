import { createClient } from 'redis';
import { NextResponse } from 'next/server';
import { keccak256, toHex } from 'viem';

const REDIS_URL = process.env.NEXT_PUBLIC_REDIS_URL;

export async function POST(request: Request) {
  try {
    const { addresses } = await request.json();
    const redisClient = createClient({ url: REDIS_URL });
    await redisClient.connect();

    // check if the hash already exists
    const hashExist = await redisClient.hGet("ACCOUNT_LINK", addresses[0].address);
    if (hashExist) {
      return NextResponse.json({ success: true, message: "Address already registered" });
    }

    // store each address in redis pointing to a same hash
    const hash = keccak256(toHex(addresses[0].address));
    for (const accountInfo of addresses) {
      await redisClient.hSet("ACCOUNT_LINK", accountInfo.address, hash);
    }

    // store the array of address and network as value with the hash as the key in redis
    const value = JSON.stringify(addresses);
    await redisClient.hSet("QUEUE", hash, value);

    return NextResponse.json({ success: true, hash });
  } catch (error) {
    console.error('Error registering users in Redis:', error);
    return NextResponse.json({ success: false, error: `Failed to register users: ${error}` }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    
    if (!address) {
      return NextResponse.json({ success: false, error: "Address is required" }, { status: 400 });
    }

    const redisClient = createClient({ url: REDIS_URL });
    await redisClient.connect();

    const hash = await redisClient.hGet("ACCOUNT_LINK", address);
    if (!hash) {
      return NextResponse.json({ success: false, error: "Address not found" }, { status: 404 });
    }

    const accountProfile = await redisClient.hGet("ACCOUNT_PROFILE", hash);
    if (!accountProfile) {
      return NextResponse.json({ success: false, error: "Account profile not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, profile: JSON.parse(accountProfile as string) });
  } catch (error) {
    console.error('Error fetching account profile:', error);
    return NextResponse.json({ success: false, error: "Failed to fetch account profile" }, { status: 500 });
  }
} 