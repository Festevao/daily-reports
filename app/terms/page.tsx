import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Termos de Serviço',
  description: 'Termos de Serviço do Daily Reports — Productivity automation tool by Felipi Trindade.',
}

export default function TermsPage() {
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
            <h1 className="text-3xl font-bold text-white mb-2">Termos de Serviço</h1>
            <p className="text-slate-400 text-sm">Última atualização: {lastUpdated}</p>
          </div>

          <Section title="1. Aceitação dos termos">
            <p>
              Ao utilizar o <strong className="text-white">{appName}</strong>, você concorda com estes Termos de Serviço.
              Se não concordar, não utilize o aplicativo.
            </p>
          </Section>

          <Section title="2. Descrição do serviço">
            <p>
              O {appName} é uma ferramenta de uso interno que integra plataformas de trabalho (Jira, GitHub, Slack,
              Google Calendar e Google Meet) para gerar relatórios diários de atividade do usuário.
              O serviço é fornecido "como está", sem garantias de disponibilidade contínua.
            </p>
          </Section>

          <Section title="3. Uso autorizado">
            <p>O usuário se compromete a:</p>
            <ul className="list-disc list-inside mt-3 space-y-1.5">
              <li>Utilizar o aplicativo exclusivamente para fins profissionais legítimos.</li>
              <li>Fornecer credenciais de API válidas e mantê-las em segurança.</li>
              <li>Não utilizar o aplicativo para acessar dados de terceiros sem autorização.</li>
              <li>Respeitar os termos de uso das plataformas integradas (Google, Atlassian, GitHub, Slack, OpenAI).</li>
            </ul>
          </Section>

          <Section title="4. Responsabilidades do usuário">
            <p>
              O usuário é integralmente responsável pelas credenciais de API fornecidas ao aplicativo.
              O {appName} não se responsabiliza por acessos não autorizados decorrentes de credenciais comprometidas
              ou configuradas de forma incorreta pelo usuário.
            </p>
          </Section>

          <Section title="5. Integração com o Google">
            <p>
              O uso das APIs do Google está sujeito aos{' '}
              <a
                href="https://developers.google.com/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Termos de Serviço das APIs do Google
              </a>
              {' '}e à{' '}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Política de Privacidade do Google
              </a>
              . O usuário pode revogar o acesso do aplicativo à conta Google a qualquer momento em{' '}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                myaccount.google.com/permissions
              </a>
              .
            </p>
          </Section>

          <Section title="6. Limitação de responsabilidade">
            <p>
              O {appName} é fornecido sem garantias de qualquer tipo. Em nenhuma circunstância os responsáveis
              pelo aplicativo serão responsáveis por danos diretos, indiretos, incidentais ou consequenciais
              decorrentes do uso ou incapacidade de uso do serviço.
            </p>
          </Section>

          <Section title="7. Modificações">
            <p>
              Estes termos podem ser atualizados a qualquer momento. O uso continuado do aplicativo após
              a publicação de alterações implica aceitação dos novos termos.
            </p>
          </Section>

          <Section title="8. Contato">
            <p>
              Para dúvidas sobre estes termos, entre em contato pelo e-mail:{' '}
              <a href={`mailto:${contactEmail}`} className="text-blue-400 hover:text-blue-300 underline">
                {contactEmail}
              </a>
            </p>
          </Section>
        </div>

        <footer className="text-center text-xs text-slate-600 mt-6 space-y-1">
          <p className="font-medium text-slate-500">
            <strong className="text-slate-400">Daily Reports</strong> &mdash; Productivity automation tool &mdash; by Felipi Trindade
          </p>
          <div className="flex items-center justify-center gap-4">
            <a href="/privacy" className="hover:text-slate-400 transition-colors">Política de Privacidade</a>
            <span>·</span>
            <a href="/terms" className="hover:text-slate-400 transition-colors">Termos de Serviço</a>
            <span>·</span>
            <span>© {new Date().getFullYear()} Daily Reports</span>
          </div>
        </footer>
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
