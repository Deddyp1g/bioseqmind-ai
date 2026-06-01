import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 900;

const BACKEND_API_BASE = (process.env.BIOSEQMIND_BACKEND_INTERNAL_URL ?? "http://127.0.0.1:8008/api").replace(/\/$/, "");

type RouteContext = {
  params: Promise<{ path: string[] }> | { path: string[] };
};

async function proxyToBackend(request: NextRequest, context: RouteContext): Promise<Response> {
  const params = await context.params;
  const pathname = params.path.map(encodeURIComponent).join("/");
  const target = new URL(`${BACKEND_API_BASE}/${pathname}`);
  target.search = request.nextUrl.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");
  headers.delete("accept-encoding");

  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    cache: "no-store",
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }

  const response = await fetch(target, init);
  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("transfer-encoding");
  responseHeaders.delete("connection");

  return new Response(response.body, {
    headers: responseHeaders,
    status: response.status,
    statusText: response.statusText,
  });
}

export function GET(request: NextRequest, context: RouteContext) {
  return proxyToBackend(request, context);
}

export function POST(request: NextRequest, context: RouteContext) {
  return proxyToBackend(request, context);
}

export function PUT(request: NextRequest, context: RouteContext) {
  return proxyToBackend(request, context);
}

export function PATCH(request: NextRequest, context: RouteContext) {
  return proxyToBackend(request, context);
}

export function DELETE(request: NextRequest, context: RouteContext) {
  return proxyToBackend(request, context);
}
