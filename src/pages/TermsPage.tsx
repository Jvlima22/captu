import React from 'react';

const TermsPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-8 border border-gray-200 rounded-lg shadow-sm">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Termos de Serviço</h1>
        
        <div className="prose prose-blue max-w-none text-gray-600 space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-gray-800">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar e usar o CAPTU, você concorda em cumprir e estar vinculado a estes Termos de Serviço. 
              Se você não concordar com qualquer parte destes termos, você não deve usar nossos serviços.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800">2. Descrição do Serviço</h2>
            <p>
              O CAPTU fornece ferramentas de inteligência de mercado e geração de leads B2B, permitindo a sincronização 
              de dados com sistemas de CRM de terceiros, como o Pipedrive.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800">3. Uso Responsável</h2>
            <p>
              Você concorda em usar o serviço apenas para fins lícitos e de acordo com as leis de proteção de dados aplicáveis (LGPD). 
              É proibido o uso do serviço para spam, assédio ou qualquer atividade ilegal.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800">4. Integrações de Terceiros</h2>
            <p>
              Ao conectar sua conta do Pipedrive, você autoriza o CAPTU a ler e gravar dados em seu CRM conforme as permissões 
              concedidas durante o processo de autorização OAuth. Não nos responsabilizamos por ações tomadas pelo Pipedrive 
              em sua conta.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800">5. Limitação de Responsabilidade</h2>
            <p>
              O CAPTU é fornecido "como está". Não garantimos que o serviço será ininterrupto ou livre de erros. 
              Em nenhum caso seremos responsáveis por danos indiretos ou perda de lucros.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800">6. Alterações nos Termos</h2>
            <p>
              Reservamo-nos o direito de modificar estes termos a qualquer momento. O uso continuado do serviço 
              após tais alterações constitui sua aceitação dos novos termos.
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

export default TermsPage;
