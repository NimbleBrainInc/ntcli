import express from 'express';
import { createServer, Server } from 'http';
import { OAuthAuthorizationResponse, LocalServerConfig } from '../../types/index.js';

/**
 * Local HTTP server for handling OAuth callback
 */
export class LocalCallbackServer {
  private app: express.Application;
  private server: Server | null = null;
  private config: LocalServerConfig;
  private callbackPromise: Promise<OAuthAuthorizationResponse> | null = null;
  private callbackResolve: ((value: OAuthAuthorizationResponse) => void) | null = null;
  private callbackReject: ((reason: Error) => void) | null = null;

  constructor(config: Partial<LocalServerConfig> = {}) {
    this.config = {
      port: config.port || 41247,
      host: config.host || 'localhost',
      path: config.path || '/callback'
    };
    
    this.app = express();
    this.setupRoutes();
  }

  /**
   * Setup Express routes for OAuth callback
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // OAuth callback endpoint
    this.app.get(this.config.path, (req, res) => {
      const { code, state, error, error_description } = req.query;

      if (error) {
        const errorMessage = error_description || error;
        this.sendErrorResponse(res, `OAuth error: ${errorMessage}`);
        this.callbackReject?.(new Error(`OAuth error: ${errorMessage}`));
        return;
      }

      if (!code || !state) {
        this.sendErrorResponse(res, 'Missing authorization code or state parameter');
        this.callbackReject?.(new Error('Missing authorization code or state parameter'));
        return;
      }

      // Send success page to browser
      this.sendSuccessResponse(res);

      // Resolve the callback promise
      this.callbackResolve?.({
        code: code as string,
        state: state as string
      });
    });

    // Handle 404s - Express 5.x compatible
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `The requested path ${req.originalUrl} was not found`
      });
    });

    // Error handling middleware
    this.app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Server error:', err);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred'
      });
    });
  }

  /**
   * Start the local server and return the actual port being used
   */
  async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 10;
      let currentPort = this.config.port;

      const tryPort = () => {
        this.server = createServer(this.app);
        
        this.server.on('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'EADDRINUSE' && attempts < maxAttempts) {
            attempts++;
            currentPort = this.config.port + attempts;
            setImmediate(tryPort);
          } else {
            reject(new Error(`Failed to start server: ${err.message}`));
          }
        });

        this.server.listen(currentPort, this.config.host, () => {
          resolve(currentPort);
        });
      };

      tryPort();
    });
  }

  /**
   * Stop the local server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((err) => {
        if (err) {
          reject(new Error(`Failed to stop server: ${err.message}`));
        } else {
          this.server = null;
          resolve();
        }
      });
    });
  }

  /**
   * Wait for OAuth callback with timeout
   */
  async waitForCallback(timeoutMs: number = 300000): Promise<OAuthAuthorizationResponse> {
    if (this.callbackPromise) {
      return this.callbackPromise;
    }

    this.callbackPromise = new Promise((resolve, reject) => {
      this.callbackResolve = resolve;
      this.callbackReject = reject;

      // Set timeout
      const timeout = setTimeout(() => {
        reject(new Error('OAuth callback timeout'));
      }, timeoutMs);

      // Clear timeout when promise resolves/rejects
      const originalResolve = this.callbackResolve;
      const originalReject = this.callbackReject;

      this.callbackResolve = (value) => {
        clearTimeout(timeout);
        originalResolve(value);
      };

      this.callbackReject = (reason) => {
        clearTimeout(timeout);
        originalReject(reason);
      };
    });

    return this.callbackPromise;
  }

  /**
   * Get the callback URL for this server
   */
  getCallbackUrl(port: number): string {
    return `http://${this.config.host}:${port}${this.config.path}`;
  }

  /**
   * Send success response to browser
   */
  private sendSuccessResponse(res: express.Response): void {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authentication Successful - ntcli</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              margin: 0;
              padding: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 2rem;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 12px;
              backdrop-filter: blur(10px);
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            }
            .checkmark {
              width: 80px;
              height: 80px;
              margin: 0 auto 1rem;
              background: #4CAF50;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 2rem;
            }
            h1 {
              margin: 0 0 1rem;
              font-size: 1.8rem;
              font-weight: 600;
            }
            p {
              margin: 0;
              opacity: 0.9;
              font-size: 1rem;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="checkmark">✓</div>
            <h1>Authentication Successful!</h1>
            <p>You can now close this browser window and return to your terminal.</p>
          </div>
          <script>
            // Auto-close window after 3 seconds (optional)
            setTimeout(() => {
              if(window.close) window.close();
            }, 3000);
          </script>
        </body>
      </html>
    `;
    
    res.status(200).send(html);
  }

  /**
   * Send error response to browser
   */
  private sendErrorResponse(res: express.Response, message: string): void {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authentication Error - ntcli</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              margin: 0;
              padding: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 2rem;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 12px;
              backdrop-filter: blur(10px);
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            }
            .error-icon {
              width: 80px;
              height: 80px;
              margin: 0 auto 1rem;
              background: #f44336;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 2rem;
            }
            h1 {
              margin: 0 0 1rem;
              font-size: 1.8rem;
              font-weight: 600;
            }
            p {
              margin: 0;
              opacity: 0.9;
              font-size: 1rem;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">✗</div>
            <h1>Authentication Error</h1>
            <p>${message}</p>
            <p style="margin-top: 1rem; font-size: 0.9rem;">Please return to your terminal and try again.</p>
          </div>
        </body>
      </html>
    `;
    
    res.status(400).send(html);
  }
}