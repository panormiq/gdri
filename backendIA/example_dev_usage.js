/**
 * Exemple d'utilisation du BackendIA en mode développement (JavaScript/Node.js)
 * 
 * Installation requise:
 *   npm install axios
 * 
 * Ou en utilisant fetch (disponible nativement dans Node 18+):
 *   Pas d'installation nécessaire
 */

// Utilisation avec axios
// const axios = require('axios');

// Configuration
const BASE_URL = "http://192.168.1.53:8000";  // Ou "http://localhost:8000" en local
const DEV_TOKEN = "dev-token-123456789-quick-access";

// Headers avec le token de développement
const headers = {
    "Authorization": `Bearer ${DEV_TOKEN}`,
    "Content-Type": "application/json"
};

/**
 * Test 1: Prompt simple avec fetch (natif)
 */
async function testPromptSimple() {
    console.log("🧪 Test 1: Prompt simple");
    
    try {
        const response = await fetch(`${BASE_URL}/api/prompt`, {
            method: "POST",
            headers: headers,
            body: JSON.stringify({
                prompt: "Bonjour, comment vas-tu ?"
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log("✅ Succès!");
            console.log(`Réponse: ${data.response.substring(0, 100)}...`);
        } else {
            console.log(`❌ Erreur: ${response.status}`);
            console.log(data);
        }
    } catch (error) {
        console.error("❌ Erreur:", error.message);
    }
    console.log();
}

/**
 * Test 2: Prompt avec paramètres personnalisés
 */
async function testPromptAvecParametres() {
    console.log("🧪 Test 2: Prompt avec paramètres");
    
    try {
        const response = await fetch(`${BASE_URL}/api/prompt`, {
            method: "POST",
            headers: headers,
            body: JSON.stringify({
                prompt: "Explique-moi le concept de l'intelligence artificielle en 3 phrases.",
                temperature: 0.7,
                max_tokens: 200,
                model: "mistral:latest"
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log("✅ Succès!");
            console.log(`Réponse: ${data.response}`);
            console.log(`Modèle: ${data.model}`);
            console.log(`Temps de traitement: ${data.processing_time || 'N/A'}s`);
        } else {
            console.log(`❌ Erreur: ${response.status}`);
            console.log(data);
        }
    } catch (error) {
        console.error("❌ Erreur:", error.message);
    }
    console.log();
}

/**
 * Test 3: Vérifier les informations utilisateur
 */
async function testUserInfo() {
    console.log("🧪 Test 3: Informations utilisateur");
    
    try {
        const response = await fetch(`${BASE_URL}/auth/me`, {
            method: "GET",
            headers: headers
        });
        
        const user = await response.json();
        
        if (response.ok) {
            console.log("✅ Succès!");
            console.log(`Username: ${user.username}`);
            console.log(`Email: ${user.email}`);
            console.log(`Role: ${user.role}`);
        } else {
            console.log(`❌ Erreur: ${response.status}`);
            console.log(user);
        }
    } catch (error) {
        console.error("❌ Erreur:", error.message);
    }
    console.log();
}

/**
 * Test 0: Health check
 */
async function testHealthCheck() {
    console.log("🧪 Test 0: Health check");
    
    try {
        const response = await fetch(`${BASE_URL}/`);
        const data = await response.json();
        
        if (response.ok) {
            console.log("✅ Serveur en ligne!");
            console.log(data);
        } else {
            console.log(`❌ Serveur hors ligne: ${response.status}`);
        }
    } catch (error) {
        console.error("❌ Impossible de se connecter au serveur");
        console.error(`   Vérifiez que le serveur est démarré sur ${BASE_URL}`);
    }
    console.log();
}

/**
 * Classe helper pour faciliter l'utilisation
 */
class BackendIAClient {
    constructor(baseUrl, devToken) {
        this.baseUrl = baseUrl;
        this.headers = {
            "Authorization": `Bearer ${devToken}`,
            "Content-Type": "application/json"
        };
    }
    
    async prompt(text, options = {}) {
        const response = await fetch(`${this.baseUrl}/api/prompt`, {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify({
                prompt: text,
                ...options
            })
        });
        
        if (!response.ok) {
            throw new Error(`Erreur API: ${response.status}`);
        }
        
        return await response.json();
    }
    
    async getUserInfo() {
        const response = await fetch(`${this.baseUrl}/auth/me`, {
            method: "GET",
            headers: this.headers
        });
        
        if (!response.ok) {
            throw new Error(`Erreur API: ${response.status}`);
        }
        
        return await response.json();
    }
}

/**
 * Exemple d'utilisation avec la classe helper
 */
async function exempleAvecClient() {
    console.log("🧪 Test 4: Utilisation avec la classe helper");
    
    const client = new BackendIAClient(BASE_URL, DEV_TOKEN);
    
    try {
        // Récupérer les infos utilisateur
        const user = await client.getUserInfo();
        console.log(`👤 Connecté en tant que: ${user.username} (${user.role})`);
        
        // Faire une requête IA
        const result = await client.prompt(
            "Qu'est-ce que FastAPI ?",
            { temperature: 0.5, max_tokens: 150 }
        );
        
        console.log(`\n🤖 Réponse: ${result.response}`);
        console.log(`⏱️  Temps: ${result.processing_time}s`);
        
    } catch (error) {
        console.error("❌ Erreur:", error.message);
    }
    console.log();
}

/**
 * Fonction principale
 */
async function main() {
    console.log("=".repeat(60));
    console.log("🚀 TESTS DE DÉVELOPPEMENT - BACKENDAI (JavaScript)");
    console.log("=".repeat(60));
    console.log();
    
    await testHealthCheck();
    await testUserInfo();
    await testPromptSimple();
    await testPromptAvecParametres();
    await exempleAvecClient();
    
    console.log("=".repeat(60));
    console.log("✅ Tous les tests sont terminés!");
    console.log("=".repeat(60));
}

// Exécuter si appelé directement
if (require.main === module) {
    main().catch(console.error);
}

// Exporter pour utilisation en module
module.exports = {
    BackendIAClient,
    testPromptSimple,
    testPromptAvecParametres,
    testUserInfo,
    testHealthCheck
};


