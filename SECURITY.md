# Segurança do Motazt Studio

## Correções incluídas no código

O frontend agora escapa textos vindos do Supabase antes de renderizá-los, valida URLs de Storage e links externos, limita tipos e tamanho de uploads, normaliza nomes de arquivos, trata navegadores sem `IntersectionObserver`, reduz as colunas retornadas nas consultas públicas, corrige o login administrativo que estava sem funções carregadas, adiciona headers de segurança na Vercel e remove scripts legados não referenciados.

## Ação obrigatória no Supabase

A chave publishable pode permanecer no frontend. Ela não concede privilégios automaticamente; o controle real precisa ser feito por RLS, Auth e Storage. O teste não destrutivo realizado em 15/08/2026 encontrou:

| Recurso | Acesso anônimo observado |
|---|---:|
| `public.galerias` | `401` |
| `public.fotos` | `401` |
| `public.galeria` | `200` |
| listagem do bucket `fotos` | `200` |

Isso indica que a tabela legada `galeria` e/ou o bucket `fotos` ainda podem estar públicos. O arquivo `SECURITY-SETUP.sql` contém uma base de políticas para revisão no SQL Editor. Não execute o arquivo sem conferir os nomes reais das colunas, papéis e políticas existentes.

## Storage privado e URLs assinadas

O código legado ainda usa `getPublicUrl()` para o Storage. Portanto, **não torne o bucket `fotos` privado antes de migrar o fluxo de imagens para URLs assinadas por uma função de servidor**; caso contrário, os álbuns deixarão de exibir fotos. A sequência segura é: criar uma função server-side que valide o álbum e gere URLs assinadas, atualizar o frontend para consumi-la, testar um álbum, e somente então tornar o bucket privado.

## Validação pós-configuração

Depois de revisar as políticas, repita os testes com a chave publishable. Consultas anônimas a tabelas administrativas devem retornar `401` ou `403`. Listagem e download direto do bucket de originais não devem funcionar sem uma URL assinada válida. O usuário administrador deve conseguir fazer login por `login.html`, acessar `admin-galerias.html` e executar somente as operações permitidas pela role administrativa.
