# Contrato de implementação — API de Blog

Documento de contrato derivado do [PRD](./project-prd.md). Define visão geral, stack, arquitetura de camadas e o contrato HTTP de cada endpoint (método, path, autenticação, inputs, respostas e erros).

---

## 1. Visão geral

API de blog com autenticação de usuários e gestão de posts.

- Cadastro e login geram um **token de sessão** persistido no banco e retornado ao cliente.
- Rotas protegidas exigem `Authorization: Bearer <token>`.
- Usuários autenticados podem criar, editar e excluir **apenas os próprios posts**.
- Listagem e consulta individual de posts são **públicas**.
- Escopo limitado a **auth + posts** (sem perfil, logout, papéis de admin, soft delete, etc.).

### Relacionamentos

| Recurso | Campos principais                                          | Observações             |
| ------- | ---------------------------------------------------------- | ----------------------- |
| `users` | `id`, `name`, `email`, `password` (hash), `token` (sessão) | `email` único           |
| `posts` | `id`, `title`, `content`, `createdAt`, `authorId`          | Relação 1:N com `users` |

Um usuário pode ter vários posts; cada post pertence a um único usuário.

---

## 2. Stack (alto nível)

| Camada               | Tecnologia                                                     |
| -------------------- | -------------------------------------------------------------- |
| Linguagem / bundling | TypeScript com Vite (template vanilla-ts)                      |
| HTTP                 | Express                                                        |
| Validação de input   | Zod                                                            |
| ORM                  | Drizzle                                                        |
| Banco                | PostgreSQL 17                                                  |
| Hash de senha        | bcrypt                                                         |
| Testes               | Vitest                                                         |
| Infra local          | Docker Compose, Dockerfile (blog-api, app DB + test DB(supertest e vitest), volumes separados) |

---

## 3. Arquitetura de implementação

É possível combinar arquitetura modular com Clean Architecture: os módulos representam domínios/funcionalidades (`auth` e `posts`), e cada módulo separa domínio e casos de uso dos adaptadores HTTP e de persistência. Aplicar SOLID como diretriz, sem criar abstrações sem necessidade. A dependência aponta para dentro: domínio e casos de uso não importam Express nem Drizzle.

### 3.1 Fluxo de request

```text
Express Route → Zod validation middleware → Controller → Use Case → Repository interface
                                                                  ↑          ↑
                                                             Domain       Drizzle Repository → PostgreSQL 17
```

- A rota conecta middlewares, controller e schema correspondente. Schemas Zod validam `body`, `params` e `query` antes do controller; o controller também pode receber os dados já parseados e tipados.
- O controller adapta HTTP para uma chamada de caso de uso e traduz sucesso em status/corpo HTTP. Não contém regras de negócio nem acessa o banco.
- Use cases implementam uma ação de negócio específica, como `SignUp`, `SignIn`, `CreatePost`, `ListPosts`, `GetPost`, `UpdatePost` e `DeletePost`. Eles dependem de contratos de repositório e serviços de domínio, não de Express/Drizzle.
- DTOs definem os dados de entrada/saída entre a borda HTTP e os casos de uso. Não expor entidades internas nem hashes de senha nas respostas.
- Repositórios são interfaces pertencentes à camada interna; implementações Drizzle ficam nos adaptadores de infraestrutura e acessam/persistem dados no PostgreSQL.
- A composição na inicialização injeta implementações Drizzle e serviços (por exemplo, hash de senha e geração de token) nos casos de uso.

Exemplo de organização modular (nomes podem ser ajustados sem alterar as responsabilidades):

```text
src/
  config/
    cors.ts
    env.ts
    logger.ts
  modules/
    auth/
      domain/
      dtos/
      schemas/
      repositories/
      use-cases/
      controllers/
      routes.ts
    posts/
      domain/
      dtos/
      schemas/
      repositories/
      use-cases/
      controllers/
      routes.ts
  shared/
    errors/
    http/middlewares/
  infrastructure/
    database/
      schema.ts
      drizzle/
    repositories/
  app.ts
  server.ts
```

### 3.2 Validação e tratamento global de erros

- Schemas Zod são a fonte de verdade para validar e inferir tipos de `body`, `params`, `query` e configurações de ambiente. IDs recebidos pela API usam `z.string().uuid()`; os valores de query que chegam como string podem usar coerção explícita, como `z.coerce.number()` para `page`.
- Middleware de validação executa `safeParse` antes do controller. Em falha, encaminha um erro de validação tipado ao middleware global; nenhum controller/use case é executado.
- Controllers passam somente dados validados para os DTOs/use cases. Use cases não recebem `Request`, `Response` nem objetos Zod.
- Erros de domínio/aplicação tipados (não encontrado, conflito, não autorizado e proibido) são convertidos para status HTTP pelo middleware global de erros. O tratamento de `ZodError` também é centralizado e produz o envelope `VALIDATION_ERROR`.
- O middleware global é registrado depois das rotas. Erros inesperados retornam `500 INTERNAL_ERROR`, sem stack trace nem detalhes internos na resposta; são registrados no logger. Respostas de erro seguem um único formato.
- O mesmo tratamento global captura erros assíncronos encaminhados pelo Express; não duplicar `try/catch` e formatação de resposta em cada controller.

