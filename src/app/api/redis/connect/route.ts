import { createClient } from 'redis';
import { NextResponse } from 'next/server';
import { AppError, ErrorCodes } from '@/app/lib/errors';

const REDIS_URL = process.env.NEXT_PUBLIC_REDIS_URL;

export async function GET() {
  try {
    const redisClient = createClient({ url: REDIS_URL });
    redisClient.on('error', (err) => console.error('Redis Client Error:', err));
    await redisClient.connect();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error setting up Redis:", error);
    return NextResponse.json({ success: false, error: "Failed to connect to Redis" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const redisClient = createClient({ url: REDIS_URL });
    await redisClient.connect();

    const pingResponse = await redisClient.ping();

    if (pingResponse !== 'PONG') {
      throw new AppError(
        'Redis connection test failed',
        ErrorCodes.REDIS_CONNECTION
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Redis connection successful',
      response: pingResponse 
    });
  } catch (error) {
    console.error('Redis ping error:', error);
    
    if (error instanceof AppError) {
      return NextResponse.json({ 
        success: false, 
        error: error.message,
        code: error.code 
      }, { status: error.status || 500 });
    }

    return NextResponse.json({ 
      success: false, 
      error: 'Failed to connect to Redis',
      code: ErrorCodes.REDIS_CONNECTION 
    }, { status: 500 });
  }
} 