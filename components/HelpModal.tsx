'use client'

import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { X, ExternalLink, AlertTriangle, Lightbulb, Terminal, Shield } from 'lucide-react'

export type HelpTopic =
  | 'jira-base-url'
  | 'jira-email'
  | 'jira-account-id'
  | 'jira-api-token'
  | 'github-token'
  | 'slack-token'
  | 'openai-token'
  | 'report-email'

interface Step {
  text: string
  code?: string
  warning?: string
  tip?: string
}

interface HelpContent {
  title: string
  subtitle: string
  accentColor: string
  steps: Step[]
  permissions?: { label: string; description: string }[]
  links?: { label: string; url: string }[]
  finalTip?: string
}

const HELP_CONTENT: Record<HelpTopic, HelpContent> = {
  'jira-base-url': {
    title: 'URL Base do Jira',
    subtitle: 'O endereço do seu workspace no Atlassian Cloud',
    accentColor: 'blue',
    steps: [
      {
        text: 'Abra o Jira no navegador e faça login na sua conta.',
      },
      {
        text: 'Olhe a barra de endereços do navegador. A URL base é o domínio principal do seu workspace, no formato:',
        code: 'https://seu-dominio.atlassian.net',
      },
      {
        text: 'Copie apenas a parte do domínio — sem nenhum caminho adicional após ".net".',
        tip: 'Exemplo: se a URL completa for https://minhaempresa.atlassian.net/jira/software/projects, a URL base é https://minhaempresa.atlassian.net',
      },
    ],
    links: [
      { label: 'Acessar Atlassian', url: 'https://atlassian.net' },
    ],
  },

  'jira-email': {
    title: 'E-mail do Jira',
    subtitle: 'O e-mail associado à sua conta Atlassian',
    accentColor: 'blue',
    steps: [
      {
        text: 'É o mesmo e-mail que você usa para fazer login no Jira / Atlassian.',
      },
      {
        text: 'Para confirmar, clique no seu avatar no canto superior direito do Jira e veja o e-mail exibido abaixo do seu nome.',
      },
      {
        text: 'Você também pode verificar em: Atlassian Account → aba "Account" → campo Email.',
        code: 'https://id.atlassian.com/manage-profile',
      },
    ],
  },

  'jira-account-id': {
    title: 'Account ID do Jira',
    subtitle: 'Seu identificador único na plataforma Atlassian',
    accentColor: 'blue',
    steps: [
      {
        text: 'No Jira, clique no seu avatar no canto superior direito e selecione "Perfil" (Profile).',
      },
      {
        text: 'A página do seu perfil será aberta. Olhe a barra de endereços — o Account ID está na URL, após "/people/":',
        code: 'https://seu-dominio.atlassian.net/jira/people/712020:abc123def456...',
        tip: 'O Account ID começa geralmente com "712020:" seguido de uma sequência alfanumérica.',
      },
      {
        text: 'Alternativamente, acesse diretamente o portal de gerenciamento da sua conta:',
        code: 'https://id.atlassian.com/manage-profile',
        tip: 'Nessa página, clique em "Manage account" e o Account ID aparecerá na URL da página aberta.',
      },
      {
        text: 'Outra forma: faça uma chamada à API do Jira com suas credenciais (Basic Auth: e-mail + API Token) no endpoint:',
        code: 'GET https://seu-dominio.atlassian.net/rest/api/3/myself',
        tip: 'A resposta JSON conterá o campo "accountId" com o seu ID.',
      },
    ],
    links: [
      { label: 'Meu perfil Atlassian', url: 'https://id.atlassian.com/manage-profile' },
    ],
  },

  'jira-api-token': {
    title: 'API Token do Jira',
    subtitle: 'Token de autenticação para acessar a API do Jira em seu nome',
    accentColor: 'blue',
    steps: [
      {
        text: 'Acesse a página de gerenciamento de API Tokens da Atlassian:',
        code: 'https://id.atlassian.com/manage-profile/security/api-tokens',
      },
      {
        text: 'Clique em "Create API token" (ou "Create API token with scopes" para a versão mais recente).',
      },
      {
        text: 'Dê um nome descritivo ao token, por exemplo: "Daily Reports".',
      },
      {
        text: 'Defina a data de expiração. A Atlassian permite até 365 dias. Escolha um período adequado ao seu uso.',
        warning: 'Após dezembro de 2024, os tokens têm expiração obrigatória de no máximo 1 ano. Anote a data de validade em um lugar seguro.',
      },
      {
        text: 'Se for solicitado a selecionar escopos, escolha o app "Jira" e marque pelo menos as permissões de leitura (read:jira-work).',
      },
      {
        text: 'Clique em "Create" e depois em "Copy to clipboard".',
        warning: 'O token só é exibido uma vez. Guarde-o em um local seguro imediatamente — você não poderá visualizá-lo novamente.',
      },
    ],
    links: [
      { label: 'Gerenciar API Tokens', url: 'https://id.atlassian.com/manage-profile/security/api-tokens' },
    ],
    finalTip: 'O token gerado começa com "ATATT3x" ou similar. Se você perder o token, precisará criar um novo.',
  },

  'github-token': {
    title: 'Personal Access Token do GitHub',
    subtitle: 'Token clássico para acessar seus repositórios e organizações',
    accentColor: 'slate',
    steps: [
      {
        text: 'Acesse o GitHub (github.com) e faça login na sua conta.',
      },
      {
        text: 'Clique na sua foto de perfil no canto superior direito e selecione "Settings".',
      },
      {
        text: 'Na barra lateral esquerda, role até o final e clique em "Developer settings".',
      },
      {
        text: 'Clique em "Personal access tokens" → "Tokens (classic)".',
      },
      {
        text: 'Clique em "Generate new token" → "Generate new token (classic)".',
      },
      {
        text: 'Preencha os campos: dê um nome ao token (ex: "Daily Reports") e defina a expiração (recomendado: 90 dias).',
      },
      {
        text: 'Marque os seguintes escopos (permissões) obrigatórios:',
      },
      {
        text: 'Clique em "Generate token" e copie o token imediatamente.',
        warning: 'O token só é exibido uma vez. Guarde-o em um local seguro — você não poderá visualizá-lo novamente.',
        code: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      },
    ],
    permissions: [
      { label: 'repo', description: 'Acesso completo a repositórios públicos e privados (código, issues, PRs)' },
      { label: 'read:org', description: 'Leitura de dados da organização (membros, times, repos da org)' },
      { label: 'read:user', description: 'Leitura do perfil e dados do usuário autenticado' },
    ],
    links: [
      { label: 'Criar Personal Access Token', url: 'https://github.com/settings/tokens/new' },
    ],
    finalTip: 'O token começa com "ghp_". Se você fizer parte de organizações com SSO, pode ser necessário autorizar o token para cada organização após criá-lo (botão "Configure SSO" ao lado do token).',
  },

  'slack-token': {
    title: 'User Token do Slack',
    subtitle: 'Token de usuário (xoxp-) para ler suas mensagens e canais',
    accentColor: 'green',
    steps: [
      {
        text: 'Acesse o portal de apps do Slack:',
        code: 'https://api.slack.com/apps',
      },
      {
        text: 'Clique em "Create New App" → selecione "From scratch".',
      },
      {
        text: 'Dê um nome ao app (ex: "Daily Reports") e selecione seu workspace. Clique em "Create App".',
      },
      {
        text: 'No menu lateral esquerdo, clique em "OAuth & Permissions".',
      },
      {
        text: 'Role a página até a seção "Scopes". Localize "User Token Scopes" (NÃO "Bot Token Scopes") e adicione as permissões necessárias clicando em "Add an OAuth Scope":',
        tip: 'É essencial usar User Token Scopes (e não Bot Token Scopes) para acessar as mensagens do seu próprio usuário.',
      },
      {
        text: 'Role a página de volta para o topo e clique em "Install to Workspace".',
      },
      {
        text: 'Uma tela de autorização abrirá. Revise as permissões e clique em "Allow" (Permitir).',
      },
      {
        text: 'Você será redirecionado de volta à página "OAuth & Permissions". O "User OAuth Token" estará disponível na seção "OAuth Tokens". Copie-o.',
        code: 'xoxp-xxxxxxxxxxxx-xxxxxxxxxxxx-xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        warning: 'Guarde este token com segurança. Ele dá acesso às mensagens e canais do seu usuário.',
      },
    ],
    permissions: [
      { label: 'channels:history', description: 'Ler mensagens em canais públicos dos quais você faz parte' },
      { label: 'channels:read', description: 'Listar os canais públicos disponíveis no workspace' },
      { label: 'groups:history', description: 'Ler mensagens em canais privados dos quais você faz parte' },
      { label: 'groups:read', description: 'Listar canais privados dos quais você faz parte' },
      { label: 'im:history', description: 'Ler mensagens em conversas diretas (1:1)' },
      { label: 'im:read', description: 'Listar conversas diretas abertas' },
      { label: 'mpim:history', description: 'Ler mensagens em grupos de mensagens diretas' },
      { label: 'mpim:read', description: 'Listar grupos de mensagens diretas abertos' },
    ],
    links: [
      { label: 'Meus Apps do Slack', url: 'https://api.slack.com/apps' },
    ],
    finalTip: 'O token começa com "xoxp-". Este token representa você — qualquer ação feita com ele aparece como se fosse você quem fez.',
  },

  'openai-token': {
    title: 'API Key da OpenAI',
    subtitle: 'Chave de API para usar os modelos de linguagem da OpenAI',
    accentColor: 'violet',
    steps: [
      {
        text: 'Acesse a plataforma da OpenAI:',
        code: 'https://platform.openai.com',
      },
      {
        text: 'Se ainda não tem conta, clique em "Sign up" e crie uma com seu e-mail ou conta Google/Microsoft.',
      },
      {
        text: 'Antes de usar a API, configure o faturamento: vá em "Settings" (ícone de engrenagem no topo) → "Billing" → adicione um cartão de crédito e compre créditos (mínimo recomendado: US$5).',
        warning: 'Sem créditos configurados, a API retornará erros. A validação inicial pode falhar mesmo com a chave correta se não houver saldo.',
      },
      {
        text: 'No menu superior, clique em "Settings" → no menu lateral, clique em "API keys".',
        tip: 'Ou acesse diretamente: platform.openai.com/api-keys',
      },
      {
        text: 'Clique em "+ Create new secret key".',
      },
      {
        text: 'Dê um nome descritivo (ex: "Daily Reports") e escolha as permissões. Selecione "All" para uso completo.',
      },
      {
        text: 'Clique em "Create secret key" e copie a chave imediatamente.',
        code: 'sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        warning: 'A chave só é exibida uma vez! Se você sair da tela sem copiar, terá que criar outra.',
      },
    ],
    links: [
      { label: 'Criar API Key', url: 'https://platform.openai.com/api-keys' },
      { label: 'Configurar Billing', url: 'https://platform.openai.com/settings/organization/billing' },
    ],
    finalTip: 'A chave começa com "sk-" ou "sk-proj-". Configure um limite de gastos mensais em Settings → Billing → Usage limits para evitar surpresas na fatura.',
  },

  'report-email': {
    title: 'E-mail do Destinatário',
    subtitle: 'O e-mail que receberá o relatório gerado',
    accentColor: 'indigo',
    steps: [
      {
        text: 'Informe o endereço de e-mail para o qual o relatório será enviado após ser processado.',
      },
      {
        text: 'Pode ser qualquer e-mail válido — não precisa ser o mesmo e-mail do Jira ou da sua conta.',
        tip: 'Exemplo: se você quiser que o relatório chegue para você e um gestor, pode colocar seu e-mail agora e reenviar ao gestor depois.',
      },
      {
        text: 'Este e-mail também é usado como parte do controle anti-spam: apenas um relatório por vez pode estar na fila para cada e-mail cadastrado.',
        warning: 'Se já houver um relatório aguardando processamento para este e-mail, o sistema bloqueará novas solicitações até que o atual seja concluído.',
      },
    ],
  },
}