### 3.3 Configuração, CORS e logging

- `config/env.ts` valida `process.env` com Zod na inicialização e exporta uma configuração tipada. Se a validação falhar, aborta a inicialização com uma mensagem clara indicando variáveis ausentes/inválidas, sem imprimir valores secretos.
- Variáveis mínimas: `NODE_ENV` (`development | test | production`), `PORT` (inteiro válido), `DATABASE_URL` e `TEST_DATABASE_URL` (URLs PostgreSQL), `CORS_ORIGIN` (origens permitidas) e `LOG_LEVEL` (nível suportado pelo logger). Credenciais/URLs não devem ser registradas em logs.
- `config/cors.ts` configura o middleware CORS a partir de `CORS_ORIGIN`, com allowlist explícita; não usar `*` junto de credenciais. CORS não substitui autenticação/autorização.
- `config/logger.ts` fornece logging estruturado com níveis configuráveis e redaction de tokens, senhas, `Authorization` e dados sensíveis. Registrar erros inesperados com contexto/correlation ID, sem expor stack traces ao cliente.
- `app.ts` monta middlewares, rotas e error handler; `server.ts` valida configuração e inicia o servidor. A conexão Drizzle/PostgreSQL é configurada na infraestrutura e recebe a URL validada.

---

## 4. Convenções gerais

### 4.1 Base URL

Prefixo sugerido: `/api`

### 4.2 Autenticação

Header obrigatório em rotas protegidas:

```http
Authorization: Bearer <session_token>
```

O token é o valor de sessão persistido na tabela de usuários (ou equivalente). Token ausente, malformado ou inválido → **401**.

### 4.3 Formato de erro

Todas as respostas de erro usam o mesmo envelope:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Descrição legível do erro",
    "details": []
  }
}
```

- `details` é opcional; em erros de validação Zod, lista campos e mensagens.
- Exemplo de `details` (400):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      { "path": "email", "message": "Invalid email" },
      {
        "path": "password",
        "message": "String must contain at least 6 character(s)"
      }
    ]
  }
}
```

### 4.4 Códigos de erro comuns

| HTTP | `code`             | Quando                                                                   |
| ---- | ------------------ | ------------------------------------------------------------------------ |
| 400  | `VALIDATION_ERROR` | Body/params/query inválidos (Zod)                                        |
| 401  | `UNAUTHORIZED`     | Token ausente, inválido ou credenciais incorretas no login               |
| 403  | `FORBIDDEN`        | Autenticado, mas sem permissão (ex.: editar/excluir post de outro autor) |
| 404  | `NOT_FOUND`        | Recurso não encontrado                                                   |
| 409  | `CONFLICT`         | Violação de unicidade (ex.: e-mail já cadastrado)                        |
| 500  | `INTERNAL_ERROR`   | Erro inesperado                                                          |

### 4.5 Paginação

- Query `page` (inteiro ≥ 1). Default: `1`.
- Convertida internamente em `offset` + `limit`.
- `limit` fixo da implementação: **10** itens por página.
- Fórmula: `offset = (page - 1) * limit`.

### 4.6 IDs

- Todos os IDs de `users` e `posts` são UUIDs, tanto no PostgreSQL quanto na API; isso inclui `id`, `authorId` e IDs aninhados em `author`.
- Colunas Drizzle/PostgreSQL devem usar tipo `uuid` (geração padrão no banco ou na aplicação). Nunca aceitar ou retornar IDs numéricos.
- Todo ID recebido em `params` ou `body` deve ser validado com Zod usando `z.string().uuid()`. Reutilizar o schema nos endpoints e nos DTOs de entrada; validar também os UUIDs produzidos nas fronteiras de saída quando apropriado.
- Exemplo para parâmetros: `const postParamsSchema = z.object({ id: z.string().uuid() }).strict()`.
- Exemplos de resposta mostram IDs como strings UUID, por exemplo `"id": "550e8400-e29b-41d4-a716-446655440000"`.

### 4.7 Datas

