import { NextRequest, NextResponse } from 'next/server';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;

// Routes that require authentication
const ProtectedRoutes = [
    '/api/submissions',
    '/api/admin',
    '/api/users',
    '/api/dashboard',
    '/api/upload',
    '/api/notifications'
]

// Routes that require admin role
const adminRoutes = [
    '/api/admin',
    '/api/dashboard/admin'
]

export function proxy(req: NextRequest) {
    const { pathname } = req.nextUrl



    // GET /api/bounties is public
    // POST /api/bounties requires auth

    // Check if route needs protection
    const isBountyMutation =
        (pathname === '/api/bounties' && req.method === 'POST') ||
        (pathname.startsWith('/api/bounties/') && req.method !== 'GET')

    const isProtected = isBountyMutation || ProtectedRoutes.some(route => pathname.startsWith(route))

    const isAdmin = adminRoutes.some(route => pathname.startsWith(route))

    const authHeader = req.headers.get('authorization')
    const token = authHeader?.split(' ')[1] // "Bearer <token>"

    if (!isProtected) {
        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET) as {
                    userId: string
                    address: string
                    role: string
                }
                const requestHeaders = new Headers(req.headers)
                requestHeaders.set('x-user-id', decoded.userId)
                requestHeaders.set('x-user-role', decoded.role)
                requestHeaders.set('x-user-address', decoded.address)
                return NextResponse.next({ request: { headers: requestHeaders }})
            } catch {
                // Invalid token on public route: proceed without auth headers
            }
        }
        // Strip any spoofed x-user-* headers on public routes
        const cleanHeaders = new Headers(req.headers)
        cleanHeaders.delete('x-user-id')
        cleanHeaders.delete('x-user-role')
        cleanHeaders.delete('x-user-address')
        return NextResponse.next({ request: { headers: cleanHeaders } })
    }
    
    // Get token from Authorization header

    if (!token) {
        return NextResponse.json({error: 'Unauthorized'}, {status: 401})
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as {
            userId: string
            address: string
            role: string
        }

        // Check admin access
        if (isAdmin && decoded.role !== 'admin') {
            return NextResponse.json({error: 'Forbidden'}, { status: 403 })
        }

        // Pass user info to the route via headers
        const requestHeaders = new Headers(req.headers)
        requestHeaders.set('x-user-id', decoded.userId)
        requestHeaders.set('x-user-role', decoded.role)
        requestHeaders.set('x-user-address', decoded.address)

        return NextResponse.next({ request: { headers: requestHeaders }})
    } catch {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }
}

export const config = {
    matcher: '/api/:path*'
}
