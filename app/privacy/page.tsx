import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Política de Privacidade — Daily Reports',
  description: 'Política de Privacidade do aplicativo Daily Reports',
}

export default function PrivacyPage() {
  const lastUpdated = '13 de maio de 2026'
  const appName = 'Daily Reports'
  const contactEmail = 'felipi.trindade@medcof.tech'

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors inline-flex items-center gap-1"
          >
            ← Voltar
          </Link>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-8 sm:p-10 text-slate-300 space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Política de Privacidade</h1>
            <p className="text-slate-400 text-sm">Última atualização: {lastUpdated}</p>
          </div>

          <Section title="1. Sobre este aplicativo">
            <p>
              O <strong className="text-white">{appName}</strong> é uma ferramenta de uso interno que coleta dados de
              plataformas de trabalho (Jira, GitHub, Slack, Google Calendar e Google Meet) para gerar relatórios
              diários de atividade. O aplicativo é operado por Felipi Trindade e não é disponibilizado ao público
              em geral.
            </p>
          </Section>

          <Section title="2. Dados coletados">
            <p>Para operar, o aplicativo acessa as seguintes categorias de dados mediante autorização explícita do usuário:</p>
            <ul className="list-disc list-inside mt-3 space-y-1.5 text-slate-300">
              <li><strong className="text-slate-200">Google Calendar:</strong> eventos do calendário dentro do período selecionado (título, horário, participantes, status de resposta).</li>
              <li><strong className="text-slate-200">Google Meet:</strong> registros de conferências realizadas (participantes, duração, transcrições se disponíveis).</li>
              <li><strong className="text-slate-200">Jira:</strong> issues, comentários e histórico de alterações de status dentro do período selecionado.</li>
              <li><strong className="text-slate-200">GitHub:</strong> commits, pull requests, revisões e comentários de repositórios autorizados.</li>
              <li><strong className="text-slate-200">Slack:</strong> mensagens, threads e registros de chamadas em canais e DMs selecionados.</li>
            </ul>
          </Section>

          <Section title="3. Como os dados são utilizados">
            <p>Os dados coletados são utilizados exclusivamente para:</p>
            <ul className="list-disc list-inside mt-3 space-y-1.5">
              <li>Gerar o relatório diário de atividades do usuário.</li>
              <li>Produzir resumos executivos via OpenAI (os dados são enviados à API da OpenAI de forma temporária e não são armazenados pela OpenAI para treinamento conforme a política de uso da API).</li>
              <li>Enviar o relatório por e-mail ao destinatário configurado.</li>
            </ul>
          </Section>

          <Section title="4. Armazenamento e retenção">
            <p>
              O aplicativo <strong className="text-white">não armazena dados de calendário, reuniões, commits, mensagens ou qualquer dado de terceiros</strong> em banco de dados próprio.
              Os tokens de acesso Google (access token e refresh token) são mantidos temporariamente em memória durante a sessão do servidor para processar o relatório e são descartados após o uso.
              Credenciais de integração (tokens de API) são armazenadas localmente no navegador do usuário via <code className="bg-slate-700 px-1 rounded text-xs">localStorage</code> e nunca são transmitidas a servidores externos além das APIs das respectivas plataformas.
            </p>
          </Section>

          <Section title="5. Compartilhamento de dados">
            <p>
              Os dados não são compartilhados com terceiros, exceto pelas próprias plataformas cujas APIs são consultadas
              (Google, Atlassian, GitHub, Slack, OpenAI) de acordo com os termos de serviço de cada uma delas.
            </p>
          </Section>

          <Section title="6. Permissões do Google">
            <p>O aplicativo solicita as seguintes permissões OAuth do Google:</p>
            <ul className="list-disc list-inside mt-3 space-y-1.5">
              <li><code className="bg-slate-700 px-1 rounded text-xs">https://www.googleapis.com/auth/calendar.readonly</code> — leitura de eventos do Google Calendar.</li>
              <li><code className="bg-slate-700 px-1 rounded text-xs">https://www.googleapis.com/auth/meetings.space.readonly</code> — leitura de registros do Google Meet.</li>
            </ul>
            <p className="mt-3">
              O acesso pode ser revogado a qualquer momento em{' '}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                myaccount.google.com/permissions
              </a>.
            </p>
          </Section>

          <Section title="7. Segurança">
            <p>
              Toda comunicação entre o aplicativo e as APIs externas utiliza HTTPS/TLS.
              Os payloads transmitidos via fila de mensagens (RabbitMQ) são cifrados com AES-256.
            </p>
          </Section>

          <Section title="8. Contato">
            <p>
              Para dúvidas sobre esta política, entre em contato pelo e-mail:{' '}
              <a href={`mailto:${contactEmail}`} className="text-blue-400 hover:text-blue-300 underline">
                {contactEmail}
              </a>
            </p>
          </Section>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          © {new Date().getFullYear()} {appName}
        </p>
      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-3">{title}</h2>
      <div className="text-slate-300 text-sm leading-relaxed space-y-2">{children}</div>
    </section>
  )
}
