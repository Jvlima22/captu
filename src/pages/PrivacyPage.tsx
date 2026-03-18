import React from 'react';

const PrivacyPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-8 border border-gray-200 rounded-lg shadow-sm">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Aviso de Privacidade</h1>
        
        <div className="prose prose-blue max-w-none text-gray-600 space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-gray-800">1. Introdução</h2>
            <p>
              O CAPTU tem o compromisso de proteger sua privacidade. Este aviso descreve como coletamos, 
              usamos e protegemos seus dados pessoais de acordo com a Lei Geral de Proteção de Dados (LGPD).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800">2. Coleta de Dados</h2>
            <p>
              Coletamos as seguintes categorias de dados para operar nossos serviços de forma eficaz:
              <ul className="list-disc ml-6 space-y-2">
                <li>Informações de conta (e-mail, nome, telefone).</li>
                <li>Dados de leads e prospects B2B.</li>
                <li>Tokens de acesso OAuth de terceiros (como Pipedrive e HubSpot).</li>
              </ul>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800">3. Uso de Dados</h2>
            <p>
              Seus dados são usados exclusivamente para:
              <ul className="list-disc ml-6 space-y-2">
                <li>Prestar nossos serviços de inteligência de mercado.</li>
                <li>Sincronizar dados entre sua conta CAPTU e seu sistema de CRM.</li>
                <li>Fins administrativos e de personalização da experiência.</li>
              </ul>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800">4. Compartilhamento de Dados</h2>
            <p>
              Não vendemos seus dados pessoais a terceiros. Seus dados são compartilhados com parceiros 
              de integração (como Pipedrive) apenas conforme autorizado por você por meio do fluxo de autenticação.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800">5. Segurança dos Dados</h2>
            <p>
              Empregamos medidas técnicas e organizacionais adequadas para proteger seus dados contra 
              acesso não autorizado, perda ou destruição. Seus tokens de acesso ao CRM são criptografados 
              em nossos servidores.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800">6. Seus Direitos</h2>
            <p>
              Sob a LGPD, você tem o direito de acessar, corrigir ou excluir seus dados pessoais a qualquer momento. 
              Para exercer esses direitos, entre em contato com nosso suporte por meio do e-mail 
              <span className="font-semibold underline ml-1">comercial.tglsolutions@gmail.com</span>.
            </p>
          </section>

          <footer className="pt-8 border-t border-gray-100 text-sm italic">
            Última atualização: 18 de Março de 2026.
          </footer>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;