- A API usa `createdAt` e `updatedAt` em ISO 8601 (string), por exemplo `"2026-08-07T21:00:00.000Z"`.
- `updatedAt` é atualizado em qualquer alteração de usuário ou post. No PostgreSQL, nomes físicos de colunas podem ser `created_at` e `updated_at`, mapeados para camelCase pela aplicação.

### 4.8 Senha

- Nunca retornada em nenhuma resposta (nem hash).
- Persistida apenas como hash bcrypt.

---

## 5. Endpoints

### Resumo

| Método   | Path               | Auth | Descrição                             |
| -------- | ------------------ | ---- | ------------------------------------- |
| `POST`   | `/api/auth/signup` | Não  | Cadastro + retorno de token           |
| `POST`   | `/api/auth/signin` | Não  | Login + retorno de token              |
| `GET`    | `/api/posts`       | Não  | Listagem pública paginada             |
| `GET`    | `/api/posts/:id`   | Não  | Consulta pública por id               |
| `POST`   | `/api/posts`       | Sim  | Criar post                            |
| `PUT`    | `/api/posts/:id`   | Sim  | Atualizar parcialmente o próprio post |
| `DELETE` | `/api/posts/:id`   | Sim  | Excluir (hard delete) o próprio post  |

---

### 5.1 `POST /api/auth/signup`

Cadastra um usuário. Em sucesso, gera e persiste token de sessão e o retorna (usuário já autenticado).

|                   |                    |
| ----------------- | ------------------ |
| **Authorization** | Não                |
| **Content-Type**  | `application/json` |

#### Input — `body`

| Campo      | Tipo     | Obrigatório | Regras (Zod)                                             |
| ---------- | -------- | ----------- | -------------------------------------------------------- |
| `name`     | `string` | Sim         | Não vazio; trim; comprimento 1–100                       |
| `email`    | `string` | Sim         | E-mail válido; normalizar para lowercase; único no banco |
| `password` | `string` | Sim         | Mínimo 6 caracteres                                      |

#### Respostas

**201 Created**

```json
{
  "token": "string",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "string",
    "email": "string"
  }
}
```

**400** — `VALIDATION_ERROR` (campos inválidos)

**409** — `CONFLICT` — e-mail já cadastrado

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Email already registered"
  }
}
```

---

### 5.2 `POST /api/auth/signin`

Autentica com e-mail e senha. Em sucesso, gera e persiste novo token de sessão e o retorna.

|                   |                    |
| ----------------- | ------------------ |
| **Authorization** | Não                |
| **Content-Type**  | `application/json` |

#### Input — `body`

| Campo      | Tipo     | Obrigatório | Regras (Zod)                   |
| ---------- | -------- | ----------- | ------------------------------ |
| `email`    | `string` | Sim         | E-mail válido; lowercase       |
| `password` | `string` | Sim         | Não vazio; mínimo 6 caracteres |

#### Respostas

**200 OK**

```json
{
  "token": "string",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "string",
    "email": "string"
  }
}
```

**400** — `VALIDATION_ERROR`

**401** — `UNAUTHORIZED` — e-mail inexistente ou senha incorreta (mensagem genérica, sem revelar qual campo falhou)

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid email or password"
  }
}
```

---

### 5.3 `GET /api/posts`

Listagem pública de posts em ordem cronológica inversa (`createdAt` desc). Inclui o nome do autor (não o e-mail).

|                   |     |
| ----------------- | --- |
| **Authorization** | Não |

#### Input — `query`

| Campo  | Tipo                        | Obrigatório | Regras (Zod)             |
| ------ | --------------------------- | ----------- | ------------------------ |
| `page` | `number` (coerce de string) | Não         | Inteiro ≥ 1; default `1` |

#### Respostas

**200 OK**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "string",
      "content": "string",
      "createdAt": "2026-08-07T21:00:00.000Z",
      "updatedAt": "2026-08-07T21:00:00.000Z",
      "author": {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "name": "string"
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5
  }
}
```

- Página sem resultados retorna `data: []` com `meta` coerente (não é 404).

**400** — `VALIDATION_ERROR` — `page` inválida (ex.: `0`, negativo, não numérico)

---

### 5.4 `GET /api/posts/:id`

Consulta pública de um post por id, com nome do autor.

|                   |     |
| ----------------- | --- |
| **Authorization** | Não |

#### Input — `params`

| Campo | Tipo     | Obrigatório | Regras (Zod)        |
| ----- | -------- | ----------- | ------------------- |
| `id`  | `string` | Sim         | `z.string().uuid()` |

#### Respostas

**200 OK**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "string",
  "content": "string",
  "createdAt": "2026-08-07T21:00:00.000Z",
  "updatedAt": "2026-08-07T21:00:00.000Z",
  "author": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "string"
  }
}
```

**400** — `VALIDATION_ERROR` — `id` inválido

