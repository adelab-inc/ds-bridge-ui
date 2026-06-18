import { NextRequest } from 'next/server';
import { proxyExternalGet } from '@/lib/external-proxy';

// 경량 폴링용: 디스크립션 해시만 조회 (crid = room_id)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ crid: string }> }
) {
  const { crid } = await params;
  return proxyExternalGet(request, `description/hash/${crid}`);
}
