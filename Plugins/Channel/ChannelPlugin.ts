import { ParsedMessage, WebhookRequest } from '@core/channels/ChannelAdapter';
import * as crypto from 'crypto';

export class ChannelPlugin {
    private config: any;

    constructor(moduleConfig: any) {
        // config contains GITHUB_PAT and GITHUB_WEBHOOK_SECRET from the Vault
        this.config = moduleConfig || {};
    }

    async executeAction(action: string, payload: any): Promise<any> {
        if (action === 'validateWebhook') {
            const { req } = payload as { req: WebhookRequest };
            const secret = this.config.GITHUB_WEBHOOK_SECRET;
            if (!secret) {
                return true; // No validation secret configured, allow by default
            }

            const signature = req.headers['x-hub-signature-256'];
            if (!signature) {
                console.warn('[GithubAgent/Channel] Missing x-hub-signature-256 header');
                return false;
            }

            try {
                const hmac = crypto.createHmac('sha256', secret);
                const computed = 'sha256=' + hmac.update(req.rawBody).digest('hex');
                // Use safe buffer comparison to prevent timing attacks
                return crypto.timingSafeEqual(
                    Buffer.from(signature),
                    Buffer.from(computed)
                );
            } catch (err: any) {
                console.error('[GithubAgent/Channel] Error validating signature:', err.message);
                return false;
            }
        }

        if (action === 'parseWebhook') {
            const { req } = payload as { req: WebhookRequest };
            const event = req.headers['x-github-event'] || '';
            const body = req.body || {};

            // Avoid loops: check if the sender is a bot or the action comes from ourselves
            const sender = body.sender || {};
            if (
                sender.type === 'Bot' || 
                (sender.login && (
                    sender.login.includes('[bot]') || 
                    sender.login.toLowerCase().includes('urano')
                ))
            ) {
                return { from: '', text: '' } as ParsedMessage; // Discard silently
            }

            const repo = body.repository || {};
            const repoFullName = repo.full_name;
            if (!repoFullName) {
                return { from: '', text: '' } as ParsedMessage;
            }

            // 1. PULL REQUEST EVENTS (opened or updated)
            if (event === 'pull_request') {
                const prAction = body.action;
                if (prAction === 'opened' || prAction === 'synchronize') {
                    const pr = body.pull_request || {};
                    const prNumber = body.number;
                    const diffUrl = pr.diff_url;
                    const title = pr.title || 'PR';
                    const prDescription = pr.body || '';

                    // Format identifier: github:owner/repo/pull/number
                    const fromIdentifier = `github:${repoFullName}/pull/${prNumber}`;
                    
                    // Route to Agent with a custom review command that our Engine Plugin will intercept
                    const text = `/review-pr ${diffUrl} ${title}\n\n${prDescription}`;

                    return {
                        from: fromIdentifier,
                        text: text
                    } as ParsedMessage;
                }
            }

            // 2. ISSUE COMMENTS OR PR COMMENTS
            if (event === 'issue_comment' || event === 'pull_request_review_comment') {
                const commentAction = body.action;
                if (commentAction === 'created') {
                    const comment = body.comment || {};
                    const commentText = comment.body || '';

                    // Skip empty comments
                    if (!commentText.trim()) {
                        return { from: '', text: '' } as ParsedMessage;
                    }

                    const issueNumber = (body.issue || body.pull_request || {}).number || body.number;
                    if (!issueNumber) {
                        return { from: '', text: '' } as ParsedMessage;
                    }

                    // Determine if PR or Issue
                    const isPr = !!(body.issue?.pull_request || body.pull_request || event === 'pull_request_review_comment');
                    const type = isPr ? 'pull' : 'issue';
                    const fromIdentifier = `github:${repoFullName}/${type}/${issueNumber}`;

                    return {
                        from: fromIdentifier,
                        text: commentText
                    } as ParsedMessage;
                }
            }

            // Unknown event or not handled
            return { from: '', text: '' } as ParsedMessage;
        }

        if (action === 'sendReply') {
            const { to, text } = payload as { to: string; text: string };
            const pat = this.config.GITHUB_PAT;

            if (!pat) {
                throw new Error('[GithubAgent/Channel] Cannot send reply: GITHUB_PAT is not configured in secrets.');
            }

            // Parse identifier: github:owner/repo/(pull|issue)/number
            const match = to.match(/^github:([^/]+)\/([^/]+)\/(pull|issue)\/(\d+)$/);
            if (!match) {
                throw new Error(`[GithubAgent/Channel] Invalid recipient identifier: ${to}`);
            }

            const [_, owner, repo, type, numberStr] = match;
            const number = parseInt(numberStr, 10);

            // POST comment to GitHub (works for both Issues and PRs using the issues API endpoint)
            const apiUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${number}/comments`;

            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `token ${pat}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Urano-Github-Agent',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ body: text })
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`[GithubAgent/Channel] GitHub API error (${res.status}): ${errText}`);
            }

            const data = await res.json() as any;
            return { sid: String(data.id || Date.now()) };
        }

        if (action === 'handleHandshake') {
            return null; // GitHub webhooks don't require handshake response
        }

        if (action === 'getCustomTools') {
            return []; // No custom tools for GitHub channel sessions
        }

        throw new Error(`Action ${action} not implemented in ChannelPlugin`);
    }
}
