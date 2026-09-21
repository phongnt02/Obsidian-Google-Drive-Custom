import { Notice, requestUrl } from 'obsidian';
import * as http from 'http';
import { URL } from 'url';

const REDIRECT_PORT = 48321;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}`;
const SCOPES = ['https://www.googleapis.com/auth/drive'];

export interface OAuthTokens {
	access_token: string;
	refresh_token: string;
	expires_in: number;
	token_type: string;
	scope: string;
}

export const getAuthorizationUrl = (clientId: string): string => {
	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: REDIRECT_URI,
		response_type: 'code',
		scope: SCOPES.join(' '),
		access_type: 'offline',
		prompt: 'consent',
	});

	return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

export const exchangeCodeForTokens = async (
	clientId: string,
	clientSecret: string,
	code: string,
): Promise<OAuthTokens | null> => {
	try {
		const response = await requestUrl({
			url: 'https://oauth2.googleapis.com/token',
			method: 'POST',
			contentType: 'application/x-www-form-urlencoded',
			body: new URLSearchParams({
				client_id: clientId,
				client_secret: clientSecret,
				code,
				grant_type: 'authorization_code',
				redirect_uri: REDIRECT_URI,
			}).toString(),
			throw: false,
		});

		if (response.status < 200 || response.status >= 300) {
			console.error('Token exchange failed:', response.text);
			new Notice(`Failed to exchange authorization code: ${response.text}`);
			return null;
		}

		return response.json as OAuthTokens;
	} catch (error) {
		console.error('Token exchange error:', error);
		new Notice('Failed to exchange authorization code. Please try again.');
		return null;
	}
};

export const startOAuthFlow = (
	clientId: string,
): Promise<string> => {
	return new Promise((resolve, reject) => {
		let server: http.Server | null = null;
		let timeoutId: ReturnType<typeof setTimeout> | null = null;

		const cleanup = () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}
			if (server) {
				server.close();
				server = null;
			}
		};

		server = http.createServer((req, res) => {
			const url = new URL(req.url!, `http://localhost:${REDIRECT_PORT}`);
			const code = url.searchParams.get('code');
			const error = url.searchParams.get('error');

			if (error) {
				res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
				res.end(`
					<html>
					<head><title>OAuth Error</title></head>
					<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 400px; margin: 50px auto; text-align: center;">
						<h2>Authorization Failed</h2>
						<p>Error: ${error}</p>
						<p>You can close this window and try again.</p>
					</body>
					</html>
				`);
				cleanup();
				reject(new Error(error));
				return;
			}

			if (code) {
				res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
				res.end(`
					<html>
					<head><title>OAuth Success</title></head>
					<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 400px; margin: 50px auto; text-align: center;">
						<h2>Authorization Successful!</h2>
						<p>You can close this window and return to Obsidian.</p>
						<script>setTimeout(() => window.close(), 2000);</script>
					</body>
					</html>
				`);
				cleanup();
				resolve(code);
				return;
			}

			res.writeHead(404, { 'Content-Type': 'text/plain' });
			res.end('Not found');
		});

		server.listen(REDIRECT_PORT, '127.0.0.1', () => {
			const authUrl = getAuthorizationUrl(clientId);
			window.open(authUrl, '_blank');
		});

		server.on('error', (err) => {
			console.error('OAuth server error:', err);
			cleanup();
			new Notice('Failed to start local server for OAuth. Please try again.');
			reject(err);
		});

		timeoutId = setTimeout(() => {
			cleanup();
			new Notice('OAuth timed out. Please try again.');
			reject(new Error('OAuth timeout'));
		}, 120_000);
	});
};