const accentStyles: Record<string, { badge: string; border: string; icon: string }> = {
  blue: {
    badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    border: 'border-blue-500/20',
    icon: 'text-blue-400',
  },
  slate: {
    badge: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    border: 'border-slate-500/20',
    icon: 'text-slate-400',
  },
  green: {
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    border: 'border-emerald-500/20',
    icon: 'text-emerald-400',
  },
  violet: {
    badge: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    border: 'border-violet-500/20',
    icon: 'text-violet-400',
  },
  indigo: {
    badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    border: 'border-indigo-500/20',
    icon: 'text-indigo-400',
  },
}

interface HelpModalProps {
  topic: HelpTopic | null
  onClose: () => void
}

export function HelpModal({ topic, onClose }: HelpModalProps) {
  const content = topic ? HELP_CONTENT[topic] : null
  const accent = content ? (accentStyles[content.accentColor] ?? accentStyles.blue) : accentStyles.blue

  return (
    <Dialog open={!!topic} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />

      <div className="fixed inset-0 flex items-end sm:items-center justify-center sm:p-4">
        <DialogPanel className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-slate-800 border-t sm:border border-slate-700 shadow-2xl">
          {content && (
            <>
              <div className="flex items-start justify-between px-4 sm:px-6 pt-5 pb-4 border-b border-slate-700">
                <div>
                  <DialogTitle className="text-base font-semibold text-slate-100">
                    {content.title}
                  </DialogTitle>
                  <p className="text-xs text-slate-400 mt-0.5">{content.subtitle}</p>
                </div>
                <button
                  onClick={onClose}
                  className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors ml-3"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div
                className="px-4 sm:px-6 py-4 flex flex-col gap-4 overflow-y-auto"
                style={{ maxHeight: 'min(70vh, calc(100svh - 8rem))' }}
              >
                <ol className="flex flex-col gap-3">
                  {content.steps.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className={`shrink-0 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center mt-0.5 border ${accent.badge}`}>
                        {i + 1}
                      </span>
                      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                        <p className="text-sm text-slate-300 leading-relaxed">{step.text}</p>

                        {step.code && (
                          <div className="flex items-center gap-2 rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-2">
                            <Terminal className="w-3 h-3 text-slate-500 shrink-0" />
                            <code className="text-xs text-slate-200 font-mono break-all leading-relaxed">{step.code}</code>
                          </div>
                        )}

                        {step.warning && (
                          <div className="flex items-start gap-2 rounded-lg bg-amber-500/8 border border-amber-500/20 px-3 py-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-300 leading-relaxed">{step.warning}</p>
                          </div>
                        )}

                        {step.tip && (
                          <div className="flex items-start gap-2 rounded-lg bg-blue-500/8 border border-blue-500/20 px-3 py-2">
                            <Lightbulb className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-blue-300 leading-relaxed">{step.tip}</p>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>

                {content.permissions && content.permissions.length > 0 && (
                  <div className={`rounded-xl border ${accent.border} bg-slate-900/40 p-4 flex flex-col gap-3`}>
                    <div className="flex items-center gap-2">
                      <Shield className={`w-3.5 h-3.5 ${accent.icon}`} />
                      <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Permissões necessárias</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {content.permissions.map((perm) => (
                        <div key={perm.label} className="flex items-start gap-2.5">
                          <code className={`shrink-0 text-xs font-mono px-2 py-0.5 rounded border ${accent.badge} mt-0.5`}>
                            {perm.label}
                          </code>
                          <p className="text-xs text-slate-400 leading-relaxed">{perm.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {content.finalTip && (
                  <div className="flex items-start gap-2 rounded-lg bg-slate-700/40 border border-slate-700 px-3 py-3">
                    <Lightbulb className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-300 leading-relaxed">{content.finalTip}</p>
                  </div>
                )}

                {content.links && content.links.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {content.links.map((link) => (
                      <a
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${accent.badge} hover:opacity-80`}
                      >
                        {link.label}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-4 sm:px-6 py-4 border-t border-slate-700 safe-area-inset-bottom">
                <button
                  onClick={onClose}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-all duration-200 active:scale-95"
                >
                  Fechar
                </button>
              </div>
            </>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  )
}
