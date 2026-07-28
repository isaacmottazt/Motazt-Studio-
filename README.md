# 🤖 Motazt Studio — Chatbot Inteligente v2.0

## 📦 O que foi atualizado?

Este pacote contém a versão **2.0** do chatbot do Motazt Studio com as seguintes melhorias:

### ✨ Principais Mudanças

✅ **Inteligência Avançada**
- Motor de intenções que reconhece múltiplos contextos
- Palavras-chave expandidas para melhor detecção de comandos
- Respostas contextuais e personalizadas

✅ **Agendamento Completo no Chat**
- Cliente pode agendar SEM sair do chat
- Coleta dados: Nome → Telefone → Tipo → Data → Horário
- Integração direta com banco de dados (Supabase)

✅ **Email Removido**
- ❌ Campo de email foi removido do fluxo de agendamento
- ✅ Mantém apenas dados essenciais

✅ **Sugestão Inteligente de Horários**
- Consulta disponibilidade real em tempo real
- Mostra apenas horários realmente livres
- Adapta conforme tipo de ensaio escolhido

✅ **Menu Contextual**
- Botões sugestivos mudam conforme a conversa
- Guia o cliente para próxima ação lógica

---

## 🚀 Como Começar

### 1. Arquivos Novos/Alterados

```
📁 Motazt Studio/
├── 📄 index.html (ATUALIZADO - novo script do chatbot)
├── 📄 GUIA-CHATBOT-V2.md (NOVO - guia completo)
├── 📄 README.md (NOVO - este arquivo)
└── 📁 js/
    └── 📄 chatbot-inteligente.js (NOVO - chatbot v2.0)
```

### 2. Instalação

1. **Substitua os arquivos** do seu projeto pelos arquivos atualizados
2. **Não precisa alterar nada** no Supabase (usa mesma configuração)
3. **Pronto!** O chat já funciona com a nova inteligência

### 3. Testar

1. Abra seu site
2. Clique no botão de chat (💬)
3. Escreva: "Oi! Quanto custa um ensaio?"
4. O bot deve entender e responder com valores

---

## 🎯 Comandos Que o Chat Entende

### Simples (Uma Palavra)
```
"oi" → Saudação
"menu" → Mostra menu
"valores" → Mostra valores
"galeria" → Abre galeria
```

### Específicos
```
"Quero agendar" → Inicia agendamento
"Quais datas estão disponíveis?" → Lista datas livres
"Quais horários para 15/08?" → Mostra horários do dia
"Quanto custa um casamento?" → Valor específico
```

### Sobre Políticas
```
"Qual é o prazo de entrega?"
"Como faço para cancelar?"
"Qual a política de reembolso?"
```

### Atendimento
```
"Quero falar com uma pessoa de verdade"
"Me passa o WhatsApp"
"Como faço contato?"
```

---

## 📋 Fluxo de Agendamento no Chat

```
CLIENTE                          BOT
   |                             |
   |—— "Quero agendar" ———————→   |
   |                         Qual é seu nome?
   |← Você pode agendar! ————— 
   |
   |—— "João Silva" ———————————→  |
   |                         Qual seu telefone?
   |← Prazer, João! ————————
   |
   |—— "(73) 98165-6986" ————→   |
   |                         Qual tipo de ensaio?
   |← Qual tipo? ——— [Individual] [Casal] ... —
   |
   |—— [Clica em Individual] →    |
   |                         Para qual data?
   |← Individual! ———————— [Ver datas] ———
   |
   |—— [Clica em Ver datas] →     |
   |                    Consultando banco... ⏳
   |← Próximas datas livres ——————
   |
   |—— "15/08/2026" ————————→     |
   |                    Consultando horários... ⏳
   |← Horários para 15/08 ————————
   |
   |—— "14:30" ————————————→      |
   |                    Processando... ⏳
   |← ✅ AGENDADO! ————————————
   |    Confirmação no WhatsApp
```

---

## 💰 Configurar Valores

Os valores estão no arquivo `js/chatbot-inteligente.js`:

**Para editar**, abra o arquivo e procure por:

```javascript
const VALORES_SERVICOS = {
    'Ensaio Individual': 'R$ 300 a R$ 500',
    'Ensaio de Casal': 'R$ 400 a R$ 600',
    // ... etc
};
```

Altere os valores conforme necessário e salve!

---

## ⏰ Configurar Horários de Funcionamento

Abra `js/chatbot-inteligente.js` e procure por:

```javascript
const HORARIO_ABERTURA = '07:00';      // Mude aqui
const HORARIO_FECHAMENTO = '22:00';    // E aqui
```

**Exemplos:**
- Funciona de 8h às 18h? → `'08:00'` e `'18:00'`
- Funciona 24h? → `'00:00'` e `'23:59'`

---

## 🔗 Configurar WhatsApp

Abra `js/chatbot-inteligente.js` e procure por:

```javascript
const WHATSAPP_LINK = 'https://wa.me/5585999999999';
```

**Para alterar seu número:**
1. Pegue seu número com DDD (exemplo: 73981656986)
2. Coloque assim: `'https://wa.me/55' + SEU_NUMERO`

**Exemplo para (73) 98165-6986:**
```javascript
const WHATSAPP_LINK = 'https://wa.me/5573981656986';
```

---

## 🎨 Personalizar Aparência (Opcional)

Se quiser mudar cores/tamanho do chat, edite `style.css`:

```css
.chatbot-painel {
    width: 350px;           /* Largura */
    height: 500px;          /* Altura */
    border-radius: 15px;    /* Cantos arredondados */
    box-shadow: 0 5px 40px rgba(0,0,0,0.16); /* Sombra */
}

.chatbot-header {
    background: #1a1a1a;    /* Cor do cabeçalho */
}

.chatbot-chip {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

---

## 🧪 Testando

### Teste 1: Reconhecer Intenções
```
Digite: "E aí, quanto custa um ensaio individual?"
Esperado: Bot reconhece 3 intenções (saudação, valores, individual)
          Responde com valor específico
