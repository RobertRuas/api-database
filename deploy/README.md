# Deploy — API DataBase

Guia operacional para subir a API em `database.windlog.org` (host: `cloud.windlog.org`).

## Pré-requisitos no servidor

- Ubuntu/Debian recente
- Docker + Docker Compose plugin
- Nginx
- Certbot (`sudo apt install certbot python3-certbot-nginx`)
- DNS `A` apontando `database.windlog.org` → IP do host

## Passos

### 1. Clonar e preparar

```bash
ssh user@cloud.windlog.org
cd /opt
sudo git clone <repo-url> api-database
sudo chown -R $USER:$USER api-database
cd api-database
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
# Gere secrets fortes:
echo "SESSION_SECRET=$(openssl rand -hex 32)" >> .env
# Edite: ADMIN_USERNAME, ADMIN_PASSWORD, POSTGRES_PASSWORD, PUBLIC_URL
nano .env
```

**Variáveis obrigatórias para o compose:**

```ini
PUBLIC_URL=https://database.windlog.org
POSTGRES_USER=apidb
POSTGRES_PASSWORD=<forte>
POSTGRES_DB=api_database
SESSION_SECRET=<32+ chars>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<forte>
```

### 3. Subir containers

```bash
docker compose up -d --build
docker compose logs -f api   # confirme "API DataBase pronta"
```

### 4. Configurar Nginx + TLS

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/database.windlog.org
sudo ln -s /etc/nginx/sites-available/database.windlog.org /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d database.windlog.org
```

### 5. Verificar

```bash
curl https://database.windlog.org/health
# → {"ok":true,"data":{"service":"api-database","db":"up",...}}
```

Acesse o painel em `https://database.windlog.org/admin`.

---

## Operação

### Atualizar

```bash
cd /opt/api-database
git pull
docker compose up -d --build
```

Migrations são aplicadas automaticamente no boot (`prisma migrate deploy`).

### Backup

```bash
# Dump do Postgres:
docker compose exec -T postgres pg_dump -U apidb api_database | gzip > backup-$(date +%F).sql.gz

# Arquivos:
docker run --rm -v api-database_storage:/data -v $(pwd):/out alpine \
  tar czf /out/files-$(date +%F).tar.gz -C /data .
```

### Restaurar

```bash
gunzip -c backup-YYYY-MM-DD.sql.gz | docker compose exec -T postgres psql -U apidb api_database
```

### Logs

```bash
docker compose logs -f api --tail=200
```

### Reset total (⚠️ destrutivo)

```bash
docker compose down -v   # apaga volumes — dados perdidos
```
