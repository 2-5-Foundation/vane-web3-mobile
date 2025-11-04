// app/api/prepare-solana/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { LAMPORTS_PER_SOL, PublicKey, Connection as SolanaConnection, SystemProgram, TransactionMessage, VersionedTransaction } from '@solana/web3.js'
import { ChainSupported, Token, TxStateMachine } from '@/lib/vane_lib/main'
import {
  getAssociatedTokenAddress, createTransferCheckedInstruction, transfer,
  createAssociatedTokenAccountInstruction,getMint,
  TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID
} from '@solana/spl-token';
import { fromWire, toWire } from '@/lib/vane_lib/pkg/host_functions/networking';


export const runtime = 'nodejs'

const RPC_URL = process.env.SOLANA_RPC_URL!

const bad = (status: number, msg: string) =>
  NextResponse.json({ error: msg }, { status })
  
function isNativeSolToken(token: Token): boolean {
  if ('Solana' in token) {
    return token.Solana === 'SOL';
  }
  return false;
}

async function getSPLTokenAddress(token: Token, network: ChainSupported): Promise<string | null> {
  // Support Solana network only
  const isSolana = network === ChainSupported.Solana;
  if (!isSolana) return null;

  if ('Solana' in token && typeof token.Solana === 'object' && 'SPL' in token.Solana) {
    return token.Solana.SPL.address || null;
  }

  return null;
}

export async function POST(req: NextRequest) {
  if (!RPC_URL) return bad(500, 'Server not configured')
    const body = await req.json().catch(() => null) as { tx?: any } | null;
    if (!body?.tx) return bad(400, 'Missing { tx }');
  
    const tx = fromWire(body.tx)
    const connection = new SolanaConnection(RPC_URL, "confirmed");

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
    // Determine if this is native SOL or SPL token
    const isNativeSol = isNativeSolToken(tx.token);
    
    if (isNativeSol) {
      const from = new PublicKey(tx.senderAddress);
      const to   = new PublicKey(tx.receiverAddress);
    
      // Build the transfer instruction
      const lamports = tx.amount;
    
      // Safety check for lamports precision
      if (lamports > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error('lamports exceed JS safe integer range');
      }
  
      const transferIx = SystemProgram.transfer({
        fromPubkey: from,
        toPubkey: to,
        lamports: lamports,
      });
    
      // Compile to a v0 message
      const msgV0 = new TransactionMessage({
        payerKey: from,
        recentBlockhash: blockhash,
        instructions: [transferIx],
      }).compileToV0Message();
    
      const unsigned = new VersionedTransaction(msgV0);
      const messageBytes = unsigned.message.serialize();
  
      const fee = await connection.getFeeForMessage(unsigned.message, 'confirmed');
      const feesInSol = fee?.value ? fee.value / LAMPORTS_PER_SOL : 0;
      
      const updated: TxStateMachine = {
        ...tx,
        feesAmount: Number(feesInSol),
        callPayload: {
          solana: {
            callPayload: Array.from(messageBytes),
            latestBlockHeight: lastValidBlockHeight,
          }
        },
      };
      
      return NextResponse.json({
        prepared: toWire(updated),
      })
  
    } else {
      // SPL token transfer
      const tokenAddress  = await getSPLTokenAddress(tx.token, tx.senderAddressNetwork);
      if (!tokenAddress) {
        throw new Error(`Invalid SPL token address for ${JSON.stringify(tx.token)}`);
      }
      const mint = new PublicKey(tokenAddress);
      const info = await connection.getAccountInfo(mint);
      if (!info) throw new Error('Mint not found');
      const programId = info.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
      
      const fromAta = await getAssociatedTokenAddress(mint, new PublicKey(tx.senderAddress), false, programId);
      const toAta = await getAssociatedTokenAddress(mint, new PublicKey(tx.receiverAddress), false, programId);
      const ixs = [];
      const toInfo = await connection.getAccountInfo(toAta);
  
      if (!toInfo) {
        ixs.push(
          createAssociatedTokenAccountInstruction(
            new PublicKey(tx.senderAddress),
            toAta,
            new PublicKey(tx.receiverAddress),
            mint,
            programId
          )
        );
      }
  
      const minInfo = await getMint(connection, mint, 'confirmed',programId);
      const decimals = minInfo.decimals;
      
      ixs.push(
        createTransferCheckedInstruction(
          fromAta, mint, toAta, new PublicKey(tx.senderAddress), tx.amount, decimals, [], programId
        )
      );
     
      const msg = new TransactionMessage({
        payerKey: new PublicKey(tx.senderAddress),
        recentBlockhash: blockhash,
        instructions: ixs,
      }).compileToV0Message();
      
      const unsigned = new VersionedTransaction(msg);
      
      const messageBytes = unsigned.message.serialize();
  
      const fee = await connection.getFeeForMessage(unsigned.message, 'confirmed');
      const feesInSol = fee?.value ? fee.value / LAMPORTS_PER_SOL : 0;
      
      const updated: TxStateMachine = {
        ...tx,
        feesAmount: Number(feesInSol),
        callPayload: {
          solana: {
            callPayload: Array.from(messageBytes),
            latestBlockHeight: lastValidBlockHeight,
          }
        },
      };

      return NextResponse.json({
        prepared: toWire(updated),
      })
      
    }
}