**404** — `NOT_FOUND`

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Post not found"
  }
}
```

---

### 5.5 `POST /api/posts`

Cria um post para o usuário autenticado. `createdAt` é definido no momento da criação. `authorId` vem do usuário do token.

|                   |                        |
| ----------------- | ---------------------- |
| **Authorization** | Sim — `Bearer <token>` |
| **Content-Type**  | `application/json`     |

#### Input — `body`

| Campo     | Tipo     | Obrigatório | Regras (Zod)                       |
| --------- | -------- | ----------- | ---------------------------------- |
| `title`   | `string` | Sim         | Não vazio; trim; comprimento 1–200 |
| `content` | `string` | Sim         | Não vazio; trim; comprimento ≥ 1   |

#### Respostas

**201 Created**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "title": "string",
  "content": "string",
  "createdAt": "2026-08-07T21:00:00.000Z",
  "updatedAt": "2026-08-07T21:00:00.000Z",
  "author": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "string"
  }
}
```

**400** — `VALIDATION_ERROR`

**401** — `UNAUTHORIZED` — token ausente/inválido

---

### 5.6 `PUT /api/posts/:id`

Atualização **parcial** do próprio post. Pode enviar só `title`, só `content`, ou ambos. Pelo menos um campo deve estar presente.

|                   |                        |
| ----------------- | ---------------------- |
| **Authorization** | Sim — `Bearer <token>` |
| **Content-Type**  | `application/json`     |

#### Input — `params`

| Campo | Tipo     | Obrigatório | Regras (Zod)        |
| ----- | -------- | ----------- | ------------------- |
| `id`  | `string` | Sim         | `z.string().uuid()` |

#### Input — `body`

| Campo     | Tipo     | Obrigatório | Regras (Zod)                        |
| --------- | -------- | ----------- | ----------------------------------- |
| `title`   | `string` | Não\*       | Se presente: não vazio; trim; 1–200 |
| `content` | `string` | Não\*       | Se presente: não vazio; trim; ≥ 1   |

\* Objeto deve ter **pelo menos um** de `title` ou `content`. Campos extras devem ser rejeitados (schema estrito / `.strict()`).

#### Respostas

**200 OK**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "title": "string",
  "content": "string",
  "createdAt": "2026-08-07T21:00:00.000Z",
  "updatedAt": "2026-08-07T21:00:00.000Z",
  "author": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "string"
  }
}
```

**400** — `VALIDATION_ERROR` — params/body inválidos ou body vazio

**401** — `UNAUTHORIZED`

**403** — `FORBIDDEN` — post existe, mas não pertence ao usuário autenticado

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You can only update your own posts"
  }
}
```

**404** — `NOT_FOUND` — post inexistente

---

### 5.7 `DELETE /api/posts/:id`

Hard delete do próprio post.

|                   |                        |
| ----------------- | ---------------------- |
| **Authorization** | Sim — `Bearer <token>` |

#### Input — `params`

| Campo | Tipo     | Obrigatório | Regras (Zod)        |
| ----- | -------- | ----------- | ------------------- |
| `id`  | `string` | Sim         | `z.string().uuid()` |

#### Input — body

Nenhum.

#### Respostas

**204 No Content** — corpo vazio

**400** — `VALIDATION_ERROR` — `id` inválido

**401** — `UNAUTHORIZED`

**403** — `FORBIDDEN` — post existe, mas não pertence ao usuário autenticado

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You can only delete your own posts"
  }
}
```

**404** — `NOT_FOUND` — post inexistente

---

## 6. Matriz de erros por endpoint

| Endpoint                | 400 | 401 | 403 | 404 | 409 |
| ----------------------- | --- | --- | --- | --- | --- |
| `POST /api/auth/signup` | ✓   |     |     |     | ✓   |
| `POST /api/auth/signin` | ✓   | ✓   |     |     |     |
| `GET /api/posts`        | ✓   |     |     |     |     |
| `GET /api/posts/:id`    | ✓   |     |     | ✓   |     |
| `POST /api/posts`       | ✓   | ✓   |     |     |     |
| `PUT /api/posts/:id`    | ✓   | ✓   | ✓   | ✓   |     |
| `DELETE /api/posts/:id` | ✓   | ✓   | ✓   | ✓   |     |

Erros **500** (`INTERNAL_ERROR`) podem ocorrer em qualquer endpoint diante de falha inesperada.

---

## 7. Fora deste contrato (alinhado ao PRD)

- Perfil do usuário (consultar/editar dados, trocar senha).
- Logout / invalidação explícita de sessão.
- Papéis e permissões além de autenticado vs público.
- Soft delete, status de publicação, slug, rascunhos.
- Upload de mídia, comentários, likes, tags.
