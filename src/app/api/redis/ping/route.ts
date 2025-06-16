import { createClient } from 'redis';
import { NextResponse } from 'next/server';
import { AppError, ErrorCodes } from '@/app/lib/errors';

const REDIS_URL = process.env.NEXT_PUBLIC_REDIS_URL;

export async function GET() {
  try {
    const redisClient = createClient({ url: REDIS_URL });
    await redisClient.connect();

    const pingResponse = await redisClient.ping();
    await redisClient.disconnect();

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