```

### Teste 2: Agendamento Completo
```
Digite: "Quero marcar um ensaio de casal"
Siga o fluxo: nome → telefone → tipo → data → horário
Esperado: Mensagem de confirmação com todos os dados
```

### Teste 3: Datas Disponíveis
```
Digite: "Quais datas estão livres?"
Esperado: Bot consulta banco e lista próximas 7 datas com vagas
```

### Teste 4: Horários Específicos
```
Digite: "Qual horário para 20/08?"
Esperado: Bot mostra horários realmente livres para aquele dia
```

---

## ⚙️ Banco de Dados (Supabase)

O chatbot usa as mesmas tabelas do seu formulário:

### Tabela: `agendamentos`

Campos criados pelo chatbot:
- `nome` (texto)
- `telefone` (texto)
- `ensaio` (texto) - tipo de ensaio
- `data` (data)
- `horario` (hora)
- `duracao_min` (número)
- `status` (texto) - 'confirmado' ou 'cancelado'

✅ **Não precisa fazer nada!** Usa a mesma tabela do formulário.

---

## 🐛 Troubleshooting

### Chat não aparece
```
❌ Problema: Botão 💬 não aparece na página
✅ Solução: Verifique se chatbot-inteligente.js está sendo carregado
           (F12 → Console → procure por erros)
```

### Chat não reconhece comandos
```
❌ Problema: "Olá" → bot responde com dúvida genérica
✅ Solução: Verifique console.log para debug
            Teste com comandos simples primeiro (ex: "menu")
```

### Agendamento não salva
```
❌ Problema: Aparece ✅ mas não salva no Supabase
✅ Solução: 1) Verifique permissões da tabela no Supabase
            2) Confirme credenciais (URL e chave pública)
            3) Veja DevTools → Network para erros
```

### Horários não aparecem
```
❌ Problema: Chat sempre diz "sem horários livres"
✅ Solução: 1) Confirme que há dados na tabela agendamentos
            2) Teste com datas diferentes
            3) Veja se HORARIO_ABERTURA/FECHAMENTO estão corretos
```

---

## 📞 Fluxo de Suporte

1. **Dúvida sobre configuração?**
   → Veja `GUIA-CHATBOT-V2.md`

2. **Erro técnico?**
   → Abra DevTools (F12) → Console e procure pela mensagem de erro

3. **Supabase não funciona?**
   → Vá ao dashboard do Supabase e confirme:
     - Tabela `agendamentos` existe
     - RLS policies permitem inserção
     - Chave pública está correta

4. **Personalizações avançadas?**
   → Edite `js/chatbot-inteligente.js` diretamente

---

## 📚 Arquivos Importantes

| Arquivo | Função |
|---------|--------|
| `index.html` | Carrega o novo chatbot |
| `js/chatbot-inteligente.js` | Motor do chatbot (NOVO) |
| `style.css` | Estilos do chat (pode customizar) |
| `GUIA-CHATBOT-V2.md` | Guia técnico detalhado |
| `README.md` | Este arquivo |

---

## 🎓 Próximas Melhorias

Sugestões para futuro:

1. **Integração com IA (Claude API)**
   - Respostas ainda mais naturais
   - Entendimento de contexto avançado

2. **Histórico de Chats**
   - Cliente vê agendamentos anteriores
   - Sugestões baseadas no histórico

3. **Confirmação de Agendamento**
   - SMS ou Email com confirmação
   - Link para editar/cancelar

4. **Sugestões Inteligentes**
   - "Você agende semana passada. Quer agendar novamente?"
   - Notificações de promoções

5. **Análise de Satisfação**
   - Avaliação pós-agendamento
   - Feedback do cliente

---

## 📝 Versão & Histórico

**Versão Atual:** 2.0  
**Data:** Julho 2026  
**Última atualização:** 24/07/2026

### Mudanças v1.0 → v2.0

- ✨ Agendamento integrado no chat
- ✨ Motor de intenções avançado
- ✨ Email removido (apenas dados essenciais)
- ✨ Sugestão inteligente de horários
- ✨ Menu contextual dinâmico
- 🐛 Melhor tratamento de erros
- 📈 Performance otimizada

---

## 💡 Dicas Finais

1. **Teste no celular** - Chat é mobile-first
2. **Customize as mensagens** - Adicione sua personalidade
3. **Mantenha valores atualizados** - Clientes veem valores reais
4. **Respeite horários** - Chat não agenda fora do funcionamento
5. **Use WhatsApp** - Confirmação automática lá aumenta conversão

---

## ❓ Perguntas Frequentes

**P: O cliente precisa ter email para agendar?**
R: Não! Email foi removido. Apenas nome, telefone, tipo, data e hora.

**P: O agendamento no chat é automático?**
R: Sim! Salva direto no Supabase. Cliente recebe confirmação no WhatsApp.

**P: Posso mudar os textos do bot?**
R: Sim! Abra `chatbot-inteligente.js` e edite as funções de resposta.

**P: E se o cliente não conseguir agendar?**
R: Chat oferece opção de falar com equipe pelo WhatsApp.

**P: Funciona offline?**
R: Não. Precisa de conexão com internet (Supabase).

---

## 🎉 Pronto!

Seu chatbot agora é **inteligente, conversacional e vende**! 

Qualquer dúvida, consulte os arquivos ou entre em contato.

**Aproveite! 🚀**

---

*Desenvolvido para Motazt Studio*  
*© 2026 - Todos os direitos reservados*
