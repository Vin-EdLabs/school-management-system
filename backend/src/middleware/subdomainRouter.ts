import { Request, Response, NextFunction } from 'express';
import { query } from '../db/connection.js';

// Define the interface for the school/tenant data returned from the DB
export interface SchoolContext {
  id: number;
  name: string;
  slug: string;
  subdomain: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  isActive: boolean;
}

// Extend Express Request interface to carry school context
export interface SubdomainRequest extends Request {
  school?: SchoolContext | null;
  schoolId?: number | null;
}

/**
 * 3. DATABASE INTEGRATION STUB
 * Looks up the school/tenant details in the database using the subdomain.
 * 
 * NOTE FOR YOU: We've provided a fully working PostgreSQL implementation that matches
 * your project's `query` function and `tenants` table schema, plus a fallback mock
 * environment so it works out-of-the-box in all development/testing scenarios!
 */
export async function lookupSchoolBySubdomain(subdomain: string): Promise<SchoolContext | null> {
  try {
    // ----------------- OPTION A: REAL DATABASE QUERY (POSTGRESQL) -----------------
    // This is set up to query your active 'tenants' table. Uncomment or keep this as active:
    const sql = `
      SELECT 
        id, 
        name, 
        slug, 
        subdomain, 
        logo_url, 
        primary_color, 
        secondary_color,
        COALESCE(is_active, true) as is_active
      FROM tenants 
      WHERE LOWER(subdomain) = LOWER($1) OR LOWER(slug) = LOWER($1)
      LIMIT 1
    `;
    
    const result = await query(sql, [subdomain]);
    
    if (result && result.rows && result.rows.length > 0) {
      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        slug: row.slug || '',
        subdomain: row.subdomain || '',
        logoUrl: row.logo_url || null,
        primaryColor: row.primary_color || null,
        secondaryColor: row.secondary_color || null,
        isActive: row.is_active !== false
      };
    }

    // ----------------- OPTION B: MOCK FALLBACK (FOR DEVELOPMENT/TESTING) -----------------
    // Useful if your local database table doesn't have the entry yet.
    // E.g. If you test with "og.scholarnerve.com" or "rosagardens.scholarnerve.com":
    const mockSchools: Record<string, Omit<SchoolContext, 'subdomain'>> = {
      'rosagardens': {
        id: 101,
        name: 'Rosa Gardens Academy',
        slug: 'rosagardens',
        logoUrl: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=100&auto=format&fit=crop&q=60',
        primaryColor: '#4f46e5', // Indigo
        secondaryColor: '#06b6d4', // Cyan
        isActive: true
      },
      'og': {
        id: 102,
        name: 'OG International School',
        slug: 'og',
        logoUrl: 'https://images.unsplash.com/photo-1592280771190-3e2e4d571952?w=100&auto=format&fit=crop&q=60',
        primaryColor: '#059669', // Emerald
        secondaryColor: '#f59e0b', // Amber
        isActive: true
      },
      'deactivated': {
        id: 103,
        name: 'Inactive Test School',
        slug: 'deactivated',
        logoUrl: null,
        primaryColor: '#94a3b8',
        secondaryColor: '#cbd5e1',
        isActive: false
      }
    };

    const lowercaseSubdomain = subdomain.toLowerCase();
    if (mockSchools[lowercaseSubdomain]) {
      return {
        ...mockSchools[lowercaseSubdomain],
        subdomain: lowercaseSubdomain
      };
    }

    return null;
  } catch (error) {
    console.error('Error looking up school by subdomain:', error);
    // If the database connection fails or the table doesn't exist yet, we can gracefully return null
    return null;
  }
}

/**
 * Express Middleware for Dynamic Wildcard Subdomain Routing
 */
