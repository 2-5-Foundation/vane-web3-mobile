'use server'

import { sr25519Sign, sr25519PairFromSeed } from '@polkadot/util-crypto';

// address is the msg to be signed
export async function signClientAuth(address: string):Promise<Uint8Array> {
    const seed = process.env.VANE_PRIVATE_KEY;
    if (!seed) {
        throw new Error('vane auth is not set');
    }
    const pair = sr25519PairFromSeed(seed);
    const message = new TextEncoder().encode(address);
    const signature = sr25519Sign(message,pair);

    return signature;

}