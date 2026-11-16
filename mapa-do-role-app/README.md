# Mapa do Rolê — base segura de aplicação

Base full-stack para o piloto de Porto Alegre. Inclui landing page em React, autenticação com access JWT curto, refresh token rotativo em cookie HTTP-Only, PostgreSQL e campos cifrados com AES-256-GCM.

## 1. Arquitetura de segurança e criptografia

- **Senhas:** Argon2id com salt aleatório gerado pela biblioteca e configuração inicial de 19 MiB, 2 iterações e 1 lane. Ajuste por benchmark do servidor.
- **Access token:** JWT HS256 com expiração de 10 minutos, issuer, audience e algoritmo fixo na validação. O frontend o mantém somente em memória.
- **Refresh token:** segredo aleatório opaco, rotativo e armazenado no banco somente como SHA-256. O cookie é HTTP-Only, SameSite Strict, Secure em produção e limitado a /api/auth. Reutilização de token revogado invalida a família da sessão.
- **Dados sensíveis:** server/src/security/encryption.js cifra o e-mail e a anotação privada com AES-256-GCM, nonce aleatório de 12 bytes, tag de 16 bytes, AAD vinculada ao usuário/campo e versão da chave. O login localiza o e-mail por HMAC-SHA-256 com uma chave separada; o valor de busca não é um hash simples de e-mail.
- **Camadas web:** Helmet com CSP, CORS por origem exata, validação de payloads com Zod, limite de JSON, rate limits, verificação de Origin nas rotas de autenticação e queries PostgreSQL parametrizadas.
- **XSS e SQL injection:** a API recebe texto simples e não renderiza HTML; React escapa texto ao exibi-lo, e a CSP restringe scripts. Queries SQL usam parâmetros. Não use dangerouslySetInnerHTML; caso surja conteúdo HTML rico, aplique um sanitizador mantido com allowlist específica antes de renderizar.
- **HTTPS:** TLS 1.3 direto no Node ou pelo Nginx de exemplo. A API recusa HTTP em produção.
- **Rate limit compartilhado:** Redis é opcional no desenvolvimento e obrigatório em produção, usando conexão rediss://.

Senhas são armazenadas por hash e não são cifradas: a validação usa Argon2id, que é adequado para senhas por ser lento e resistente a ataques de tentativa em massa. A configuração inicial segue o mínimo recomendado pela OWASP. [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

## 2. Interface

A landing page usa React, Vite, Tailwind CSS 4 e Motion para React. Inclui:

- Header, chamada principal e preview esquemático do mapa de Porto Alegre.
- Cadastro e login conectados à API, validação de e-mail/senha e feedback visual.
- Alternância entre tema claro e escuro, layout responsivo e animações reduzidas quando o sistema pede menos movimento.
- Tokens de acesso mantidos somente em memória. A preferência de tema é a única informação salva no localStorage.

Os eventos da ilustração são exemplos fictícios.

## 3. Identidade visual

client/public/logo.svg é o SVG puro do projeto: escudo, marcador de mapa e brilho em gradiente, com fundo transparente ao redor do símbolo.

## Estrutura

    mapa-do-role-app/
      client/
        public/logo.svg
        src/App.jsx
        src/components/AuthPanel.jsx
        src/components/Logo.jsx
        src/main.jsx
        src/styles.css
      deploy/nginx.conf
      server/
        db/schema.sql
        src/config.js
        src/db.js
        src/middleware/
        src/rateLimitStore.js
        src/routes/
        src/security/

## Rodar localmente no Windows

1. Instale Node.js 22.12 ou superior, PostgreSQL e, se quiser testar limites distribuídos localmente, Redis.
2. Crie um banco chamado mapa_do_role e aplique o esquema:

       createdb -U postgres mapa_do_role
       psql -U postgres -d mapa_do_role -f .\server\db\schema.sql

3. Copie server/.env.example para server/.env. Gere três segredos diferentes com:

       node --input-type=module -e "import { randomBytes } from 'node:crypto'; console.log(randomBytes(32).toString('base64'))"

   Use um valor em JWT_ACCESS_SECRET_BASE64, o segundo dentro de DATA_ENCRYPTION_KEYS_JSON e o terceiro em EMAIL_LOOKUP_KEYS_JSON. Exemplo de formato: {"1":"CHAVE_BASE64_GERADA"}.
4. Em um terminal:

       cd server
       npm install
       npm run dev

5. Copie client/.env.example para client/.env.local. Em outro terminal:

       cd client
       npm install
       npm run dev

Abra http://localhost:5173. O frontend espera a API em http://localhost:4000.

## Rotas principais

| Método | Rota | Uso |
|---|---|---|
| POST | /api/auth/register | Criar conta |
| POST | /api/auth/login | Entrar |
| POST | /api/auth/refresh | Rotacionar refresh token e emitir novo access token |
| POST | /api/auth/logout | Revogar refresh token |
| GET | /api/me/private-note | Ler a anotação privada cifrada |
| PUT | /api/me/private-note | Guardar a anotação privada cifrada |

As rotas /api/me/* recebem Authorization: Bearer ACCESS_TOKEN.

## Antes de publicar

- Armazene segredos e chaves num KMS/secret manager. Não versione arquivos .env. A chave AES precisa ser restaurada de backup seguro; perder a chave torna os dados cifrados irrecuperáveis.
- Use Redis com TLS e autenticação, PostgreSQL com certificado validado e uma origem web HTTPS exata. O frontend e a API devem compartilhar o mesmo site para o cookie SameSite Strict.
- O Nginx de exemplo força TLS 1.3, envia os headers de segurança e encaminha /api/ ao Node. Configure TRUST_PROXY_HOPS=1 apenas se o backend for alcançável só pelo proxy confiável e este sobrescrever os headers encaminhados.
- A CSP permite estilos inline porque Motion aplica transformações de animação no elemento; a execução de scripts continua limitada a arquivos da própria origem.
- O rate limiter local em memória serve apenas para desenvolvimento. Em produção, REDIS_URL=rediss://... é obrigatório para sincronizar limites entre processos.
- Ao trocar chaves, mantenha as versões antigas nos keyrings até recriptografar os dados ou migrar os índices HMAC. Atualize a versão ativa só depois de instalar a nova chave.
- Antes de abrir cadastro ao público, acrescente verificação de e-mail, recuperação de conta, monitoramento, backups testados e revisão de segurança independente. Este código é uma base de implementação, não uma certificação de segurança.

O backend usa TLS e headers de segurança recomendados pela documentação do Express; o proxy de exemplo fixa o protocolo mínimo em TLS 1.3. [Express: Production Security Best Practices](https://expressjs.com/en/advanced/best-practice-security/) · [Node.js TLS API](https://nodejs.org/api/tls.html)