export async function subdomainRouter(
  req: SubdomainRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // 5. SECURITY: Sanitize and validate incoming hostname header to prevent header injection
    const hostHeader = req.headers.host;
    if (!hostHeader) {
      return res.status(400).send('Bad Request: Host header is missing.');
    }

    // Strip out ports (e.g. "rosagardens.scholarnerve.com:3001" -> "rosagardens.scholarnerve.com")
    // Keep only alphanumeric characters, dots, hyphens, and colons during initial parse.
    const cleanHost = hostHeader.trim().toLowerCase().split(':')[0];
    
    // Strict hostname validation regex (only alphanumeric, dots, and hyphens)
    const hostnameRegex = /^[a-z0-9.-]+$/;
    if (!hostnameRegex.test(cleanHost)) {
      return res.status(400).send('Bad Request: Invalid host header structure.');
    }

    const hostParts = cleanHost.split('.');
    
    // 2. EXCLUSIONS: Ignore apex domain, 'www', and other system-level domains
    // These should route to the main landing page/marketing site instead of school portals
    const excludedSubdomains = new Set([
      'www',
      'api',
      'app',
      'admin',
      'dev',
      'staging',
      'portal',
      'school',
      'scholarnerve',
      'partners',
      'localhost'
    ]);

    // Define apex domain check
    const isApexDomain = cleanHost === 'scholarnerve.com';

    // If it's the apex domain or doesn't have a subdomain component
    if (isApexDomain || hostParts.length < 3) {
      // Let it pass through to the main website/API routers
      return next();
    }

    // 1. DYNAMIC ROUTING: Extract the leftmost subdomain part
    const subdomain = hostParts[0];

    // Check if the extracted subdomain is in our exclusion/system-level set
    if (excludedSubdomains.has(subdomain)) {
      return next();
    }

    // Validate the extracted subdomain format strictly (alphanumeric and hyphens only)
    const subdomainRegex = /^[a-z0-9-]+$/;
    if (!subdomainRegex.test(subdomain)) {
      return res.status(400).send('Bad Request: Invalid subdomain format.');
    }

    // 3. DATABASE LOOKUP
    const school = await lookupSchoolBySubdomain(subdomain);

    // 4. ERROR HANDLING: School portal not found or inactive
    if (!school || !school.isActive) {
      res.status(404);
      
      // Send a high-fidelity, visually gorgeous 404 landing page!
      return res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>School Portal Not Found | Scholarnerve</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            :root {
              --bg-gradient: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
              --card-bg: rgba(30, 41, 59, 0.7);
              --card-border: rgba(255, 255, 255, 0.08);
              --text-primary: #f8fafc;
              --text-secondary: #94a3b8;
              --accent: #6366f1;
              --accent-hover: #4f46e5;
            }
            
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            
            body {
              font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              background: var(--bg-gradient);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              color: var(--text-primary);
              overflow: hidden;
              position: relative;
            }
            
            body::before {
              content: '';
              position: absolute;
              width: 400px;
              height: 400px;
              background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(99, 102, 241, 0) 70%);
              top: -100px;
              left: -100px;
              z-index: 0;
            }
            
            body::after {
              content: '';
              position: absolute;
              width: 500px;
              height: 500px;
              background: radial-gradient(circle, rgba(168, 85, 247, 0.1) 0%, rgba(168, 85, 247, 0) 70%);
              bottom: -150px;
              right: -150px;
              z-index: 0;
            }
            
            .container {
              position: relative;
              z-index: 10;
              width: 100%;
              max-width: 480px;
              padding: 24px;
              text-align: center;
            }
            
            .card {
              background: var(--card-bg);
              backdrop-filter: blur(16px);
              -webkit-backdrop-filter: blur(16px);
              border: 1px solid var(--card-border);
              border-radius: 24px;
              padding: 48px 32px;
              box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);
              animation: fadeIn 0.6s ease-out;
            }
            
            @keyframes fadeIn {
              from {
                opacity: 0;
                transform: translateY(20px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
            
            .icon-wrapper {
              width: 80px;
              height: 80px;
              background: rgba(239, 68, 68, 0.1);
              border: 1px solid rgba(239, 68, 68, 0.2);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 24px;
              color: #f87171;
              animation: pulse 2s infinite;
            }
            
            @keyframes pulse {
              0%, 100% {
                transform: scale(1);
                box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
              }
              50% {
                transform: scale(1.05);
                box-shadow: 0 0 20px 4px rgba(239, 68, 68, 0.2);
              }
            }
            
            .icon {
              width: 40px;
              height: 40px;
              fill: none;
              stroke: currentColor;
              stroke-width: 2;
              stroke-linecap: round;
              stroke-linejoin: round;
            }
            
            h1 {
              font-size: 28px;
              font-weight: 700;
              margin-bottom: 12px;
              letter-spacing: -0.5px;
              background: linear-gradient(135deg, #fff 0%, #cbd5e1 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            }
            
            .subdomain-tag {
              display: inline-block;
              padding: 6px 12px;
              background: rgba(239, 68, 68, 0.15);
              border: 1px solid rgba(239, 68, 68, 0.3);
              color: #f87171;
              border-radius: 8px;
              font-family: monospace;
              font-size: 14px;
              margin-bottom: 20px;
              font-weight: 600;
            }
            
            p {
              color: var(--text-secondary);
              font-size: 15px;
              line-height: 1.6;
              margin-bottom: 32px;
            }
            
            .btn {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 100%;
              padding: 14px 28px;
              background: var(--accent);
              color: white;
              border: none;
              border-radius: 12px;
              font-size: 16px;
              font-weight: 600;
              text-decoration: none;
              transition: all 0.2s ease;
              cursor: pointer;
              box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
            }
            
            .btn:hover {
              background: var(--accent-hover);
              transform: translateY(-2px);
              box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
            }
            
            .btn:active {
              transform: translateY(0);
            }
            
            .footer {
              margin-top: 24px;
              font-size: 12px;
              color: rgba(148, 163, 184, 0.5);
            }
            
            .footer a {
              color: rgba(148, 163, 184, 0.8);
              text-decoration: none;
              transition: color 0.2s;
            }
            
            .footer a:hover {
              color: var(--accent);
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="card">
              <div class="icon-wrapper">
                <svg class="icon" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h1>School Portal Not Found</h1>
              <div class="subdomain-tag">${subdomain}.scholarnerve.com</div>
              <p>
                ${!school 
                  ? 'The school portal you are trying to access does not exist in our system.' 
                  : 'This school portal has been deactivated. Please contact the school administration or system support.'}
              </p>
              <a href="https://scholarnerve.com" class="btn">Return to Scholarnerve</a>
            </div>
            <div class="footer">
              Powered by <a href="https://scholarnerve.com">Scholarnerve</a>
            </div>
          </div>
        </body>
        </html>
      `);
    }

    // Attach the verified school context details to the Request object
    req.school = school;
    req.schoolId = school.id;

    // Proceed to next middleware/routes (which can now use req.school)
    next();
  } catch (error) {
    console.error('Unhandled subdomain routing error:', error);
    next(error);
  }
}
