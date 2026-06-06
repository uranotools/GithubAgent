import { EnginePluginBase, EnginePreProcessResult } from '@core/EnginePluginBase';
import { SessionContext } from '@core/runtime/SessionContext';

export class GithubAgentEnginePlugin extends EnginePluginBase {

    async onSessionStart(ctx: SessionContext): Promise<void> {
        console.log(`[GithubAgentEnginePlugin] Session started: ${ctx.sessionId}`);

        // Try to parse the repository details from the session ID
        // The ID typically has the format: webhook_mcp_githubagent_github:owner/repo/pull/number
        const match = ctx.sessionId.match(/github:([^/]+)\/([^/]+)\/(pull|issue)\/(\d+)$/);
        if (match) {
            const [_, owner, repo, type, number] = match;
            
            // Add custom badges to visual chat header
            ctx.addBadge({
                id: 'github-repo',
                label: `🐙 ${owner}/${repo}`,
                color: 'info'
            });

            ctx.addBadge({
                id: 'github-pr-issue',
                label: `${type === 'pull' ? 'PR' : 'Issue'} #${number}`,
                color: 'success'
            });
        }
    }

    async preMessageProcess(ctx: SessionContext, message: any): Promise<EnginePreProcessResult> {
        const content = typeof message.content === 'string' ? message.content : '';

        // Intercept /review-pr command triggered automatically by GitHub webhook pull_request opened
        if (content.startsWith('/review-pr')) {
            const parts = content.split('\n')[0].split(' ');
            const diffUrl = parts[1];
            const title = parts.slice(2).join(' ');

            if (!diffUrl) {
                return {
                    status: 'intercepted',
                    overrideResponse: '❌ Error: No se proporcionó la URL de diff del Pull Request.'
                };
            }

            // Set visual progress badge
            ctx.addBadge({
                id: 'review-progress',
                label: '🔍 Inicializando revisión del PR...',
                color: 'info'
            });

            try {
                const pat = ctx.getSecret('GITHUB_PAT');
                
                // Fetch the diff of the Pull Request
                const headers: Record<string, string> = {
                    'User-Agent': 'Urano-Github-Agent'
                };
                if (pat) {
                    headers['Authorization'] = `token ${pat}`;
                }

                const response = await fetch(diffUrl, { headers });
                if (!response.ok) {
                    throw new Error(`No se pudo obtener el diff (${response.status}): ${await response.text()}`);
                }

                let diffText = await response.text();

                // Truncate if diff exceeds reasoning token capacity limits to prevent context overflow (approx. 30K characters limit)
                const MAX_DIFF_LENGTH = 30000;
                if (diffText.length > MAX_DIFF_LENGTH) {
                    diffText = diffText.substring(0, MAX_DIFF_LENGTH) + '\n\n... [DIFF TRUNCADO POR TAMAÑO] ...';
                }

                // Spawn a sandboxed background LLM reasoning subsession to review the diff
                const result = await ctx.spawnSubSession({
                    systemPrompt: 'Eres un Arquitecto de Software y Revisor de Código Senior de Urano AI. Analiza el diff de código proporcionado de forma rigurosa. Encuentra posibles bugs, fallos de seguridad (como inyección de SQL, claves expuestas), problemas de rendimiento (bucles ineficientes, memory leaks) y violaciones de diseño de software. Proporciona tus sugerencias de forma profesional, constructiva y estructurada con Markdown.',
                    input: `Revisa este Pull Request titulado "${title}". Aquí tienes el diff del código:\n\n\`\`\`diff\n${diffText}\n\`\`\``,
                    maxTokens: 4000,
                    timeout: 60000, // 60s timeout limit
                    priority: 'high',
                    silent: true,
                    onProgress: (p) => {
                        ctx.addBadge({
                            id: 'review-progress',
                            label: `🔍 Revisando código... Paso: ${p.step} | Tokens: ${p.totalTokens}`,
                            color: 'info'
                        });
                    }
                });

                ctx.removeBadge('review-progress');

                if (result.status === 'completed') {
                    const report = `### 🤖 Urano AI Code Review\n\n${result.summary}\n\n*Revisado automáticamente por el agente mediante Sandbox de Urano.*`;
                    return {
                        status: 'intercepted',
                        overrideResponse: report
                    };
                } else if (result.status === 'cancelled') {
                    return {
                        status: 'intercepted',
                        overrideResponse: '⚠️ La revisión automática fue cancelada por tiempo de espera excedido (Timeout).'
                    };
                } else {
                    return {
                        status: 'intercepted',
                        overrideResponse: '❌ Error: El sandbox de revisión falló.'
                    };
                }

            } catch (err: any) {
                ctx.removeBadge('review-progress');
                console.error('[GithubAgentEnginePlugin] Error reviewing PR:', err.message);
                return {
                    status: 'intercepted',
                    overrideResponse: `❌ Error al realizar la revisión: ${err.message}`
                };
            }
        }

        return { status: 'continue' };
    }

    async onSessionEnd(ctx: SessionContext): Promise<void> {
        ctx.removeBadge('github-repo');
        ctx.removeBadge('github-pr-issue');
        ctx.removeBadge('review-progress');
    }
}
