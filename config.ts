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

    // ──────────────────────────────────────────
    // HERRAMIENTAS EXPUESTAS AL LLM
    // SkillRegistry necesita pluginSchemas con acciones para registrar
    // herramientas en el agente. Sin esto, el módulo se salta y el LLM
    // no tiene ninguna herramienta disponible.
    // ──────────────────────────────────────────
    pluginSchemas: {
        Channel: {
            actions: {
                sendReply: {
                    label: 'Publicar Comentario en GitHub',
                    description: 'Publica un comentario en un Issue o Pull Request de GitHub usando el identificador "github:owner/repo/pull|issue/número".',
                    fields: [
                        {
                            name: 'to',
                            type: 'required',
                            label: 'Destino (github:owner/repo/pull|issue/número)',
                        },
                        {
                            name: 'text',
                            type: 'required',
                            label: 'Cuerpo del comentario (Markdown)',
                        },
                    ],
                },
                getIssueDetails: {
                    label: 'Obtener Detalles de Issue / PR',
                    description: 'Obtiene título, descripción, estado, etiquetas y comentarios de un Issue o PR.',
                    fields: [
                        {
                            name: 'owner',
                            type: 'required',
                            label: 'Propietario del repositorio (ej: octocat)',
                        },
                        {
                            name: 'repo',
                            type: 'required',
                            label: 'Nombre del repositorio (ej: my-repo)',
                        },
                        {
                            name: 'number',
                            type: 'required',
                            label: 'Número del Issue o PR',
                        },
                        {
                            name: 'type',
                            type: 'required',
                            label: 'Tipo: "issue" o "pull"',
                        },
                    ],
                },
                listPRFiles: {
                    label: 'Listar Archivos Modificados en PR',
                    description: 'Devuelve la lista de archivos con cambios (adiciones, eliminaciones, estado) de un Pull Request.',
                    fields: [
                        {
                            name: 'owner',
                            type: 'required',
                            label: 'Propietario del repositorio',
                        },
                        {
                            name: 'repo',
                            type: 'required',
                            label: 'Nombre del repositorio',
                        },
                        {
                            name: 'pull_number',
                            type: 'required',
                            label: 'Número del Pull Request',
                        },
                    ],
                },
            },
        },
    },
};

export default GithubAgentConfig;
