# Ollama proxy (Node)

## Configuration

Definir les variables d'environnement avant de lancer :

- `PORT=3001`
- `OLLAMA_URL=http://localhost:11434/api/generate`
- `MONGO_URI=mongodb://localhost:27017/medicapp`
- `MONGO_DB_NAME=medicapp`
- `CORS_ORIGIN=http://medicapp.local`

## Demarrage

```
npm install
npm start
```

## Endpoint

POST `http://localhost:3001/api/ollama/generate`

Body JSON :
```
{
  "model": "qwen2.5:14b",
  "prompt": "..."
}
```
