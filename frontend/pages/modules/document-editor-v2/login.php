<?php
require_once '../../../config/config.php';
require_once '../../../includes/functions.php';

// Si déjà connecté, rediriger
if (isset($_SESSION['user'])) {
    redirect(url('pages/modules/document-editor-v2/index.php'));
}

$page_title = 'Connexion - Document Editor V2';

require_once '../../../includes/header.php';
?>

<div class="login-container" style="max-width: 400px; margin: 50px auto; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h2 style="text-align: center; margin-bottom: 2rem;">Connexion Document Editor V2</h2>
    
    <form id="loginForm" style="display: flex; flex-direction: column; gap: 1rem;">
        <div>
            <label for="email" style="display: block; margin-bottom: 0.5rem;">Email</label>
            <input type="email" id="email" name="email" required 
                   style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px;">
        </div>
        
        <div>
            <label for="password" style="display: block; margin-bottom: 0.5rem;">Mot de passe</label>
            <input type="password" id="password" name="password" required 
                   style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px;">
        </div>
        
        <button type="submit" 
                style="padding: 0.75rem; background: var(--color-primary, #606163); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">
            Se connecter
        </button>
        
        <div id="errorMessage" style="color: red; display: none; margin-top: 1rem;"></div>
    </form>
    
    <p style="text-align: center; margin-top: 2rem; color: #666; font-size: 0.9rem;">
        <a href="<?= url('pages/modules/document-editor-v2/index.php'); ?>" style="color: var(--color-primary, #606163);">
            Continuer sans connexion (mode démo)
        </a>
    </p>
</div>

<script>
const API_BASE_URL = 'http://localhost:5005/api';

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('errorMessage');
    
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Rediriger vers la page principale
            window.location.href = '<?= url('pages/modules/document-editor-v2/index.php'); ?>';
        } else {
            errorDiv.textContent = data.error || 'Erreur de connexion';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        console.error('Erreur login:', error);
        errorDiv.textContent = 'Erreur de connexion au serveur';
        errorDiv.style.display = 'block';
    }
});
</script>

<?php require_once '../../../includes/footer.php'; ?>


