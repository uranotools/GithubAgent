export const GithubAgentConfig = {
    name: 'GithubAgent',
    description: 'Revisor de código de GitHub e Issue Agent híbrido (Canal de Webhooks + Engine Plugin para revisiones de código en segundo plano).',
    icon: 'GitPullRequest',
    category: 'Productividad',
    inDesktop: true,
    inCloud: true,
    cloudOnly: false,

    // ──────────────────────────────────────────
    // CONFIGURACIÓN HÍBRIDA (Canal + Engine)
    // ──────────────────────────────────────────
    channelPlugin: true,
    enginePlugin: true,
    engineHooks: ['onSessionStart', 'preMessageProcess'],

    settings: [
        {
            name: 'GITHUB_PAT',
            title: 'GitHub Personal Access Token (PAT)',
            type: 'password',
            placeholder: 'ghp_...',
            description: 'Token de acceso de GitHub con permisos de escritura para publicar comentarios y reviews en repositorios.',
            required: true,
        },
        {
            name: 'GITHUB_WEBHOOK_SECRET',
            title: 'GitHub Webhook Secret',
            type: 'password',
            placeholder: 'MiSecretoGithub',
            description: 'Secreto de webhook para verificar las firmas HMAC SHA-256 de las peticiones entrantes de GitHub.',
            required: false,
        },
        {
            name: 'TARGET_AGENT',
            title: 'ID del Agente Enrutador',
            type: 'local_agent_select',
            placeholder: 'Selecciona un agente...',
            description: 'Selecciona el agente de Urano que procesará e interactuará con los mensajes y reviews de este canal de GitHub.',
            required: false,
        }
    ],

    pluginSchemas: {}
};

export default GithubAgentConfig;
