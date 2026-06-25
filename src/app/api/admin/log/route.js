import { NextResponse } from "next/server";
import { headers } from 'next/headers'
import { getRequestContext } from '@cloudflare/next-on-pages';
import { mockLog, mockEnabled } from '@/lib/mock';

// ...

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400', // 24 hours
  'Content-Type': 'application/json'
};

export const runtime = 'edge';
export async function POST(request) {
  // 获取客户端的IP地址
  try {
    let { page, query } = await request.json()

    if (mockEnabled()) {
      const { data, total } = mockLog(page, query);
      return Response.json({ code: 200, success: true, message: 'success', data, page, total });
    }

    const { env, cf, ctx } = getRequestContext();

    if (query) {
      const ps = env.IMG.prepare(`SELECT tgimglog.*, imginfo.rating,imginfo.total FROM tgimglog LEFT JOIN imginfo ON tgimglog.url = imginfo.url WHERE tgimglog.url LIKE ? ORDER BY tgimglog.id DESC LIMIT 10 OFFSET ? * 10`).bind(`%${query}%`, page);
      const { results } = await ps.all()
      const total = await env.IMG.prepare(`SELECT COUNT(*) as total FROM tgimglog WHERE url LIKE ?`).bind(`%${query}%`).first()
      return Response.json({
        "code": 200,
        "success": true,
        "message": "success",
        "data": results,
        "page": page,
        "total": total.total
      });
    } else {
      const ps = env.IMG.prepare(`SELECT tgimglog.*, imginfo.rating,imginfo.total FROM tgimglog LEFT JOIN imginfo ON tgimglog.url = imginfo.url ORDER BY tgimglog.id DESC LIMIT 10 OFFSET ? * 10`).bind(page);
      const { results } = await ps.all()
      const total = await env.IMG.prepare(`SELECT COUNT(*) as total FROM tgimglog`).first()
      return Response.json({
        "code": 200,
        "success": true,
        "message": "success",
        "data": results,
        "page": page,
        "total": total.total
      });
    }
  } catch (error) {

    return Response.json({
      "code": 500,
      "success": false,
      "message": error.message,
      "data": page,
    }, {
      status: 500,
      headers: corsHeaders,
    })
  }

}



